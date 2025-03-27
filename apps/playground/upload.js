// Upload a uFork ROM to the Fomu over WebSerial.

/*jslint browser, global */

import parseq from "https://ufork.org/lib/parseq.js";
import bind from "https://ufork.org/lib/rq/bind.js";
import lazy from "https://ufork.org/lib/rq/lazy.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import xmodem from "https://ufork.org/lib/xmodem.js";
import hex from "https://ufork.org/lib/hex.js";

function until_fail(requestor, output) {

// Run a requestor repeatedly until it fails, then produce the 'output', or if
// that is undefined, the reason for failure.

    return function until_fail_requestor(callback, value) {
        requestor(function subcallback(subvalue, reason) {
            return (
                subvalue !== undefined
                ? requestor(subcallback, value)
                : callback(output ?? reason)
            );
        }, value);
    };
}

function unchunk(requestor) {

// Given a 'requestor' that produces array-like chunks, make a requestor that
// return each element of each chunk separately.

    let queue = [];
    return function unchunk_requestor(callback, value) {
        if (queue.length > 0) {
            return callback(queue.shift());
        }
        return requestor(function (subvalue, reason) {
            if (subvalue === undefined) {
                return callback(undefined, reason);
            }
            try {
                queue = Array.from(subvalue);
            } catch (exception) {
                return callback(undefined, exception);
            }
            if (subvalue.length === 0) {
                return callback(undefined, "Empty chunk.");
            }
            return unchunk_requestor(callback, value);
        }, value);
    };
}

function write(port) {

// Write a Uint8Array to an open SerialPort.

    return function write_requestor(callback, bytes) {
        let writer;

        function release() {
            try {
                writer.releaseLock();
            } catch (_) {}
        }

        try {
            writer = port.writable.getWriter();
            writer.write(bytes).then(function () {
                release();
                callback(bytes.length);
            }).catch(function (reason) {
                if (callback !== undefined) {
                    release();
                    callback(undefined, reason);
                }
            });
            return function cancel() {
                callback = undefined;
                release();
            };
        } catch (exception) {
            release();
            callback(undefined, exception);
        }
    };
}

function read(port) {

// Read a Uint8Array from an open SerialPort.

    return function read_requestor(callback) {
        let reader;

        function release() {
            try {
                reader.releaseLock();
            } catch (_) {}
        }

        try {
            reader = port.readable.getReader();
            reader.read().then(function ({value, done}) {
                release();
                if (done) {
                    callback(undefined, "Serial EOF");
                } else {
                    callback(value);
                }
            }).catch(function (reason) {
                if (callback !== undefined) {
                    release();
                    callback(undefined, reason);
                }
            });
            return function cancel() {
                callback = undefined;
                release();
            };
        } catch (exception) {
            release();
            callback(undefined, exception);
        }
    };
}

function read_with_timeout(port) {
    return lazy(function (timeout) {
        return parseq.sequence(
            [read(port)],
            timeout
        );
    });
}

function drain(port) {
    return until_fail(
        bind(read_with_timeout(port), 50),
        true
    );
}

const etx = 0x03;   // ^C
const lf = 0x0A;    // LF (linefeed)
const cr = 0x0D;    // CR (carriage return)

function get_monitor(port) {
    return parseq.sequence([
        drain(port),
        bind(write(port), new Uint8Array([cr])),
        bind(read_with_timeout(port), 50),
        function get_monitor_requestor(callback, bytes) {
            const string = new TextDecoder().decode(bytes);
            return (
                string === "\r\n> "

// This is the monitor prompt.

                ? callback(true)
                : (
                    string === "000D\r\n"

// Initially the device echoes back the hex encoding of each character it
// receives, one per line. To get the monitor, send ^C.

                    ? parseq.sequence([
                        bind(write(port), new Uint8Array([etx])),
                        drain(port)
                    ])(callback)
                    : callback(undefined, "Not monitor: " + string + " (" + Array.from(bytes).join(",") + ")")
                )
            );
        }
    ]);
}

function upload(port, file) {
    const input_requestor = unchunk(read_with_timeout(port));
    const output_requestor = write(port);
    const expect_packets = Math.ceil(file.length / 128);
    return parseq.sequence([
        get_monitor(port),
        bind(write(port), new TextEncoder().encode("x\r")),
        bind(xmodem.send(input_requestor, output_requestor), file),
        drain(port),
        bind(write(port), new TextEncoder().encode(".\r")),
        bind(read_with_timeout(port), 100),
        requestorize(function (bytes) {
            const hex_output = new TextDecoder().decode(bytes.slice(3, 7));
            const actual_packets = parseInt(hex_output, 16);
            if (actual_packets !== expect_packets) {
                throw new Error(
                    `Packet mismatch: ${actual_packets}/${expect_packets}`
                );
            }
            return actual_packets;
        })
    ]);
}

function open_port() {
    return navigator.serial.getPorts().then(function (ports) {
        return (
            ports.length === 0
            ? navigator.serial.requestPort()
            : ports[0]
        );
    }).then(function (port) {
        return (
            port.readable
            ? port
            : port.open({baudRate: 115200}).then(function () {
                return port;
            })
        );
    });
}

if (import.meta.main) {
    const button = document.createElement("button");
    button.textContent = "Connect";
    button.onclick = function () {
        open_port().then(function (port) {
            const file = new TextEncoder().encode("abcd".repeat(128));
            upload(port, file)(globalThis.console.log);
        });
    };
    document.body.append(button);
    button.onclick();
}

export default Object.freeze(upload);
