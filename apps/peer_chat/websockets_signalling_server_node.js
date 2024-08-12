// A Node.js port of the signalling server. See websockets_signalling_server.js
// for a description of the protocol.

// This module really should live in ../../vm/js, but Node.js refuses to load
// modules over the network so there is no benefit to hosting the source at
// https://ufork.org.

/*jslint node, deno, browser */

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

// Run just this part of the demo in the browser.

//debug const hostname = "localhost";
//debug const port = 4455;
//debug const origin = "ws://" + hostname + ":" + port;
//debug const browser = typeof window === "object" && typeof Deno !== "object";
//debug if (browser) {
//debug     const alice = new WebSocket(
//debug         origin + "/connect?name=bob&signal=\"ALICE OFFER\""
//debug     );
//debug     alice.onopen = function () {
//debug         alice.send(JSON.stringify("ICE"));
//debug     };
//debug     alice.onmessage = function (event) {
//debug         console.log("alice got mail", JSON.parse(event.data));
//debug     };
//debug     const bob_desktop = new WebSocket(
//debug         origin + "/listen?name=bob&password=uFork"
//debug     );
//debug     bob_desktop.onmessage = function (event) {
//debug         const {session, signal} = JSON.parse(event.data);
//debug         console.log("bob desktop got mail", signal);
//debug         bob_desktop.send(JSON.stringify({
//debug             session,
//debug             signal: "BOB DESKTOP ANSWER"
//debug         }));
//debug     };
//debug     const bob_mobile = new WebSocket(
//debug         origin + "/listen?name=bob&password=uFork"
//debug     );
//debug     bob_mobile.onmessage = function (event) {
//debug         const {session, signal} = JSON.parse(event.data);
//debug         console.log("bob mobile got mail", signal);
//debug         bob_mobile.send(JSON.stringify({
//debug             session,
//debug             signal: "BOB MOBILE ANSWER"
//debug         }));
//debug     };
//debug     // alice.close();
//debug     // bob_desktop.close();
//debug     // bob_mobile.close();
//debug }

// Run the whole demo in Node.js.

//debug import http from "node:http";
//debug const server = http.createServer(function (req, res) {
//debug     console.log("on_request", req.url);
//debug     res.end();
//debug });
//debug websockets_signalling_server(server, function on_error(reason) {
//debug     console.log("on_error", reason);
//debug });
//debug server.listen(port, hostname);

export default Object.freeze(websockets_signalling_server);
