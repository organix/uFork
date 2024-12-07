// Demonstrates a filesystem implementation.

/*jslint web */

import parseq from "https://ufork.org/lib/parseq.js";
import bind from "https://ufork.org/lib/rq/bind.js";
import lazy from "https://ufork.org/lib/rq/lazy.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";

function random_file_name() {
    return "fs_demo_" + String(Math.random()).slice(2) + ".bin";
}

function fs_demo(fs, log) {
    const file_url = new URL("file:///tmp/" + random_file_name());
    return parseq.sequence([
        bind(fs.open(true), file_url),
        lazy(function (handle) {
            log("open(true)");
            return parseq.sequence([
                handle.read(50),
                requestorize(function (bytes) {
                    log("read", bytes);
                    return new Uint8Array([5, 6, 7, 8]);
                }),
                handle.write()
            ]);
        }),
        bind(fs.open(false), file_url),
        lazy(function (handle) {
            log("open(false)");
            return parseq.sequence([
                handle.read(2),
                bind(handle.write(), new Uint8Array([70])),
                handle.seek(4),
                bind(handle.write(), new Uint8Array([90, 100])),
                handle.seek(0),
                handle.read(100),
                requestorize(function check(bytes) {
                    log("read(100)", bytes);
                    if (
                        bytes.length !== 6
                        || bytes[0] !== 5
                        || bytes[1] !== 6
                        || bytes[2] !== 70
                        || bytes[3] !== 8
                        || bytes[4] !== 90
                        || bytes[5] !== 100
                    ) {
                        log("FAIL wrong bytes", bytes);
                    } else {
                        log("All tests passed.");
                    }
                    return true;
                }),
                handle.read(1) // EOF === false
            ]);
        })
    ])(log);
}

export default Object.freeze(fs_demo);
