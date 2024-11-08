// A Deno signalling server, for use with the WebSockets signaller. It exposes
// two WebSockets endpoints:

// /listen?name=<name>&password=uFork

//      A session ID is generated, uniquely identifying each WebSocket
//      connection. Each WebSocket message is an object like {session, signal}.

//      Accept offers.

//          ↓ {session: "abcd", signal: {type: "offer", sdp: "..."}}

//      Send answers.

//          ↑ {session: "abcd", signal: {type: "answer", sdp: "..."}}

//      Exchange ICE candidates.

//          ↓ {session: "abcd", signal: {candidate: ...}}
//          ↑ {session: "abcd", signal: {candidate: ...}}

//      It is possible for the signalling server to authenticate a listener's
//      fingerprint, but that requires a WebRTC connection to be established
//      with the server. This is not a trivial measure, and would introduce
//      significant latency. For now, the listener simply provides a password.

// /connect?name=<name>&signal=<json>

//      Send an offer, accept the answer, and exchange ICE candidates.

//      Each WebSocket message is a signal. Including the offer in the URL saves
//      a round trip.

//          ↓ {type: "answer", sdp: "..."}
//          ↑ {candidate: ...}
//          ↓ {candidate: ...}

//      Signals addressed to unknown peers are buffered for the lifetime of the
//      sender's connection, just in case the peer begins listening at a later
//      time.

// Below are some sample signals.

//      {
//          type: "offer",
//          sdp: "v=0\r\no=- 529332133664224217 2 IN IP4 127.0.0.1\r\ns=..."
//      }

//      {
//          type: "answer",
//          sdp: "v=0\r\no=- 1274852108352546059 2 IN IP4 127.0.0.1\r\ns..."
//      }

//      {
//          candidate: "candidate:1738336813 1 udp 2113937151 45a1e012-5...",
//          sdpMid: "0",
//          sdpMLineIndex: 0,
//          usernameFragment: "7SPZ"
//      }

/*jslint deno, global */

