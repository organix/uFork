// An in-memory signaller for use with the WebRTC transport.

/*jslint browser */

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

    function connect(name, ignore, on_receive) {
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

    function listen(name, ignore, on_receive) {
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

//debug const signaller = dummy_signaller();
//debug let alice_connector;
//debug signaller.connect(
//debug     "bob",
//debug     undefined,
//debug     function on_receive(message) {
//debug         console.log("alice on_receive", message);
//debug     }
//debug )(
//debug     function (connector, reason) {
//debug         console.log("alice connected", reason);
//debug         alice_connector = connector;
//debug         alice_connector.send({
//debug             candidate: "Alice's ICE."
//debug         });
//debug     },
//debug     {type: "offer", sdp: "Alice's offer."}
//debug );
//debug let bob_listener;
//debug signaller.listen(
//debug     "bob",
//debug     undefined,
//debug     function on_receive(session_id, message) {
//debug         console.log("bob on_receive", session_id, message);
//debug         if (message.type === "offer") {
//debug             bob_listener.send(session_id, {
//debug                 type: "answer",
//debug                 sdp: "Bob's answer."
//debug             });
//debug         } else {
//debug             bob_listener.send(session_id, {
//debug                 candidate: "Bob's ICE."
//debug             });
//debug         }
//debug     }
//debug )(function (listener, reason) {
//debug     console.log("bob listening", reason);
//debug     bob_listener = listener;
//debug });
//debug // bob_listener.stop();
//debug // alice_connector.stop();

export default Object.freeze(dummy_signaller);
