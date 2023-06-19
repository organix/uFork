// A TLS-over-TCP AWP transport for Node.js.

//  name:
//      An Ed25519 public key as a 32-byte Uint8Array.

//  address:
//  bind_info:
//      An object like {host, port}.

//  identity:
//      A Node.js KeyObject representing a Ed25519 private key.

//      The transport's 'generate_identity' method is a requestor factory that
//      produces new identities.

//      The transport's 'get_name' method takes an identity and returns the
//      corresponding name.

/*jslint node, long */

import crypto from "node:crypto";
import tls from "node:tls";
import oed from "../oed_lite.js";

const min_tls_version = "TLSv1.3";              // more secure than v1.2
const ciphers = "TLS_CHACHA20_POLY1305_SHA256"; // no negotiation

function hex_decode(string) {
    return Buffer.from(string.replace(/\s/g, ""), "hex");
}

function get_certificate_pem(private_key_object) {

// Node.js does not come with the ability to generate TLS certificates. However,
// it does expose the necessary cryptographic operations to

//  a) derive the public key from the private key, and
//  b) sign the TBS (to-be-signed) certificate holding the public key

// allowing us to construct valid certificates using some precomputed material.

// I found https://lapo.it/asn1js very handy in reverse-engineering the
// certificate format. The template material is based on the output of the
// following commands:

//      openssl genpkey -algorithm Ed25519 > key.pem
//      openssl req -new -subj /CN=ufork -x509 -key key.pem > cert.pem

    const prelude = hex_decode(`
        30 82 01 34
    `);
    const tbs_start = hex_decode(`
                    30 81 E7 A0  03 02 01 02 02 14 1E 7E
        12 FD 02 50 F4 AD 41 FC  69 C0 65 9B 4C 61 37 B1
        45 DF 30 05 06 03 2B 65  70 30 10 31 0E 30 0C 06
        03 55 04 03 0C 05 75 66  6F 72 6B 30 1E 17 0D 32
        33 30 36 31 36 31 30 35  34 30 39 5A 17 0D 32 33
        30 37 31 36 31 30 35 34  30 39 5A 30 10 31 0E 30
        0C 06 03 55 04 03 0C 05  75 66 6F 72 6B
    `);
    const public_key_der = crypto.createPublicKey(
        private_key_object
    ).export(
        {type: "spki", format: "der"}
    );
    const tbs_end = hex_decode(`
                                    A3 53 30 51 30 1D 06
        03 55 1D 0E 04 16 04 14  A7 CC E6 E9 3E 16 9B 7A
        58 82 C0 A1 41 41 20 F3  7B 35 3F 44 30 1F 06 03
        55 1D 23 04 18 30 16 80  14 A7 CC E6 E9 3E 16 9B
        7A 58 82 C0 A1 41 41 20  F3 7B 35 3F 44 30 0F 06
        03 55 1D 13 01 01 FF 04  05 30 03 01 01 FF
    `);
    const signature_algorithm = hex_decode(`
                                                   30 05
        06 03 2B 65 70 03 41 00
    `);
    const tbs_certificate = Buffer.concat([
        tbs_start,
        public_key_der,
        tbs_end
    ]);
    const asn1 = Buffer.concat([
        prelude,
        tbs_certificate,
        signature_algorithm,
        crypto.sign(undefined, tbs_certificate, private_key_object)
    ]);
    return (
        "-----BEGIN CERTIFICATE-----\n"
        + asn1.toString("base64")
        + "\n-----END CERTIFICATE-----"
    );
}

function cert_to_pub(der_buffer) {

// Since we constructed the certificate manually, we can reliably predict where
// the public key will be.

    return der_buffer.slice(121, 153);
}

function get_name(private_key_object) {
    return new Uint8Array(
        crypto.createPublicKey(
            private_key_object
        ).export(
            {type: "spki", format: "der"}
        ).slice(
            12 // SEQUENCE, SEQUENCE, OBJECT IDENTIFIER
        )
    );
}

