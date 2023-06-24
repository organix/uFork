// An in-memory signaller for use with the WebRTC transport.

/*jslint browser */

import hex from "../hex.js";

function delay(callback, ...args) {
    const timer = setTimeout(callback, 50 * Math.random(), ...args);
    return function cancel() {
        clearTimeout(timer);
    };
}

function dummy_signaller() {
    const registrations = Object.create(null);
    return function dummy_signaller_requestor(callback, spec) {

// Signalling messages must be delivered in order, for example an offer must
// preceed a related ICE candidate.

        let queue = [];

        function dequeue() {
            const [handler, ...args] = queue.shift();
            handler(...args);
        }

        function enqueue(handler, ...args) {
            queue.push([handler, ...args]);
            delay(dequeue);
        }

        const local_key = hex.encode(spec.name) + ":" + spec.address;
        const connection = Object.freeze({
            send(to, message) {
                const remote_key = hex.encode(to) + ":" + spec.address;
                enqueue(function () {
                    if (registrations[remote_key] !== undefined) {
                        registrations[remote_key].forEach(
                            (on_receive) => on_receive(spec.name, message)
                        );
                    }
                });
            },
            close() {
                registrations[local_key] = registrations[local_key].filter(
                    (on_receive) => on_receive !== spec.on_receive
                );
            }
        });

        delay(function () {
            if (registrations[local_key] === undefined) {
                registrations[local_key] = [];
            }
            registrations[local_key].push(spec.on_receive);
            callback(connection);
        });
    };
}

//debug const signaller_requestor = dummy_signaller();
//debug let bob_connection;
//debug signaller_requestor(
//debug     function (connection, ignore) {
//debug         console.log("bob connected");
//debug         bob_connection = connection;
//debug         bob_connection.send(new Uint8Array([1, 1]), "hi alice");
//debug     },
//debug     {
//debug         name: new Uint8Array([2, 2]),
//debug         on_receive(from, message) {
//debug             console.log("bob on_receive", from, message);
//debug         }
//debug     }
//debug );
//debug let alice_connection;
//debug signaller_requestor(
//debug     function (connection, ignore) {
//debug         console.log("alice connected");
//debug         alice_connection = connection;
//debug         alice_connection.send(new Uint8Array([2, 2]), "hi bob");
//debug     },
//debug     {
//debug         name: new Uint8Array([1, 1]),
//debug         on_receive(from, message) {
//debug             console.log("alice on_receive", from, message);
//debug         }
//debug     }
//debug );

export default Object.freeze(dummy_signaller);
