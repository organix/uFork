// An in-memory AWP transport that is ordered and reliable.

// Names and addresses are arbitrary numbers or strings. The bind_info equals
// the address, the identity equals the name.

// Randomized latency will be simulated if the 'max_latency' parameter is a
// positive integer, and messages are no longer guaranteed to arrive in order.

// Intermittent communication failure will be simulated if the 'flakiness'
// parameter is a number between 0 and 1.

/*jslint web, global */

import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";

function memory_transport(flakiness, max_latency) {
    let listeners = Object.create(null);

    function flake() {
        return Number.isFinite(flakiness) && Math.random() < flakiness;
    }

    function delay(callback, ...args) {
        if (!Number.isSafeInteger(max_latency)) {
            return callback(...args);
        }
        const timer = setTimeout(
            callback,
            max_latency * Math.random(),
            ...args
        );
        return function cancel() {
            clearTimeout(timer);
        };
    }

    function listen(identity, bind_info, on_open, on_receive, on_close) {
        return function listen_requestor(callback) {
            let connections = [];

            function stop() {
                delete listeners[identity + ":" + bind_info];
                connections.forEach(function (connection) {
                    connection.close();
                });
            }

            function make_connection(
                initiator_name,
                on_initiator_close,
                on_listener_receive,
                on_listener_close
            ) {
                let connection = Object.create(null);

                function forget_connection() {
                    connections = connections.filter(
                        (the_connection) => the_connection !== connection
                    );
                }

                function simulate_failure(reason) {
                    if (!connections.includes(connection)) {
                        return;
                    }
                    on_listener_close(reason);
                    on_close(connection, reason);
                    return forget_connection();
                }

                connection.send = function (frame) {
                    if (!connections.includes(connection)) {
                        throw new Error("Could not send, closed.");
                    }

// Frames may arrive out-of-order.

                    delay(function () {
                        if (!connections.includes(connection)) {
                            return;
                        }
                        if (flake()) {
                            return simulate_failure("Send failed.");
                        }
                        on_listener_receive(frame);
                    });
                };
                connection.name = function () {
                    return initiator_name;
                };
                connection.close = function () {
                    if (!connections.includes(connection)) {
                        return;
                    }
                    on_listener_close();
                    return forget_connection();
                };
                connections.push(connection);
                on_open(connection);

// The caller gets back a connection object with the same signature as
// 'connection', but with functionality that makes sense from the initiating
// party's perspective.

                let closed = false;
                return Object.freeze({
                    send: function receive_from_initiating_party(frame) {
                        if (closed) {
                            throw new Error("Could not send, closed.");
                        }
                        delay(function () {
                            if (!connections.includes(connection)) {
                                return;
                            }
                            if (flake()) {
                                return simulate_failure("Receive failed.");
                            }
                            on_receive(connection, frame);
                        });
                    },
                    name: function () {
                        return identity;
                    },
                    close: function close_from_initiating_party() {
                        on_initiator_close();
                        delay(function () {
                            closed = true;
                            if (!connections.includes(connection)) {
                                return;
                            }
                            forget_connection();
                            return on_close(connection);
                        });
                    }
                });
            }

            return delay(function () {
                if (listeners[identity + ":" + bind_info] !== undefined) {
                    return callback(undefined, "Address in use.");
                }
                listeners[identity + ":" + bind_info] = make_connection;
                return callback(stop);
            });
        };
    }

    function connect(identity, name, address, on_receive, on_close) {
        return function connect_requestor(callback) {
            return delay(function () {
                let closed = false;
                if (flake() || listeners[name + ":" + address] === undefined) {
                    return callback(undefined, "Connect failed.");
                }
                const connection = listeners[name + ":" + address](
                    identity,
                    function on_initiator_close() {
                        closed = true;
                    },
                    function on_listener_receive(frame) {
                        if (!closed) {
                            on_receive(connection, frame);
                        }
                    },
                    function on_listener_close(reason) {
                        if (!closed) {
                            on_close(connection, reason);
                            closed = true;
                        }
                    }
                );
                if (connection.name() !== name) {
                    connection.close();
                    return callback(undefined, "Authentication failed.");
                }
                return callback(connection);
            });
        };
    }

    return Object.freeze({listen, connect});
}

function demo(log) {
    const flake = 0.1;
    const transport = memory_transport(flake, 50);
    const cancel = parseq.sequence([
        transport.listen(
            "bob",
            "@bob",
            function on_open(connection) {
                log("bob on_open", connection.name());
            },
            function on_receive(connection, frame) {
                log("bob on_receive", frame);
                if (frame > 0) {
                    connection.send(frame - 1);
                } else {
                    connection.close();
                }
            },
            function on_close(_, reason) {
                log("bob on_close", reason);
            }
        ),
        requestorize(function maybe_stop(stop) {
            if (Math.random() < flake) {
                log("bob stop");
                stop();
            }
            return true;
        }),
        transport.connect(
            "alice",
            "bob",
            "@bob",
            function on_receive(connection, frame) {
                log("alice on_receive", frame);
                if (frame > 0) {
                    connection.send(frame - 1);
                } else {
                    connection.close();
                }
            },
            function on_close(_, reason) {
                log("alice on_close", reason);
            }
        ),
        requestorize(function send_message(connection) {
            log("alice on_open", connection.name());
            const message = Math.floor(Math.random() * 10);
            connection.send(message);
            return "Sent " + message;
        })
    ])(log);
    if (Math.random() < flake) {
        log("cancel");
        cancel();
    }
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(memory_transport);
