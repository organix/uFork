// A bridge server and client that communicate via WebSockets.
// The client runs on the browser and Deno, the server runs only on Deno.

// To maximize connectivity even when a client becomes unresponsive, the server
// accepts connections from any client and broadcasts messages to all of them.
// It does not differentiate between different clients.

/*jslint browser, deno, global */

import oed from "https://ufork.org/lib/oed.js";

function listen(hostname, port, session, on_message, on_open) {
    let sockets = [];
    const server = Deno.serve(
        {
            hostname,
            port,
            onListen() {
                return;
            }
        },
        function (request) {
            const request_session = new URL(request.url).pathname.slice(1);
            if (request_session !== session) {
                return new Response("", {status: 403});
            }
            const {socket, response} = Deno.upgradeWebSocket(request);
            socket.binaryType = "arraybuffer";
            socket.onopen = function () {
                sockets.push(socket);
                on_open();
            };
            socket.onmessage = function (event) {
                on_message(oed.decode(new Uint8Array(event.data)));
            };
            return response;
        }
    );
    return Object.freeze({
        send(message) {
            sockets.forEach(function (socket) {
                try {
                    socket.send(oed.encode(message));
                } catch (_) {}
            });
        },
        dispose() {
            sockets.forEach(function (socket) {
                try {
                    socket.close();
                } catch (_) {}
            });
            return server[Symbol.asyncDispose]();
        }
    });
}

function connect(url, on_message, on_connectivity) {

// The 'url' parameter of 'connect' should be a string like

//  ws[s]://<hostname>:<port>/<session>

    let socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    socket.onopen = function () {
        on_connectivity(true);
    };
    socket.onclose = function () {
        on_connectivity(false);
    };
    socket.onmessage = function (event) {
        on_message(oed.decode(new Uint8Array(event.data)));
    };
    return Object.freeze({
        send(message) {
            socket.send(oed.encode(message));
        },
        dispose() {
            socket.close();
        }
    });
}

function demo(log) {
    const hostname = "127.0.0.1";
    const port = 3377;
    const session = String(Math.random());
    const server = listen(
        hostname,
        port,
        session,
        function on_message(message) {
            log("server on_message", message);
        },
        function on_open() {
            log("server on_open");
            server.send({
                bytes: new Uint8Array([1, 2, 3])
            });
        }
    );
    const client = connect(
        `ws://${hostname}:${port}/${session}`,
        function on_message(message) {
            log("client on_message", message);
            client.send(message);
        },
        function on_connectivity(open) {
            log("client on_connectivity", open);
        }
    );
    const stale_session = String(Math.random());
    const stale_client = connect(
        `ws://${hostname}:${port}/${stale_session}`,
        function on_message(message) {
            log("stale_client on_message", message);
        },
        function on_connectivity(open) {
            log("stale_client on_connectivity", open);
        }
    );
    setTimeout(stale_client.dispose, 1000);
    setTimeout(server.dispose, 2000);
    setTimeout(client.dispose, 3000);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze({listen, connect});
