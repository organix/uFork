// A dummy AWP transport. It simulates a private network in memory. Latency is
// randomised. The 'flakiness' parameter, between 0 and 1, controls the
// propensity for network errors. Addresses are arbitrary strings or numbers.

/*jslint browser */

function delay(callback, ...args) {
    const timer = setTimeout(callback, 50 * Math.random(), ...args);
    return function cancel() {
        clearTimeout(timer);
    };
}

function dummy_transport(flakiness = 0) {
    let listeners = Object.create(null);

    function flake() {
        return Math.random() < flakiness;
    }

    function listen(identity, bind_address, on_open, on_receive, on_close) {
        let connections = [];
        return function listen_requestor(callback) {

            function stop() {
                delete listeners[bind_address];
                connections.forEach(function (connection) {
                    connection.close();
                });
            }

            function make_connection(
                initiator_public_key,
                on_initiator_close,
                on_listener_frame,
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
                        on_listener_frame(frame);
                    });
                };
                connection.public_key = function () {
                    return initiator_public_key;
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
                    public_key: function () {
                        return identity.public_key;
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
                if (listeners[bind_address] !== undefined) {
                    return callback(undefined, "Address in use.");
                }
                listeners[bind_address] = make_connection;
                return callback(stop);
            });
        };
    }

    function connect(identity, acquaintance, on_receive, on_close) {
        return function connect_requestor(callback) {
            return delay(function () {
                let closed = false;
                if (flake() || listeners[acquaintance.address] === undefined) {
                    return callback(undefined, "Connect failed.");
                }
                const connection = listeners[acquaintance.address](
                    identity.public_key,
                    function on_initiator_close() {
                        closed = true;
                    },
                    function on_listener_frame(frame) {
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
                if (connection.public_key() !== acquaintance.public_key) {
                    connection.close();
                    return callback(undefined, "Authentication failed.");
                }
                return callback(connection);
            });
        };
    }

    return Object.freeze({listen, connect});
}

//debug const flake = 0.1;
//debug const transport = dummy_transport(flake);
//debug const cancel_listen = transport.listen(
//debug     {public_key: "bob"},
//debug     "@bob",
//debug     function on_open(connection) {
//debug         console.log("bob on_open", connection.public_key());
//debug     },
//debug     function on_receive(connection, frame) {
//debug         console.log("bob on_receive", frame);
//debug         if (frame > 0) {
//debug             connection.send(frame - 1);
//debug         } else {
//debug             connection.close();
//debug         }
//debug     },
//debug     function on_close(ignore, reason) {
//debug         console.log("bob on_close", reason);
//debug     }
//debug )(function listen_callback(stop, reason) {
//debug     if (stop === undefined) {
//debug         return console.log("bob failed", reason);
//debug     }
//debug     const cancel_connect = transport.connect(
//debug         {public_key: "alice"},
//debug         {public_key: "bob", address: "@bob"},
//debug         function on_receive(connection, frame) {
//debug             console.log("alice on_receive", frame);
//debug             if (frame > 0) {
//debug                 connection.send(frame - 1);
//debug             } else {
//debug                 connection.close();
//debug             }
//debug         },
//debug         function on_close(ignore, reason) {
//debug             console.log("alice on_close", reason);
//debug         }
//debug     )(function connect_callback(connection, reason) {
//debug         if (connection === undefined) {
//debug             return console.log("alice failed", reason);
//debug         }
//debug         console.log("alice on_open", connection.public_key());
//debug         connection.send(Math.floor(Math.random() * 10));
//debug     });
//debug     if (cancel_connect !== undefined && Math.random() < flake) {
//debug         console.log("alice cancel");
//debug         cancel_connect();
//debug     }
//debug });
//debug if (cancel_listen !== undefined && Math.random() < flake) {
//debug     console.log("bob cancel");
//debug     cancel_listen();
//debug }

export default Object.freeze(dummy_transport);
