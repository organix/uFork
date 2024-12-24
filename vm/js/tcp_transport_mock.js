// A transport for testing the TCP device.

// It simulates a private network in memory. Latency is randomised.
// The 'flakiness' parameter, between 0 and 1, controls the propensity for
// network errors.

/*jslint browser, global */

import tcp_transport_demo from "./tcp_transport_demo.js";

const eof = undefined;

function delay(callback) {
    setTimeout(callback, 50 * Math.random());
}

function pause() {
    return new Promise(delay);
}

function tcp_transport_mock(flakiness = 0, max_chunk_size = 128) {
    let listeners = Object.create(null);

    function random_chunk_size() {
        return Math.floor(max_chunk_size * Math.random());
    }

    function flake() {
        return Math.random() < flakiness;
    }

    function listen(address, on_open) {
        let connections = [];
        if (flake() || listeners[address] !== undefined) {
            throw new Error("Listen failed.");
        }
        listeners[address] = function make_duplex() {
            let listener_connection;
            let incoming = {closed: false};
            let outgoing = {closed: false};
            let queue = Promise.resolve();

            function make_connection(incoming, outgoing) {

                function dispose(reason) {
                    incoming.closed = true;
                    if (incoming.on_close !== undefined) {
                        incoming.on_close(reason);
                        delete incoming.on_close;
                    }
                    delay(function () {
                        outgoing.closed = true;
                        if (outgoing.on_close !== undefined) {
                            outgoing.on_close(reason);
                            delete outgoing.on_close;
                        }
                    });
                }

                function write_chunk(chunk) {
                    if (incoming.closed) {
                        return Promise.reject("Write failed, closed.");
                    }
                    if (flake()) {
                        dispose("Flake.");
                        return Promise.reject("Write flake.");
                    }
                    if (chunk === eof) {
                        incoming.closed = true;
                    }
                    if (outgoing.on_fill === undefined) {
                        outgoing.buffer = chunk;
                        return new Promise(function (resolve, reject) {
                            outgoing.on_close = reject;
                            outgoing.on_drain = function () {
                                delete outgoing.on_drain;
                                delay(resolve);
                            };
                        });
                    }
                    outgoing.on_fill(chunk);
                }

                return Object.freeze({
                    read() {
                        if (incoming.closed) {
                            return Promise.reject("Read failed, closed.");
                        }
                        if (incoming.on_fill !== undefined) {
                            return Promise.reject("Read failed, busy.");
                        }
                        if (incoming.on_drain !== undefined) {
                            const chunk = incoming.buffer;
                            incoming.on_drain();
                            if (chunk === eof) {
                                dispose("EOF.");
                            }
                            return Promise.resolve(chunk);
                        }
                        return new Promise(function (resolve, reject) {
                            incoming.on_close = reject;
                            incoming.on_fill = function (chunk) {
                                delete incoming.on_fill;
                                delay(function () {
                                    resolve(chunk);
                                    if (chunk === eof) {
                                        dispose("EOF.");
                                    }
                                });
                            };
                        });
                    },
                    write(chunk) {
                        if (incoming.closed) {
                            return Promise.reject("Write failed, closed.");
                        }
                        if (chunk === eof) {
                            queue = queue.then(pause).then(function () {
                                write_chunk(chunk);
                            });
                        } else {

// Slice up the chunk into subchunks, so that they are read at different times.
// This exaggerates the simulated backpressure.

                            while (chunk.length > 0) {
                                const take = random_chunk_size();
                                const subchunk = chunk.slice(0, take);
                                chunk = chunk.slice(take);
                                queue = queue.then(
                                    pause
                                ).then(
                                    write_chunk.bind(undefined, subchunk)
                                );
                            }
                        }
                        return queue;
                    },
                    dispose
                });
            }

            listener_connection = make_connection(incoming, outgoing);
            connections.push(listener_connection);
            on_open(listener_connection);
            return make_connection(outgoing, incoming);
        };
        return function stop(reason) {
            delete listeners[address];
            connections.forEach(function (connection) {
                connection.dispose(reason);
            });
        };
    }

    function connect(address) {
        return pause().then(function () {
            if (flake() || listeners[address] === undefined) {
                return Promise.reject("Connect failed.");
            }
            return listeners[address]();
        });
    }

    return Object.freeze({listen, connect});
}

if (import.meta.main) {
    tcp_transport_demo(tcp_transport_mock(0.02), "bob", globalThis.console.log);
}

export default Object.freeze(tcp_transport_mock);
