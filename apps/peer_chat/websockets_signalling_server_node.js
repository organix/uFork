// A Node.js port of the signalling server. See websockets_signalling_server.js
// for a description of the protocol.

// This module really should live in ../../vm/js, but since Node.js refuses to
// load modules over the network there is no benefit to hosting the source at
// https://ufork.org.

/*jslint node, browser, global */

import http from "node:http";
import websocketify from "./websocketify.js";

function websockets_signalling_server(http_server, on_error) {

// The ID of a listening connection is its name.
// The ID of a connecting connection is its session.

    let connections = Object.create(null);  // ID -> [connection]
    let undelivered = [];                   // {to_id, from_connection, message}
    let names = new WeakMap();              // connection -> ID
    let sessions = new WeakMap();           // connection -> session

    function deliver(to_id, from_connection, message) {
        let delivered = false;
        if (connections[to_id] !== undefined) {
            connections[to_id].forEach(function (connection) {
                delivered = true;
                connection.send(JSON.stringify(message));
            });
        }
        if (!delivered) {
            undelivered.push({to_id, from_connection, message});
        }
    }

    function fail(reason) {
        if (on_error !== undefined) {
            on_error(reason);
        }
    }

    function register(id, connection) {
        if (connections[id] === undefined) {
            connections[id] = [];
        }
        if (!connections[id].includes(connection)) {
            connections[id].push(connection);
        }
        names.set(connection, id);

// Check if there are any undelivered messages addressed to the new connection.
// If there are, send and forget them.

        undelivered = undelivered.filter(function (entry) {
            if (entry.to_id === id) {
                connection.send(JSON.stringify(entry.message));
                return false;
            }
            return true;
        });
    }

    function unregister(id, connection) {
        if (
            connections[id] !== undefined
            && connections[id].includes(connection)
        ) {
            connections[id] = connections[id].filter(function (element) {
                return element !== connection;
            });
            if (connections[id].length === 0) {
                delete connections[id];
            }
        }

// Drop any undelivered messages originating from this connection.

        undelivered = undelivered.filter(function (entry) {
            return entry.from_connection !== connection;
        });
    }

    websocketify(
        http_server,
        function on_open(connection, req) {
            try {
                const url = new URL(req.url, "http://dummy");
                const endpoint = url.pathname;
                const name = url.searchParams.get("name");
                if (endpoint === "/connect" && name) {
                    const session = crypto.randomUUID();
                    register(session, connection);
                    sessions.set(connection, session);
                    deliver(name, connection, {
                        session,
                        signal: JSON.parse(url.searchParams.get("signal"))
                    });
                }
                if (
                    endpoint === "/listen"
                    && name
                    && url.searchParams.get("password") === "uFork"
                ) {
                    register(name, connection);
                }
            } catch (reason) {
                fail(reason);
            }
        },
        function on_receive(connection, message) {
            try {
                const name = names.get(connection);
                const session = sessions.get(connection);
                const signal = JSON.parse(message);
                if (session) {
                    deliver(name, connection, {session, signal});
                } else if (connections[signal.session] !== undefined) {
                    deliver(signal.session, connection, signal.signal);
                }
            } catch (reason) {
                fail(reason);
            }
        },
        function on_close(connection, reason) {
            unregister(
                sessions.get(connection) ?? names.get(connection),
                connection
            );
            if (reason !== undefined) {
                fail(reason);
            }
        }
    );
}

// To run the demo with Replete:

//  1. Evaluate the whole file in Node.js (or Deno).
//  2. Evaluate the following code in a browser.

const hostname = "localhost";
const port = 4455;
const origin = "ws://" + hostname + ":" + port;

function browser_demo(log) {
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
        alice.close();
        bob_desktop.close();
        bob_mobile.close();
    };
}

function server_demo(log) {
    const server = http.createServer(function (req, res) {
        log("on_request", req.url);
        res.end();
    });
    websockets_signalling_server(server, function on_error(reason) {
        log("on_error", reason);
    });
    server.listen(port, hostname);
    return function stop() {
        server.close();
    };
}

let stop;
if (import.meta.main) {
    stop = (
        (
            globalThis.window !== undefined
            && globalThis.Deno === undefined
        )
        ? browser_demo(globalThis.console.log)
        : server_demo(globalThis.console.log)
    );
    setTimeout(stop, 5000);
}
// stop();

export default Object.freeze(websockets_signalling_server);
