// A TLS-over-TCP AWP transport for Node.js.

//  name:
//      A Uint8Array containing raw public key material.

//  address:
//  bind_info:
//      An object like {host, port}.

//  identity:
//      An object like {key, cert} where the key is a PEM-encoded P-521 private
//      key and cert is a matching PEM-encoded x509 certificate.

//      These can be generated with the following commands:

//          openssl ecparam -name secp521r1 -genkey -noout > key.pem
//          openssl req -new -subj /CN=ufork -x509 -key key.pem > cert.pem

//      The 'name' can be obtained from the certificate using the transport's
//      'extract_public_key' method.

/*jslint node, long */

import stream from "node:stream";
import tls from "node:tls";
import oed from "../oed_lite.js";

const min_tls_version = "TLSv1.3";              // more secure than v1.2
const curve = "secp521r1";                      // P-521
const ciphers = "TLS_CHACHA20_POLY1305_SHA256"; // no negotiation

function concat(a, b) {
    let array = new Uint8Array(a.byteLength + b.byteLength);
    array.set(a, 0);
    array.set(b, a.byteLength);
    return array;
}

function extract_public_key(pem) {

// Node.js does not seem to expose its PEM parsing machinery, but we can still
// use it in a roundabout way.

    const tls_socket = new tls.TLSSocket(new stream.Transform(), {cert: pem});
    return new Uint8Array(tls_socket.getCertificate().pubkey);
}

function make_consumer(socket, connection, on_receive, on_close) {
    let remainder = new Uint8Array(0);
    return function (chunk) {
        remainder = concat(remainder, new Uint8Array(chunk));
        const result = oed.decode(remainder);
        if (result.value === undefined) {
            if (result.error === "offset out-of-bounds") {

// Wait for more bytes.

                return;
            }

// If the frame failed to decode, sever the connection.

            socket.destroy();
            return on_close(connection, result.error);
        }
        remainder = remainder.subarray(result.offset);
        return on_receive(connection, result.value);
    };
}

function node_tls_transport() {

    function listen(identity, bind_info, on_open, on_receive, on_close) {
        return function listen_requestor(callback) {
            let cancelled = false;
            let server;
            let connections = [];
            let reason;

            function stop() {
                connections.forEach(function (connection) {
                    connection.close();
                });
                connections = [];
                server.close();
            }

            try {
                const {host, port} = bind_info;
                server = tls.createServer({
                    key: identity.key,
                    cert: identity.cert,
                    rejectUnauthorized: false,
                    requestCert: true,
                    minVersion: min_tls_version,
                    ecdhCurve: curve,
                    ciphers
                });
                server.on("secureConnection", function (socket) {
                    const certificate = socket.getPeerCertificate();
                    if (certificate.asn1Curve !== curve) {
                        return socket.destroy();
                    }
                    let destroyed = false;
                    const connection = Object.freeze({
                        send(frame) {

// The frame buffer is encoded as a Raw BLOB with a leading length, used by the
// receiver to distinguish separate frames.

                            socket.write(oed.encode(frame));
                        },
                        name() {
                            return new Uint8Array(certificate.pubkey).slice();
                        },
                        close() {
                            destroyed = true;
                            socket.destroy();
                        }
                    });
                    socket.on("data", make_consumer(
                        socket,
                        connection,
                        on_receive,
                        on_close
                    ));
                    socket.once("tlsClientError", function (error) {
                        reason = error;
                    });
                    socket.once("error", function (error) {
                        reason = error;
                    });
                    socket.once("close", function () {
                        connections = connections.filter(function (the_conn) {
                            return the_conn !== connection;
                        });
                        if (!destroyed) {
                            on_close(connection, reason);
                        }
                    });
                    connections.push(connection);
                    on_open(connection);
                });
                server.listen(port, host, function on_listening() {
                    if (cancelled) {
                        return server.close();
                    }
                    callback({
                        stop,
                        info: server.address()
                    });
                });
                return function cancel() {
                    cancelled = true;
                };
            } catch (exception) {
                callback(undefined, exception);
            }
        };
    }

    function connect(identity, name, address, on_receive, on_close) {
        return function connect_requestor(callback) {
            let socket;
            let destroyed = false; // socket.destroyed === true on ECONNREFUSED
            let connection;
            let reason;
            try {
                const {host, port} = address;
                socket = tls.connect({
                    port,
                    host,
                    key: identity.key,
                    cert: identity.cert,
                    rejectUnauthorized: false,
                    minVersion: min_tls_version,
                    ecdhCurve: curve,
                    ciphers
                }, function on_secure_connection() {
                    const certificate = socket.getPeerCertificate();
                    if (
                        certificate.pubkey.equals(name)
                        && certificate.asn1Curve === curve
                    ) {
                        connection = Object.freeze({
                            send(frame) {
                                socket.write(oed.encode(frame));
                            },
                            name() {
                                return name;
                            },
                            close() {
                                destroyed = true;
                                socket.destroy();
                            }
                        });
                        socket.on("data", make_consumer(
                            socket,
                            connection,
                            on_receive,
                            on_close
                        ));
                        callback(connection);
                        callback = undefined;
                    } else {
                        destroyed = true;
                        socket.destroy();
                        callback(undefined, "Unexpected public key.");
                        callback = undefined;
                    }
                });
                socket.once("error", function (error) {
                    reason = error;
                });
                socket.once("close", function () {
                    if (!destroyed) {
                        if (callback !== undefined) {
                            callback(undefined, reason);
                            callback = undefined;
                        } else {
                            on_close(connection, reason);
                        }
                    }
                });
                return function cancel() {
                    if (callback !== undefined) {
                        destroyed = true;
                        socket.destroy();
                    }
                };
            } catch (exception) {
                callback(undefined, exception);
            }
        };
    }

    return Object.freeze({listen, connect, extract_public_key});
}

