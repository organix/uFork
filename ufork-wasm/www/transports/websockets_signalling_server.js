// A Deno signalling server, for use with the WebSockets signaller.

/*jslint deno */

function websockets_signalling_server(
    listen_options,
    on_error,
    on_unhandled_request = function (ignore, respond_with) {
        return respond_with(new Response("Not found.", {status: 404}));
    }
) {
    const listener = Deno.listen(listen_options);
    let sockets = Object.create(null);

    function broadcast(to, from, message) {
        if (sockets[to] === undefined) {
            return;
        }
        sockets[to].forEach(function (socket) {

// The socket.onclose handler seems to be called some time after the socket is
// actually closed. This means that there is potential for an exception to be
// thrown here if 'send' is called on a connection that is thought to be open,
// but is actually closed.

// Until Deno fixes this issue, we silently drop the buffer if the socket is
// closed.

            if (socket.readyState !== 3) {
                socket.send(JSON.stringify({from, message}));
            }
        });
    }

    function fail(reason) {
        if (on_error !== undefined) {
            on_error(reason);
        }
    }

    (function wait_for_next_connection() {
        let http_conn;

        function handle_request(event) {
            if (!event) {
                return; // no more requests
            }
            http_conn.nextRequest().then(handle_request).catch(fail);
            const {request, respondWith} = event;
            if (request.headers.get("upgrade") !== "websocket") {
                return on_unhandled_request(request, respondWith);
            }
            const {socket, response} = Deno.upgradeWebSocket(request);
            const name = new URL(request.url).pathname.slice(1);
            if (sockets[name] === undefined) {
                sockets[name] = [];
            }

            function unregister() {
                if (sockets[name].includes(socket)) {
                    sockets[name] = sockets[name].filter(function (element) {
                        return element !== socket;
                    });
                    if (sockets[name].length === 0) {
                        delete sockets[name];
                    }
                }
            }

            socket.onopen = function () {
                sockets[name].push(socket);
            };
            socket.onmessage = function (event) {
                const {to, message} = JSON.parse(event.data);
                return broadcast(to, name, message);
            };
            socket.onclose = unregister;
            socket.onerror = unregister;
            return respondWith(response);
        }

        return listener.accept().then(function (tcp_connection) {
            wait_for_next_connection();
            http_conn = Deno.serveHttp(tcp_connection);
            return http_conn.nextRequest();
        }).then(
            handle_request
        ).catch(
            fail
        );
    }());
    return function stop() {
        listener.close();
    };
}

//debug const hostname = "127.0.0.1";
//debug const port = 4455;
//debug const url = "ws://" + hostname + ":" + port;
//debug websockets_signalling_server({hostname, port});
//debug const alice = new WebSocket(url + "/alice");
//debug alice.onopen = function () {
//debug     alice.send(JSON.stringify({
//debug         to: "bob",
//debug         message: "Hi Bob!"
//debug     }));
//debug };
//debug alice.onmessage = function (event) {
//debug     console.log("alice got mail", JSON.parse(event.data));
//debug };
//debug const bob_desktop = new WebSocket(url + "/bob");
//debug bob_desktop.onopen = function () {
//debug     bob_desktop.send(JSON.stringify({
//debug         to: "alice",
//debug         message: "Hi Alice!"
//debug     }));
//debug };
//debug bob_desktop.onmessage = function (event) {
//debug     console.log("bob desktop got mail", JSON.parse(event.data));
//debug };
//debug const bob_mobile = new WebSocket(url + "/bob");
//debug bob_mobile.onmessage = function (event) {
//debug     console.log("bob mobile got mail", JSON.parse(event.data));
//debug };
//debug // alice.close();
//debug // bob_desktop.close();
//debug // bob_mobile.close();

export default Object.freeze(websockets_signalling_server);
