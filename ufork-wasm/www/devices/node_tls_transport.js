// A TLS-over-TCP AWP transport for Node.js.

//  name:
//      An Ed25519 public key as a 32-byte Uint8Array.

//  address:
//  bind_info:
//      An object like {host, port}.

//  identity:
//      A Node.js KeyObject representing a Ed25519 private key.

//      The transport's 'generate_identity' method is a requestor function that
//      produces a new identity.

//      The transport's 'identity_to_name' method takes an identity and returns
//      the corresponding name.

/*jslint node, long, bitwise */

import crypto from "node:crypto";
import tls from "node:tls";
import oed from "../oed_lite.js";

const min_tls_version = "TLSv1.3";              // more secure than v1.2
const ciphers = "TLS_CHACHA20_POLY1305_SHA256"; // no negotiation

// DER encoding.

const INTEGER = "02";
const BIT_STRING = "03";
const OBJECT_IDENTIFIER = "06";
const UTC_TIME = "17";
const SEQUENCE = "30";

function der(tag, ...elements) {
    const body = Buffer.concat(elements.map(function (element) {
        return (
            typeof element === "string"
            ? Buffer.from(element, "hex")
            : (
                Number.isSafeInteger(element)
                ? Buffer.from([element])
                : element
            )
        );
    }));
    let length_buffer;
    if (body.length < 0x80) {
        length_buffer = Buffer.from([body.length]);
    } else {
        let length_octets = [];
        let length = body.length;
        let radix = 256;
        while (length > 0) {
            length_octets.unshift(length % radix);
            length = Math.floor(length / radix);
            radix *= radix;
        }
        length_buffer = Buffer.from([
            0x80 | length_octets.length,
            ...length_octets
        ]);
    }
    return Buffer.concat([
        Buffer.from(tag, "hex"),
        length_buffer,
        body
    ]);
}

// DER decoding.

function der_unwrap(buffer) {
    let offset = 1; // skip tag
    let length = 0;
    if (buffer[offset] < 0x80) {
        length = buffer[offset];
        offset += 1;
    } else {
        const nr_length_octets = buffer[offset] ^ 0x80;
        offset += 1;
        let place = nr_length_octets;
        let radix = 1;
        while (place > 0) {
            length += radix * buffer[offset + place - 1];
            radix *= 256;
            place -= 1;
        }
        offset += nr_length_octets;
    }
    return {
        container: buffer.subarray(0, offset + length),
        body: buffer.subarray(offset, offset + length)
    };
}

function refine_der(buffer, path) {
    if (path.length === 0) {
        return buffer;
    }
    buffer = der_unwrap(buffer).body;
    let index = path[0];
    let value;
    while (index > 0) {
        value = der_unwrap(buffer);
        buffer = buffer.slice(value.container.length); // skip value
        index -= 1;
    }
    return refine_der(buffer, path.slice(1));
}

function cert_to_pub(buffer) {

// Since we are constructing certificates manually, we can reliably predict
// where the public key will be.

    return refine_der(buffer, [0, 5, 1, 0]).slice(1); // bit string padding byte
}

function get_certificate_pem(private_key_object) {

// Node.js does not come with the ability to generate TLS certificates. However,
// it does expose the necessary cryptographic operations to

//  a) derive the public key from the private key, and
//  b) sign the TBS (to-be-signed) certificate

// allowing us to construct valid certificates in an ad hoc fashion.

// I found https://lapo.it/asn1js very handy in reverse-engineering the
// certificate format. The template material is based on the output of the
// following commands:

//      openssl genpkey -algorithm Ed25519 > key.pem
//      openssl req -new -subj /CN=ufork -x509 -key key.pem > cert.pem

    const signature_algorithm = der(
        SEQUENCE,
        der(OBJECT_IDENTIFIER, "2B6570") // curveEd25519
    );
    const tbs_certificate = der(
        SEQUENCE,
        der(INTEGER, crypto.randomBytes(8)),        // CertificateSerialNumber
        signature_algorithm,                        // AlgorithmIdentifier
        der(SEQUENCE),                              // issuer (unused)
        der(                                        // validity
            SEQUENCE,
            der(UTC_TIME, Buffer.from("200101000000Z")), // 2020
            der(UTC_TIME, Buffer.from("400101000000Z"))  // 2040
        ),
        der(SEQUENCE),                              // subject (unused)
        crypto.createPublicKey(                     // subjectPublicKeyInfo
            private_key_object
        ).export(
            {type: "spki", format: "der"}
        )
    );
    const signature = der(
        BIT_STRING,
        0, // no padding bits
        crypto.sign(undefined, tbs_certificate, private_key_object)
    );
    return (
        "-----BEGIN CERTIFICATE-----\n"
        + der(
            SEQUENCE,
            tbs_certificate,
            signature_algorithm,
            signature
        ).toString("base64")
        + "\n-----END CERTIFICATE-----"
    );
}

function identity_to_name(private_key_object) {
    return new Uint8Array(refine_der(
        crypto.createPublicKey(
            private_key_object
        ).export(
            {type: "spki", format: "der"}
        ),
        [1, 0]
    )).slice(1); // discard bit field's bit padding octet
}

function generate_identity_requestor(callback) {
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

function listen_requestor(
    callback,
    {identity, bind_info, on_open, on_receive, on_close}
) {
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
}

function connect_requestor(
    callback,
    {identity, name, address, on_receive, on_close}
) {
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
}

function node_tls_transport() {
    return Object.freeze({
        listen: listen_requestor,
        connect: connect_requestor,
        generate_identity: generate_identity_requestor,
        identity_to_name
    });
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
//debug     [generate_identity_requestor, generate_identity_requestor]
//debug )(function ([alice_identity, bob_identity], ignore) {
//debug     const bob_address = {host: "localhost", port: 4444};
//debug     const flake = 0;
//debug     function connect_callback(connection, reason) {
//debug         if (connection === undefined) {
//debug             return console.log("alice failed", reason);
//debug         }
//debug         console.log("alice on_open", hex.encode(connection.name()));
//debug         connection.send(new Uint8Array(1e5));
//debug     }
//debug     function listen_callback(stop, reason) {
//debug         if (stop === undefined) {
//debug             return console.log("bob failed", reason);
//debug         }
//debug         console.log("bob listening");
//debug         const cancel_connect = connect_requestor(connect_callback, {
//debug             identity: alice_identity,
//debug             name: identity_to_name(bob_identity),
//debug             address: bob_address,
//debug             on_receive(connection, frame_buffer) {
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
//debug             on_close(ignore, reason) {
//debug                 console.log("alice on_close", reason);
//debug             }
//debug         });
//debug         if (Math.random() < flake) {
//debug             console.log("alice cancel");
//debug             cancel_connect();
//debug         }
//debug     }
//debug     const cancel_listen = listen_requestor(listen_callback, {
//debug         identity: bob_identity,
//debug         bind_info: bob_address,
//debug         on_open(connection) {
//debug             console.log("bob on_open", hex.encode(connection.name()));
//debug         },
//debug         on_receive(connection, frame_buffer) {
//debug             console.log("bob on_receive", frame_buffer);
//debug             if (frame_buffer.length > 0) {
//debug                 connection.send(halve(frame_buffer));
//debug             } else {
//debug                 connection.close();
//debug             }
//debug         },
//debug         on_close(ignore, reason) {
//debug             console.log("bob on_close", reason);
//debug         }
//debug     });
//debug     if (Math.random() < flake) {
//debug         console.log("bob cancel");
//debug         cancel_listen();
//debug     }
//debug });

export default Object.freeze(node_tls_transport);
