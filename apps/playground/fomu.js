// Utilities for uploading and running a uFork ROM on the Fomu, via WebSerial.

/*jslint browser, global */

import parseq from "https://ufork.org/lib/parseq.js";
import bind from "https://ufork.org/lib/rq/bind.js";
import lazy from "https://ufork.org/lib/rq/lazy.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import xmodem from "https://ufork.org/lib/xmodem.js";

function always(requestor) {

// Make a requestor always succeed. It will produce an object like {value} if it
// succeeds or {reason} if it fails.

    return function always_requestor(callback, input) {
        return requestor(function (value, reason) {
            return callback({value, reason});
        }, input);
    };
}

function until(requestor, predicate) {

// Repeatedly run 'requestor' until the output value satisfies the predicate, or
// it fails.

    return function until_requestor(callback, input) {
        return requestor(function subcallback(value, reason) {
            if (value === undefined) {
                return callback(undefined, reason);
            }
            if (predicate(value)) {
                return callback(value);
            }
            return requestor(subcallback, input);
        }, input);
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
    return until(
        always(bind(read_with_timeout(port), 50)),
        function predicate(result) {
            return result.value === undefined;
        }
    );
}

function command(port, string) {

// Issue a command to the monitor, producing the output bytes.

    let output_bytes = [];
    return parseq.sequence([
        bind(write(port), new TextEncoder().encode(string)),
        until(
            always(bind(read_with_timeout(port), 50)),
            function predicate(result) {
                const bytes = result.value;
                if (bytes !== undefined) {
                    if (new TextDecoder().decode(bytes).endsWith("> ")) {
                        output_bytes.push(...bytes.slice(0, -4));  // "\r\n> "
                        return true;
                    }
                    output_bytes.push(...bytes);
                }
                return false;
            }
        ),
        requestorize(() => new Uint8Array(output_bytes))
    ]);
}

function monitor(port) {

// Bring up the monitor.

    return parseq.sequence([
        drain(port),
        bind(write(port), new TextEncoder().encode("\r")),
        bind(read_with_timeout(port), 50),
        function monitor_requestor(callback, bytes) {
            const string = new TextDecoder().decode(bytes);
            return (
                string.endsWith("> ")

// This is the monitor prompt.

                ? callback(true)
                : (
                    string === "000D\r\n"

// Initially the device echoes back the hex encoding of each character it
// receives, one per line. To get the monitor, send ^C.

                    ? command(port, "\u0003")(callback)
                    : callback(undefined, (
                        "Not monitor: " + string
                        + " (" + Array.from(bytes).join(",") + ")"
                    ))
                )
            );
        }
    ]);
}

function upload(port, rom_bytes) {
    const input_requestor = unchunk(read_with_timeout(port));
    const output_requestor = write(port);
    const expect_packets = Math.ceil(rom_bytes.length / 128);
    return parseq.sequence([
        bind(write(port), new TextEncoder().encode("x\r")),
        bind(xmodem.send(input_requestor, output_requestor), rom_bytes),
        drain(port),
        command(port, ".\r"),
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

function boot(port) {

// Run the uFork core until idle, producing an array of 16-bit raws representing
// messages sent to the debug device.

    return parseq.sequence([
        command(port, "\u0003"),  // ^C
        requestorize(function (bytes) {
            return new TextDecoder().decode(bytes).split(
                "\r\n"
            ).filter(function (part) {
                return part.length > 0;
            }).map(function (part) {
                return parseInt(part, 16);
            });
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
            let rom_bytes = new Uint8Array(512).fill(0);
            let data_view = new DataView(rom_bytes.buffer);
            data_view.setUint16(0x80, 0x000B, false);   // #instr_t
            data_view.setUint16(0x82, 0x800F, false);   // +15 (VM_END)
            data_view.setUint16(0x84, 0x8001, false);   // +1 (commit)
            // data_view.setUint16(0x84, 0x8000, false);   // +0 (stop)
            data_view.setUint16(0x86, 0x0000, false);   // #?
            parseq.sequence([
                monitor(port),
                upload(port, rom_bytes),
                boot(port)
            ])(globalThis.console.log);
        });
    };
    document.body.append(button);
    button.onclick();
}

export default Object.freeze({monitor, upload, boot});
