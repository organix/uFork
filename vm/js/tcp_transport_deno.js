// A TCP device transport for Deno.

// The address parameter of both the 'listen' and 'connect' functions must be a
// string of the form <ip_address>:<port>.

// This module was originally part of the WebSeif project, see
// https://github.com/jamesdiacono/WebSeif.

/*jslint deno, null */

import tcp_transport_demo from "./tcp_transport_demo.js";

const chunk_size = 8192;

function parse_address(address) {
    const [host, port] = address.split(":");
    return {
        host,
        port: parseInt(port, 10)
    };
}

function read(socket, on_chunk, on_end) {
    const scratch = new Uint8Array(chunk_size);
    return socket.read(scratch).then(function (nr_bytes) {
        return (
            nr_bytes === null
            ? on_end()
            : Promise.resolve(
                on_chunk(scratch.slice(0, nr_bytes))
            ).then(function () {
                return read(socket, on_chunk, on_end);
            })
        );
    });
}

function write(socket, chunk) {
    return (
        chunk.length > 0
        ? socket.write(chunk).then(function (nr_bytes) {
            return write(socket, chunk.slice(nr_bytes));
        })
        : Promise.resolve()
    );
}

function connect(address, on_open, on_receive, on_close) {
    let connection;
    Deno.connect(
        parse_address(address)
    ).then(
        function (socket) {
            function fail(reason) {
                if (on_close !== undefined) {
                    socket.close();
                    on_close(connection, reason);
                    on_close = undefined;
                }
            }
            connection = Object.freeze({
                send(chunk) {
                    return write(socket, chunk).catch(fail);
                },
                close() {
                    if (on_close !== undefined) {
                        socket.close();
                        on_close = undefined;
                    }
                }
            });
            read(
                socket,
                function on_chunk(chunk) {
                    return on_receive(connection, chunk);
                },
                function on_end() {
                    on_close(connection);
                    on_close = undefined;
                }
            ).catch(
                fail
            );
            return on_open(connection);
        }
    ).catch(function (reason) {
        on_close(undefined, reason);
    });
    return function close() {
        if (on_close !== undefined) {
            if (connection !== undefined) {
                connection.close();
            }
            on_close = undefined;
        }
    };
}

function listen(address, on_open, on_receive, on_close) {
    let listener = Deno.listen(parse_address(address));
    let registrations = [];

    function register(socket) {
        let connection;
        function unregister() {
            registrations = registrations.filter(function (value) {
                return value !== connection;
            });
        }
        function fail(reason) {
            if (registrations.includes(connection)) {
                socket.close();
                on_close(connection, reason);
                unregister();
            }
        }
        connection = Object.freeze({
            send(chunk) {
                return write(socket, chunk).catch(fail);
            },
            close() {
                if (registrations.includes(connection)) {
                    socket.close();
                    unregister();
                }
            }
        });
        registrations.push(connection);
        read(
            socket,
            connection,
            function on_chunk(chunk) {
                return on_receive(connection, chunk);
            },
            function on_end() {
                on_close(connection);
                unregister();
            }
        ).catch(function () {

// The connection was closed during read.

            fail();
        });
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

            return registrations.forEach(function (connection) {
                connection.close();
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
    tcp_transport_demo(tcp_transport_deno(), "127.0.0.1:1234");
}

export default Object.freeze(tcp_transport_deno);
