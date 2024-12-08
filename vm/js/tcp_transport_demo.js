// Demonstrates a TCP transport.

/*jslint browser, global */

import concat_bytes from "https://ufork.org/lib/concat_bytes.js";
import hex from "https://ufork.org/lib/hex.js";

function random_size() {
    if (Math.random() < 0.05) {
        return 0;
    }
    return Math.floor(Math.random() * 1e3);
}

function pause() {
    return new Promise(function (resolve) {
        return setTimeout(resolve, Math.random() * 100);
    });
}

let queue = Promise.resolve();

function enqueue(task) {
    queue = queue.then(pause).then(task);
    return queue;
}

function unlucky() {
    return Math.random() < 0.07;
}

function tcp_transport_demo(transport, address) {
    let bob_connections = new WeakMap();
    let stop_bob = transport.listen(
        address,
        function on_open(connection) {
            globalThis.console.log("bob on_open");
            bob_connections.set(connection);
        },
        function on_receive(connection, bytes) {
            return enqueue(function task() {
                if (
                    stop_bob !== undefined
                    && bob_connections.has(connection)
                ) {
                    return connection.send(bytes);
                }
            });
        },
        function on_close(connection, reason) {
            globalThis.console.log("bob on_close", reason);
            bob_connections.delete(connection);
        }
    );
    const names = ["alice", "carol", "darren"];
    let close_array = names.map(function (name) {
        let sent = new Uint8Array(0);
        let received = new Uint8Array(0);
        let connection;

        function send_random_bytes() {
            let bytes = new Uint8Array(random_size());
            crypto.getRandomValues(bytes);
            globalThis.console.log(name, "sent", bytes.length, "bytes");
            sent = concat_bytes(sent, bytes);
            return connection.send(bytes);
        }

        return transport.connect(
            address,
            function on_open(the_connection) {
                globalThis.console.log(name, "on_open");
                connection = the_connection;
                send_random_bytes();
            },
            function on_receive(_, bytes) {
                received = concat_bytes(received, bytes);
                const sent_string = hex.encode(sent);
                const received_string = hex.encode(received);
                if (!sent_string.startsWith(received_string)) {
                    throw new Error(name + " FAIL");
                }
                if (unlucky()) {
                    return connection.close();
                }
                if (sent_string === received_string) {
                    return send_random_bytes();
                }
            },
            function on_close(_, reason) {
                globalThis.console.log(name, "on_close", reason);
            }
        );
    });
    enqueue(function russian_roulette() {
        if (stop_bob === undefined && close_array.length === 0) {
            return;
        }
        if (unlucky() && stop_bob !== undefined) {
            globalThis.console.log("stopping bob");
            stop_bob();
            stop_bob = undefined;
        }
        if (unlucky() && close_array.length > 0) {
            globalThis.console.log("closing", names[close_array.length - 1]);
            close_array.pop()();
        }
        enqueue(russian_roulette);
    });
}

export default Object.freeze(tcp_transport_demo);
