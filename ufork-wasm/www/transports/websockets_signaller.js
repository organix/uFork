// A signaller that acts as the intermediary between the WebRTC transport and
// the WebSockets signalling server.

/*jslint browser */

import hex from "../hex.js";

function websockets_signaller() {
    return function websockets_signaller_requestor(
        callback,
        {name, address, on_receive, on_close}
    ) {
        let socket;
        let connection;

        function resolve(value, reason) {
            if (callback !== undefined) {
                callback(value, reason);
                callback = undefined;
            }
        }

        try {
            socket = new WebSocket(address + "/" + hex.encode(name));
            socket.onopen = function () {
                connection = Object.freeze({
                    send(to, message) {
                        socket.send(JSON.stringify({
                            to: hex.encode(to),
                            message
                        }));
                    },
                    close() {
                        on_close = undefined;
                        socket.close();
                    }
                });
                resolve(connection);
            };
            socket.onmessage = function (event) {
                const {from, message} = JSON.parse(event.data);
                on_receive(hex.decode(from), message);
            };
            // TODO autoreconnect
            socket.onclose = function (event) {
                if (connection !== undefined) {
                    if (on_close !== undefined) {
                        on_close(event.code);
                        on_close = undefined;
                    }
                } else {
                    resolve(undefined, event.code);
                }
            };
            return function cancel() {
                if (connection === undefined) {
                    on_close = undefined;
                    socket.close();
                }
            };
        } catch (exception) {
            return resolve(undefined, exception);
        }
    };
}

//debug let bob_connection;
//debug websockets_signaller()(
//debug     function (connection, reason) {
//debug         if (connection === undefined) {
//debug             return console.log("bob failed", reason);
//debug         }
//debug         console.log("bob connected");
//debug         bob_connection = connection;
//debug         bob_connection.send(new Uint8Array([1, 1]), "hi alice");
//debug     },
//debug     {
//debug         name: new Uint8Array([2, 2]),
//debug         address: "ws://127.0.0.1:4455",
//debug         on_receive(from, message) {
//debug             console.log("bob on_receive", from, message);
//debug         },
//debug         on_close(reason) {
//debug             console.log("closed", reason);
//debug         }
//debug     }
//debug );
//debug let alice_connection;
//debug websockets_signaller()(
//debug     function (connection, reason) {
//debug         if (connection === undefined) {
//debug             return console.log("alice failed", reason);
//debug         }
//debug         console.log("alice connected");
//debug         alice_connection = connection;
//debug         alice_connection.send(new Uint8Array([2, 2]), "hi bob");
//debug     },
//debug     {
//debug         name: new Uint8Array([1, 1]),
//debug         address: "ws://127.0.0.1:4455",
//debug         on_receive(from, message) {
//debug             console.log("alice on_receive", from, message);
//debug         },
//debug         on_close(reason) {
//debug             console.log("closed", reason);
//debug         }
//debug     }
//debug );
//debug // alice_connection.close()
//debug // bob_connection.close()

export default Object.freeze(websockets_signaller);
