// A TCP device transport for Deno.

// The address parameter of both the 'listen' and 'connect' functions must be a
// string of the form <ip_address>:<port>.

/*jslint deno, null, global */

import tcp_transport_demo from "./tcp_transport_demo.js";

const chunk_size = 8192;
const eof = undefined;

function parse_address(address) {
    const [host, port] = address.split(":");
    return {
        host,
        port: parseInt(port, 10)
    };
}

function read(socket) {
    let scratch = new Uint8Array(chunk_size);
    return socket.read(scratch).then(function (nr_bytes) {
        return (
            nr_bytes === null
            ? eof
            : new Uint8Array(scratch.buffer, 0, nr_bytes)
        );
    });
}

function write(socket, chunk) {
    if (chunk === eof) {
        socket.close();
        return Promise.resolve();
    }
    return socket.write(chunk).then(function (nr_bytes) {
        if (chunk.length - nr_bytes > 0) {
            return write(socket, chunk.slice(nr_bytes));
        }
    });
}

function connect(address) {
    return Deno.connect(parse_address(address)).then(function (socket) {
        return Object.freeze({
            read() {
                return read(socket);
            },
            write(chunk) {
                return write(socket, chunk);
            },
            dispose() {
                socket[Symbol.dispose]();
            }
        });
    });
}

function listen(address, on_open) {
    let listener = Deno.listen(parse_address(address));
    let connections = [];

    function register(socket) {
        const connection = Object.freeze({
            read() {
                return read(socket);
            },
            write(chunk) {
                return write(socket, chunk);
            },
            dispose() {
                socket[Symbol.dispose]();
            }
        });
        connections.push(connection);
        return on_open(connection);
    }

    (function wait_for_next_socket() {
        return listener.accept().then(function (socket) {
            wait_for_next_socket();
            register(socket);
        }).catch(function () {

// The listener.close function has just been called. Calling listener.close only
// prevents the listener from accepting new connections. Any open sockets must
// be closed explicitly.

            return connections.forEach(function (connection) {
                connection.dispose();
            });
        });
    }());
    return function stop() {

// Subsequent calls to listener.close throw an exception, but 'stop' is not so
// strict.

        if (listener !== undefined) {
            listener.close();
            listener = undefined;
        }
    };
}

function tcp_transport_deno() {
    return Object.freeze({listen, connect});
}

if (import.meta.main) {
    tcp_transport_demo(
        tcp_transport_deno(),
        "127.0.0.1:1234",
        globalThis.console.log
    );
}

export default Object.freeze(tcp_transport_deno);