function generate_identity() {
    return function generate_identity_requestor(callback) {
        try {
            crypto.generateKeyPair(
                "ed25519", // less NSA
                undefined,
                function (error, ignore, private_key_object) {
                    return (
                        error
                        ? callback(undefined, error)
                        : callback(private_key_object)
                    );
                }
            );
        } catch (exception) {
            return callback(undefined, exception);
        }
    };
}

function make_consumer(socket, connection, on_receive, on_close) {
    let remainder = Buffer.from([]);
    return function (chunk) {
        remainder = Buffer.concat([remainder, chunk]);
        const result = oed.decode(new Uint8Array(remainder));
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
                key: identity.export({type: "pkcs8", format: "pem"}),
                cert: get_certificate_pem(identity),
                rejectUnauthorized: false,
                requestCert: true,
                minVersion: min_tls_version,
                ciphers
            });
            server.on("secureConnection", function (socket) {
                let destroyed = false;
                const certificate = socket.getPeerCertificate();
                const connection = Object.freeze({
                    send(frame) {

// The frame buffer is encoded as a Raw BLOB with a leading length, used by the
// receiver to distinguish separate frames.

                        socket.write(oed.encode(frame));
                    },
                    name() {
                        return new Uint8Array(cert_to_pub(certificate.raw));
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
                callback(stop);
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
                key: identity.export({type: "pkcs8", format: "pem"}),
                cert: get_certificate_pem(identity),
                rejectUnauthorized: false,
                minVersion: min_tls_version,
                ciphers
            }, function on_secure_connection() {
                const certificate = socket.getPeerCertificate();
                if (cert_to_pub(certificate.raw).equals(name)) {
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

function node_tls_transport() {
    return Object.freeze({listen, connect, generate_identity, get_name});
}

//debug import hex from "./hex.js";
//debug import parseq from "../parseq.js";
//debug function halve(buffer) {
//debug     return new Uint8Array(buffer).slice(
//debug         0,
//debug         Math.floor(buffer.length / 2)
//debug     );
//debug }
//debug parseq.parallel(
//debug     [generate_identity(), generate_identity()]
//debug )(function ([alice_identity, bob_identity], ignore) {
//debug     const bob_address = {host: "localhost", port: 4444};
//debug     const flake = 0.1;
//debug     const cancel_listen = listen(
//debug         bob_identity,
//debug         bob_address,
//debug         function on_open(connection) {
//debug             console.log("bob on_open", hex.encode(connection.name()));
//debug         },
//debug         function on_receive(connection, frame_buffer) {
//debug             console.log("bob on_receive", frame_buffer);
//debug             if (frame_buffer.length > 0) {
//debug                 connection.send(halve(frame_buffer));
//debug             } else {
//debug                 connection.close();
//debug             }
//debug         },
//debug         function on_close(ignore, reason) {
//debug             console.log("bob on_close", reason);
//debug         }
//debug     )(function listen_callback(stop, reason) {
//debug         if (stop === undefined) {
//debug             return console.log("bob failed", reason);
//debug         }
//debug         console.log("bob listening");
//debug         const cancel_connect = connect(
//debug             alice_identity,
//debug             get_name(bob_identity),
//debug             bob_address,
//debug             function on_receive(connection, frame_buffer) {
//debug                 console.log("alice on_receive", frame_buffer);
//debug                 if (frame_buffer.length > 0) {
//debug                     connection.send(halve(frame_buffer));
//debug                 } else {
//debug                     connection.close();
//debug                 }
//debug                 if (Math.random() < flake) {
//debug                     console.log("bob stop");
//debug                     stop();
//debug                 }
//debug             },
//debug             function on_close(ignore, reason) {
//debug                 console.log("alice on_close", reason);
//debug             }
//debug         )(function connect_callback(connection, reason) {
//debug             if (connection === undefined) {
//debug                 return console.log("alice failed", reason);
//debug             }
//debug             console.log("alice on_open", hex.encode(connection.name()));
//debug             connection.send(new Uint8Array(1e5));
//debug         });
//debug         if (Math.random() < flake) {
//debug             console.log("alice cancel");
//debug             cancel_connect();
//debug         }
//debug     });
//debug     if (Math.random() < flake) {
//debug         console.log("bob cancel");
//debug         cancel_listen();
//debug     }
//debug });

export default Object.freeze(node_tls_transport);
