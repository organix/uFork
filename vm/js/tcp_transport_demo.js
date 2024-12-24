// Demonstrates a TCP transport.

/*jslint web */

import concat_bytes from "https://ufork.org/lib/concat_bytes.js";
import hex from "https://ufork.org/lib/hex.js";

const eof = undefined;

function maybe(chance) {
    return Math.random() < chance;
}

function random_size() {
    return (
        maybe(0.05)
        ? 0
        : Math.floor(Math.random() * 1e3)
    );
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

function tcp_transport_demo(transport, address, log) {
    let stop_bob = transport.listen(address, function on_open(connection) {
        log("bob opened");
        connection.read().then(function on_read(bytes) {
            if (stop_bob === undefined) {
                return;
            }
            if (bytes === eof) {
                return log("bob read EOF");
            }
            if (maybe(0.1)) {
                log("bob write EOF");
                return connection.write(eof);
            }
            return Promise.all([
                connection.write(bytes),
                connection.read().then(on_read)
            ]);
        }).catch(function (reason) {
            log("bob failed", reason);
        });
    });
    const names = ["alice", "carol", "darren"];
    let dispose_array = [];
    names.forEach(function (name, name_nr) {
        let sent = new Uint8Array(0);
        let received = new Uint8Array(0);
        let connection;

        function write_random_bytes() {
            if (maybe(0.1)) {
                log(name, "write EOF");
                return connection.write(eof);
            }
            let bytes = new Uint8Array(random_size());
            crypto.getRandomValues(bytes);
            log(name, "wrote", bytes.length, "bytes");
            sent = concat_bytes(sent, bytes);
            return connection.write(bytes);
        }

        return transport.connect(address).then(function (the_connection) {
            dispose_array[name_nr] = the_connection.dispose;
            log(name, "opened");
            connection = the_connection;
            write_random_bytes().catch(function (reason) {
                log(name, "write failed", reason);
            });
            connection.read().then(function on_read(bytes) {
                if (bytes === eof) {
                    return log(name, "read EOF");
                }
                received = concat_bytes(received, bytes);
                const sent_string = hex.encode(sent);
                const received_string = hex.encode(received);
                if (!sent_string.startsWith(received_string)) {
                    throw new Error(name + " FAIL");
                }
                if (sent_string === received_string) {
                    log(name, "read ok");
                    write_random_bytes().catch(function (reason) {
                        log(name, "write failed", reason);
                    });
                }
                return connection.read().then(on_read);
            }).catch(function (reason) {
                log(name, "read failed", reason);
            });
        }).catch(function (reason) {
            log(name, "connect failed", reason);
        });
    });
    enqueue(function russian_roulette() {
        if (stop_bob === undefined && dispose_array.length === 0) {
            return;
        }
        if (maybe(0.04) && stop_bob !== undefined) {
            log("stopping bob");
            stop_bob("Stopped.");
            stop_bob = undefined;
        }
        if (maybe(0.04) && dispose_array.length > 0) {
            const dispose = dispose_array.pop();
            if (dispose !== undefined) {
                log("disposing", names[dispose_array.length]);
                dispose("Disposed.");
            }
        }
        enqueue(russian_roulette);
    });
}

export default Object.freeze(tcp_transport_demo);
