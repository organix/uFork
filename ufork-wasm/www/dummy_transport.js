// A dummy AWP transport. It simulates a private network in memory. Latency is
// randomised. The 'flakiness' parameter, between 0 and 1, controls the
// propensity for network errors. Addresses are arbitrary strings or numbers.

// The 'connect_info' argument is an object like {to, from} where 'to' is the
// address of the remote party and 'from' is the address of the local party.

// The 'listen_info' argument is the address of the local party.

/*jslint browser */

function delay(callback, ...args) {
    setTimeout(callback, 50 * Math.random(), ...args);
}

function dummy_transport(flakiness = 0) {
    let listeners = Object.create(null);

    function flake() {
        return Math.random() < flakiness;
    }

    function listen(listen_info, on_open, on_receive, on_close) {
        let connections = [];
        if (listeners[listen_info] !== undefined) {
            return on_close(undefined, "Listen failed.");
        }
        listeners[listen_info] = function make_connection(
            on_initiator_receive,
            on_initiator_close,
            initiator_address
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
                on_initiator_close(reason);
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
                    on_initiator_receive(frame);
                });
            };
            connection.info = function () {
                return initiator_address;
            };
            connection.close = function () {
                if (!connections.includes(connection)) {
                    return;
                }
                on_initiator_close();
                return forget_connection();
            };
            connections.push(connection);
            on_open(connection);

// The caller gets back a connection object with the same signature as
// 'connection', but with functionality that makes sense from the initiating
// party's perspective.

            let initiator_closed = false;
            return Object.freeze({
                send: function receive_from_initiating_party(frame) {
                    if (initiator_closed) {
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
                info: function () {
                    return listen_info;
                },
                close: function close_from_initiating_party() {
                    initiator_closed = true;
                    delay(function () {
                        if (!connections.includes(connection)) {
                            return;
                        }
                        forget_connection();
                        return on_close(connection);
                    });
                }
            });
        };
        return function stop() {
            delete listeners[listen_info];
            connections.forEach(function (connection) {
                connection.close();
            });
        };
    }

    function connect(connect_info, on_open, on_receive, on_close) {
        let closed = false;
        let connection;
        delay(function () {
            if (closed) {
                return;
            }
            if (flake() || listeners[connect_info.to] === undefined) {
                return on_close(connection, "Connect failed.");
            }
            connection = listeners[connect_info.to](
                function wrap_on_receive(frame) {
                    if (!closed) {
                        return on_receive(connection, frame);
                    }
                },
                function wrap_on_close(reason) {
                    if (!closed) {
                        return on_close(connection, reason);
                    }
                },
                connect_info.from
            );
            on_open(connection);
        });
        return function close() {
            closed = true;
            if (connection !== undefined) {
                connection.close();
            }
        };
    }

    return Object.freeze({listen, connect});
}

//debug const transport = dummy_transport();
//debug transport.listen(
//debug     "alice",
//debug     function on_open(connection) {
//debug         console.log("listen on_open", connection.info());
//debug     },
//debug     function on_receive(connection, frame) {
//debug         console.log("listen on_receive", frame);
//debug         if (frame > 0) {
//debug             connection.send(frame - 1);
//debug         } else {
//debug             connection.close();
//debug         }
//debug     },
//debug     function on_close(ignore, reason) {
//debug         console.log("listen on_close", reason);
//debug     }
//debug );
//debug transport.connect(
//debug     {to: "alice", from: "bob"},
//debug     function on_open(connection) {
//debug         console.log("connect on_open", connection.info());
//debug         connection.send(Math.floor(Math.random() * 10));
//debug     },
//debug     function on_receive(connection, frame) {
//debug         console.log("connect on_receive", frame);
//debug         if (frame > 0) {
//debug             connection.send(frame - 1);
//debug         } else {
//debug             connection.close();
//debug         }
//debug     },
//debug     function on_close(ignore, reason) {
//debug         console.log("connect on_close", reason);
//debug     }
//debug );

export default Object.freeze(dummy_transport);
