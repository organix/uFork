// An in-memory signaller for use with the WebRTC transport.

/*jslint web, global */

function delay(callback, ...args) {
    const timer = setTimeout(callback, 500 * Math.random(), ...args);
    return function cancel() {
        clearTimeout(timer);
    };
}

function make_queue() {

// Signalling messages must be delivered in order, for example an offer must
// preceed a related ICE candidate.

    let array = [];

    function dequeue() {
        const [handler, ...args] = array.shift();
        handler(...args);
    }

    return function enqueue(handler, ...args) {
        array.push([handler, ...args]);
        delay(dequeue);
    };
}

function dummy_signaller() {
    const listeners = Object.create(null);
    const connectors = Object.create(null);
    let next_session_id = 0;

    function forward_to_listener(name, session_id, signal) {
        const on_receive_array = listeners[name];
        if (on_receive_array !== undefined) {
            on_receive_array.forEach(function (on_receive) {
                on_receive(session_id, signal);
            });
        }
    }

    function forward_to_connector(session_id, signal) {
        const on_receive = connectors[session_id];
        if (on_receive !== undefined) {
            on_receive(signal);
        }
    }

    function connect(name, _, on_receive) {
        return function connect_requestor(callback, offer) {
            delay(function () {
                const session_id = String(next_session_id);
                next_session_id += 1;
                connectors[session_id] = on_receive;
                const enqueue = make_queue();
                enqueue(
                    forward_to_listener,
                    name,
                    session_id,
                    offer
                );
                callback(Object.freeze({
                    send(signal) {
                        enqueue(
                            forward_to_listener,
                            name,
                            session_id,
                            signal
                        );
                    },
                    stop() {
                        delete connectors[session_id];
                    }
                }));
            });
        };
    }

    function listen(name, _, on_receive) {
        return function listen_requestor(callback) {
            delay(function () {
                if (listeners[name] === undefined) {
                    listeners[name] = [];
                }
                listeners[name].push(on_receive);
                const enqueue = make_queue();
                callback(Object.freeze({
                    send(session_id, signal) {
                        enqueue(
                            forward_to_connector,
                            session_id,
                            signal
                        );
                    },
                    stop() {
                        listeners[name] = listeners[name].filter(
                            function (element) {
                                return element !== on_receive;
                            }
                        );
                    }
                }));
            });
        };
    }

    return Object.freeze({connect, listen});
}

function demo(log) {
    let alice_connector;
    let bob_listener;
    const signaller = dummy_signaller();
    signaller.connect(
        "bob",
        undefined,
        function on_receive(message) {
            log("alice on_receive", message);
        }
    )(
        function (connector, reason) {
            log("alice connected", reason);
            alice_connector = connector;
            alice_connector.send({
                candidate: "Alice's ICE."
            });
        },
        {type: "offer", sdp: "Alice's offer."}
    );
    signaller.listen(
        "bob",
        undefined,
        function on_receive(session_id, message) {
            log("bob on_receive", session_id, message);
            if (message.type === "offer") {
                bob_listener.send(session_id, {
                    type: "answer",
                    sdp: "Bob's answer."
                });
            } else {
                bob_listener.send(session_id, {
                    candidate: "Bob's ICE."
                });
            }
        }
    )(function (listener, reason) {
        log("bob listening", reason);
        bob_listener = listener;
    });
    return function stop() {
        log("stopping");
        bob_listener.stop();
        alice_connector.stop();
    };
}

let stop;
if (import.meta.main) {
    stop = demo(globalThis.console.log);
    setTimeout(stop, 5000);
}
// stop();

export default Object.freeze(dummy_signaller);
