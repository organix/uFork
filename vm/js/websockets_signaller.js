// A signaller that acts as the intermediary between the WebRTC transport and
// the WebSockets signalling server.

/*jslint browser, global */

import hex from "https://ufork.org/lib/hex.js";

function websockets_signaller() {

    function connect(name, address, on_receive) {
        return function connect_requestor(callback, offer) {

            function resolve(value, reason) {
                if (callback !== undefined) {
                    callback(value, reason);
                    callback = undefined;
                }
            }

            try {
                let url = new URL(address);
                url.pathname = "/connect";
                url.searchParams.set("name", hex.encode(name));
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

    function listen(name, bind_info, on_receive, on_fail) {
        return function listen_requestor(callback) {

            function resolve(value, reason) {
                if (callback !== undefined) {
                    callback(value, reason);
                    callback = undefined;
                }
            }

            try {
                let url = new URL(bind_info.origin);
                url.pathname = "/listen";
                url.searchParams.set("name", hex.encode(name));
                url.searchParams.set("password", bind_info.password);
                const socket = new WebSocket(url);
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

function demo(log) {
    let alice_connector;
    let bob_listener;
    const signaller = websockets_signaller();
    const origin = "ws://localhost:4455";
    const name = new TextEncoder().encode("bob");
    const address = origin;
    const bind_info = {
        origin,
        password: "uFork"
    };
    signaller.connect(name, address, function on_receive(message) {
        log("alice on_receive", message);
    })(
        function (connector, reason) {
            if (connector === undefined) {
                return log("alice failed", reason);
            }
            log("alice connected");
            alice_connector = connector;
            alice_connector.send({
                candidate: "Alice's ICE."
            });
        },
        {type: "offer", sdp: "Alice's offer."}
    );
    signaller.listen(
        name,
        bind_info,
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
        if (listener === undefined) {
            return log("bob failed", reason);
        }
        log("bob listening");
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

export default Object.freeze(websockets_signaller);