//debug import hex from "./hex.js";
//debug function halve(buffer) {
//debug     return new Uint8Array(buffer).slice(
//debug         0,
//debug         Math.floor(buffer.length / 2)
//debug     );
//debug }
//debug const transport = node_tls_transport();
//debug const bob_address = {host: "localhost", port: 4444};
//debug const bob_identity = {
//debug     cert: "-----BEGIN CERTIFICATE-----\nMIIBlzCB+QIJAMfPBllRxdANMAoGCCqGSM49BAMCMBAxDjAMBgNVBAMMBXVmb3JrMB4XDTIzMDYxNTAxMjYzM1oXDTIzMDcxNTAxMjYzM1owEDEOMAwGA1UEAwwFdWZvcmswgZswEAYHKoZIzj0CAQYFK4EEACMDgYYABACCfQXDKhuHQUQIzpU2HsgZK1n5eziSRHu+/tl67Pso6mSNSiWdhDwObikaOplnFO10IdGaoflbWn+qV3tSXTMYTABd6K9nN7ki/8/Ppoz0It9cqLn60u3RHHPpgrcAEFHpNA/LqItP/t55f6XPArvnt0xIfxjaI4gdwb2uUfnzITruSTAKBggqhkjOPQQDAgOBjAAwgYgCQgEqJCq5FDRvWYC8dMhzzcObvMJJ4FriVRlaEPH94FV1eZIvWLhpSkpzh02+KfiwclO0YJVzGAh7tFEBFZ1U+0A1BAJCAZ9ugBLIqRZXOR+ndUIAs917W9Dw+imQkbiHlKdU8rhGZgA7r29VAfx3A7l+1BmXUrvQRBuU6BoBMxW2BRTQ4wQ1\n-----END CERTIFICATE-----",
//debug     key: "-----BEGIN EC PRIVATE KEY-----\nMIHbAgEBBEE8BpKem+dZRCbbI33kCwXCADskDId/WhAE7RFRttOnV0m2kxwkad/bDpd20I7dNdUSD5VRk0GsVQacoHtMxdsBlKAHBgUrgQQAI6GBiQOBhgAEAIJ9BcMqG4dBRAjOlTYeyBkrWfl7OJJEe77+2Xrs+yjqZI1KJZ2EPA5uKRo6mWcU7XQh0Zqh+Vtaf6pXe1JdMxhMAF3or2c3uSL/z8+mjPQi31youfrS7dEcc+mCtwAQUek0D8uoi0/+3nl/pc8Cu+e3TEh/GNojiB3Bva5R+fMhOu5J\n-----END EC PRIVATE KEY-----"
//debug };
//debug const alice_identity = {
//debug     cert: "-----BEGIN CERTIFICATE-----\nMIIBlzCB+QIJAKXgK2B3FNUbMAoGCCqGSM49BAMCMBAxDjAMBgNVBAMMBXVmb3JrMB4XDTIzMDYxNTAxMDExNFoXDTIzMDcxNTAxMDExNFowEDEOMAwGA1UEAwwFdWZvcmswgZswEAYHKoZIzj0CAQYFK4EEACMDgYYABAD/K8/8lKykhrjH8R6VlEKg2leMjkxBZe/6mzzsymuvD9bn4kDsIj6wjRRaiErlcYisw8ZiJOKlGGAjrIU1ISzitACOZDZ50Xj63N6LQ8rpkoKmbDhWuoD1v0uClMr7IhjG26nsPiHjhJ5UB4FIY/gVu4cci/tkCPgNu4KQUnyYU1SgXTAKBggqhkjOPQQDAgOBjAAwgYgCQgHcMCYkwLybOyQ7ErtE5ucY2CjHStIJWOhgHD/RYrTX4uoXOVl2ISb7F4COQ8Xm1vepNvlWA9PfTbHjXopB6f2D+wJCAZ/Vzcnjsf8wSpm8x34uNYlvo0K+LZNFlQ7EuImKk33QbVR30KAS3y+Ok8yNAucg3Zh1243k09iCFLXmyclcUZgk\n-----END CERTIFICATE-----",
//debug     key: "-----BEGIN EC PRIVATE KEY-----\nMIHbAgEBBEErmNL2SxVE8Mi13BclwRfR1j/OWNDrt8fMXT8VTzVwfhFBV1XmIXRCB+s4VkQEQWfi69xgA1J1nz/4eWAOuieFoqAHBgUrgQQAI6GBiQOBhgAEAP8rz/yUrKSGuMfxHpWUQqDaV4yOTEFl7/qbPOzKa68P1ufiQOwiPrCNFFqISuVxiKzDxmIk4qUYYCOshTUhLOK0AI5kNnnRePrc3otDyumSgqZsOFa6gPW/S4KUyvsiGMbbqew+IeOEnlQHgUhj+BW7hxyL+2QI+A27gpBSfJhTVKBd\n-----END EC PRIVATE KEY-----"
//debug };
//debug const flake = 0;
//debug let cancel_connect;
//debug let cancel_listen = transport.listen(
//debug     bob_identity,
//debug     bob_address,
//debug     function on_open(connection) {
//debug         console.log("bob on_open", hex.encode(connection.name()));
//debug     },
//debug     function on_receive(connection, frame_buffer) {
//debug         console.log("bob on_receive", frame_buffer);
//debug         if (frame_buffer.length > 0) {
//debug             connection.send(halve(frame_buffer));
//debug         } else {
//debug             connection.close();
//debug         }
//debug     },
//debug     function on_close(ignore, reason) {
//debug         console.log("bob on_close", reason);
//debug     }
//debug )(function listen_callback(result, reason) {
//debug     if (result === undefined) {
//debug         return console.log("bob failed", reason);
//debug     }
//debug     console.log("bob listening", result.info);
//debug     cancel_connect = transport.connect(
//debug         alice_identity,
//debug         extract_public_key(bob_identity.cert),
//debug         bob_address,
//debug         function on_receive(connection, frame_buffer) {
//debug             console.log("alice on_receive", frame_buffer);
//debug             if (frame_buffer.length > 0) {
//debug                 connection.send(halve(frame_buffer));
//debug             } else {
//debug                 connection.close();
//debug             }
//debug             if (Math.random() < flake) {
//debug                 console.log("bob stop");
//debug                 result.stop();
//debug             }
//debug         },
//debug         function on_close(ignore, reason) {
//debug             console.log("alice on_close", reason);
//debug         }
//debug     )(function connect_callback(connection, reason) {
//debug         if (connection === undefined) {
//debug             return console.log("alice failed", reason);
//debug         }
//debug         console.log("alice on_open", hex.encode(connection.name()));
//debug         connection.send(new Uint8Array(1e5));
//debug     });
//debug     if (Math.random() < flake) {
//debug         console.log("alice cancel");
//debug         cancel_connect();
//debug     }
//debug });
//debug if (Math.random() < flake) {
//debug     console.log("bob cancel");
//debug     cancel_listen();
//debug }

export default Object.freeze(node_tls_transport);
