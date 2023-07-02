// A signaller that acts as the intermediary between the WebRTC transport and
// the WebSockets signalling server.

/*jslint browser */

function websockets_signaller() {

    function connect(address, on_receive) {
        return function connect_requestor(callback, offer) {

            function resolve(value, reason) {
                if (callback !== undefined) {
                    callback(value, reason);
                    callback = undefined;
                }
            }

            try {
                let url = new URL(address);
                url.searchParams.set("signal", JSON.stringify(offer));
                const socket = new WebSocket(url);
                const connection = Object.freeze({
                    send(signal) {
                        socket.send(JSON.stringify(signal));
                    },
                    stop() {
                        socket.close();
                    }
                });
                socket.onopen = function () {
                    resolve(connection);
                };
                socket.onmessage = function (event) {
                    on_receive(JSON.parse(event.data));
                };
                socket.onclose = function (event) {
                    resolve(undefined, event.code);
                };
                return function cancel() {
                    if (callback !== undefined) {
                        socket.close();
                    }
                };
            } catch (exception) {
                return callback(undefined, exception);
            }
        };
    }

    function listen(bind_info, on_receive, on_fail) {
        return function listen_requestor(callback) {

            function resolve(value, reason) {
                if (callback !== undefined) {
                    callback(value, reason);
                    callback = undefined;
                }
            }

            try {
                const socket = new WebSocket(bind_info);
                const connection = Object.freeze({
                    send(session, signal) {
                        socket.send(JSON.stringify({session, signal}));
                    },
                    stop() {
                        socket.close();
                    }
                });
                socket.onopen = function () {
                    resolve(connection);
                };
                socket.onmessage = function (event) {
                    const {session, signal} = JSON.parse(event.data);
                    on_receive(session, signal);
                };
                socket.onclose = function (event) {
                    if (callback === undefined) {
                        if (typeof on_fail === "function") {
                            on_fail(event.code);
                        }
                    } else {
                        resolve(undefined, event.code);
                    }
                };
                return function cancel() {
                    if (callback !== undefined) {
                        callback = undefined;
                        on_fail = undefined;
                        socket.close();
                    }
                };
            } catch (exception) {
                return callback(undefined, exception);
            }
        };
    }

    return Object.freeze({connect, listen});
}

//debug const signaller = websockets_signaller();
//debug const bind_info = "ws://localhost:4455/listen?name=bob&password=uFork";
//debug const address = "ws://localhost:4455/connect?name=bob";
//debug let alice_connector;
//debug signaller.connect(address, function on_receive(message) {
//debug     console.log("alice on_receive", message);
//debug })(
//debug     function (connector, reason) {
//debug         if (connector === undefined) {
//debug             return console.log("alice failed", reason);
//debug         }
//debug         console.log("alice connected");
//debug         alice_connector = connector;
//debug         alice_connector.send({
//debug             candidate: "Alice's ICE."
//debug         });
//debug     },
//debug     {type: "offer", sdp: "Alice's offer."}
//debug );
//debug let bob_listener;
//debug signaller.listen(bind_info, function on_receive(session_id, message) {
//debug     console.log("bob on_receive", session_id, message);
//debug     if (message.type === "offer") {
//debug         bob_listener.send(session_id, {
//debug             type: "answer",
//debug             sdp: "Bob's answer."
//debug         });
//debug     } else {
//debug         bob_listener.send(session_id, {
//debug             candidate: "Bob's ICE."
//debug         });
//debug     }
//debug })(function (listener, reason) {
//debug     if (listener === undefined) {
//debug         return console.log("bob failed", reason);
//debug     }
//debug     console.log("bob listening");
//debug     bob_listener = listener;
//debug });
//debug // bob_listener.stop();
//debug // alice_connector.stop();

export default Object.freeze(websockets_signaller);
