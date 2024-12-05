// Demonstrates a TCP transport.

/*jslint browser, devel */

import hex from "https://ufork.org/lib/hex.js";

function concat_bytes(a, b) {
    let array = new Uint8Array(a.byteLength + b.byteLength);
    array.set(a, 0);
    array.set(b, a.byteLength);
    return array;
}

function random_size() {
    if (Math.random() < 0.05) {
        return 0;
    }
    return Math.floor(Math.random() * 1e3);
}

let queue = [];

function next() {
    setTimeout(
        function () {
            const callback = queue.shift();
            if (callback !== undefined) {
                callback();
                return next();
            }
        },
        Math.random() * 100
    );
}

function enqueue(callback) {
    queue.push(callback);
    if (queue.length === 1) {
        next();
    }
}

function transport_demo(transport, address) {
    let bob_connections = new WeakMap();
    let stop_bob = transport.listen(
        address,
        function on_open(connection) {
            console.log("bob on_open");
            bob_connections.set(connection);
        },
        function on_receive(connection, bytes) {
            enqueue(function () {
                if (
                    stop_bob !== undefined
                    && bob_connections.has(connection)
                ) {
                    connection.send(bytes);
                }
            });
        },
        function on_close(connection, reason) {
            console.log("bob on_close", reason);
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
            console.log(name, "sent", bytes.length, "bytes");
            sent = concat_bytes(sent, bytes);
            connection.send(bytes);
        }

        return transport.connect(
            address,
            function on_open(the_connection) {
                console.log(name, "on_open");
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
                if (Math.random < 0.05) {
                    return connection.close();
                }
                if (sent_string === received_string) {
                    send_random_bytes();
                }
            },
            function on_close(_, reason) {
                console.log(name, "on_close", reason);
            }
        );
    });

    function unlucky() {
        return Math.random() < 0.07;
    }

    enqueue(function russian_roulette() {
        if (stop_bob === undefined && close_array.length === 0) {
            return;
        }
        if (unlucky() && stop_bob !== undefined) {
            console.log("stopping bob");
            stop_bob();
            stop_bob = undefined;
        }
        if (unlucky() && close_array.length > 0) {
            console.log("closing", names[close_array.length - 1]);
            close_array.pop()();
        }
        return enqueue(russian_roulette);
    });
}

export default Object.freeze(transport_demo);