function websockets_signalling_server(
    listen_options,
    on_error,
    on_unhandled_request = function (_, respond_with) {
        return respond_with(new Response("Not found.", {status: 404}));
    }
) {

// The ID of a listening socket is its name.
// The ID of a connecting socket is its session.

    let sockets = Object.create(null);  // ID -> [WebSocket]
    let undelivered = [];               // {to_id, from_socket, message}

    function deliver(to_id, from_socket, message) {
        let delivered = false;
        if (sockets[to_id] !== undefined) {
            sockets[to_id].forEach(function (socket) {

// The socket.onclose handler seems to be called some time after the socket is
// actually closed. This means that there is potential for an exception to be
// thrown here if 'send' is called on a connection that is thought to be open,
// but is actually closed.

// Until Deno fixes this issue, we silently drop the message if the socket is
// closed.

                if (socket.readyState === 1) {
                    delivered = true;
                    socket.send(JSON.stringify(message));
                }
            });
        }
        if (!delivered) {
            undelivered.push({to_id, from_socket, message});
        }
    }

    function fail(reason) {
        if (on_error !== undefined) {
            on_error(reason);
        }
    }

    function register(id, socket) {
        if (sockets[id] === undefined) {
            sockets[id] = [];
        }
        if (!sockets[id].includes(socket)) {
            sockets[id].push(socket);
        }
        if (socket.readyState === 1) {

// Check if there are any undelivered messages addressed to the new socket. If
// there are, send and forget them.

            undelivered = undelivered.filter(function (entry) {
                if (entry.to_id === id) {
                    socket.send(JSON.stringify(entry.message));
                    return false;
                }
                return true;
            });
        }
    }

    function unregister(id, socket) {
        if (sockets[id] !== undefined && sockets[id].includes(socket)) {
            sockets[id] = sockets[id].filter(function (element) {
                return element !== socket;
            });
            if (sockets[id].length === 0) {
                delete sockets[id];
            }
        }

// Drop any undelivered messages originating from this socket.

        undelivered = undelivered.filter(function (entry) {
            return entry.from_socket !== socket;
        });
    }

    const listener = Deno.listen(listen_options);
    (function wait_for_next_connection() {
        let http_conn;
        return listener.accept().then(function (tcp_connection) {
            wait_for_next_connection();
            http_conn = Deno.serveHttp(tcp_connection);
            return http_conn.nextRequest();
        }).then(function handle_request(event) {
            if (!event) {
                return; // no more requests
            }
            http_conn.nextRequest().then(handle_request).catch(fail);
            const {request, respondWith} = event;
            if (request.headers.get("upgrade") !== "websocket") {
                return on_unhandled_request(request, respondWith);
            }
            const {socket, response} = Deno.upgradeWebSocket(request);
            const url = new URL(request.url);
            const endpoint = new URL(request.url).pathname;
            const name = url.searchParams.get("name");
            if (endpoint === "/connect" && name) {
                const session = crypto.randomUUID();
                register(session, socket);
                deliver(name, socket, {
                    session,
                    signal: JSON.parse(url.searchParams.get("signal"))
                });
                socket.onopen = function () {
                    register(session, socket); // send undelivered messages
                };
                socket.onmessage = function (event) {
                    deliver(name, socket, {
                        session,
                        signal: JSON.parse(event.data)
                    });
                };
                socket.onclose = function () {
                    unregister(session, socket);
                };
                socket.onerror = function () {
                    unregister(session, socket);
                };
                return respondWith(response);
            }
            if (
                endpoint === "/listen"
                && name
                && url.searchParams.get("password") === "uFork"
            ) {
                socket.onopen = function () {
                    register(name, socket);
                };
                socket.onmessage = function (event) {
                    const message = JSON.parse(event.data);

// Ignore the message if it is destined for an unrecognized session.

                    if (sockets[message.session] !== undefined) {
                        deliver(message.session, socket, message.signal);
                    }
                };
                socket.onclose = function () {
                    unregister(name, socket);
                };
                socket.onerror = function () {
                    unregister(name, socket);
                };
                return respondWith(response);
            }
            return http_conn.close();
        }).catch(
            fail
        );
    }());
    return function stop() {
        on_error = undefined;
        listener.close();
    };
}

function demo(log) {
    const hostname = "localhost";
    const port = 4455;
    const origin = "ws://" + hostname + ":" + port;
    const stop_server = websockets_signalling_server(
        {hostname, port},
        function (reason) {
            log("Signalling server error", reason);
        }
    );
    const alice = new WebSocket(
        origin + "/connect?name=bob&signal=\"ALICE OFFER\""
    );
    alice.onopen = function () {
        alice.send(JSON.stringify("ICE"));
    };
    alice.onmessage = function (event) {
        log("alice got mail", JSON.parse(event.data));
    };
    const bob_desktop = new WebSocket(
        origin + "/listen?name=bob&password=uFork"
    );
    bob_desktop.onmessage = function (event) {
        const {session, signal} = JSON.parse(event.data);
        log("bob desktop got mail", signal);
        bob_desktop.send(JSON.stringify({
            session,
            signal: "BOB DESKTOP ANSWER"
        }));
    };
    const bob_mobile = new WebSocket(
        origin + "/listen?name=bob&password=uFork"
    );
    bob_mobile.onmessage = function (event) {
        const {session, signal} = JSON.parse(event.data);
        log("bob mobile got mail", signal);
        bob_mobile.send(JSON.stringify({
            session,
            signal: "BOB MOBILE ANSWER"
        }));
    };
    return function stop() {
        log("stopping");
        alice.close();
        bob_desktop.close();
        bob_mobile.close();
        stop_server();
    };
}

let stop;
if (import.meta.main) {
    stop = demo(globalThis.console.log);
    setTimeout(stop, 2000);
}
// stop();

export default Object.freeze(websockets_signalling_server);
