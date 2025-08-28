// Runs a uFork program with its IO device hooked up to stdin and stdout.

// Usage:

//  $ deno run --allow-read=../.. stdio.js <src>

// where <src> is the relative path (or absolute URL) to a .asm or .scm module
// to boot from.

/*jslint deno, global */

import {join} from "https://deno.land/std@0.203.0/path/join.ts";
import {toFileUrl} from "https://deno.land/std@0.203.0/path/to_file_url.ts";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import assemble from "https://ufork.org/lib/assemble.js";
import scm from "https://ufork.org/lib/scheme.js";
import ufork from "https://ufork.org/js/ufork.js";
import make_core from "https://ufork.org/js/core.js";
import io_dev from "https://ufork.org/js/io_dev.js";
import make_core_driver from "https://ufork.org/js/udbg/core_driver.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");

let core;
let driver;
let utf8_encoder = new TextEncoder();

const unqualified_src = Deno.args[0];
if (unqualified_src === undefined || unqualified_src === "") {
    globalThis.console.error("Missing src. Try \"echo.asm\".");
    Deno.exit(1);
}
const cwd_dir = toFileUrl(join(Deno.cwd(), "./")); // ensure trailing slash
const src = new URL(unqualified_src, cwd_dir).href;
core = make_core({
    wasm_url,
    on_audit(...args) {
        driver.audit(...args);
    },
    on_log: globalThis.console.error,
    log_level: ufork.LOG_WARN,
    compilers: {asm: assemble, scm: scm.compile},
    import_map: {"https://ufork.org/lib/": lib_url}
});
driver = make_core_driver(core, function on_status(message) {
    if (message.kind === "audit") {
        globalThis.console.error("AUDIT", ufork.fault_msg(message.code));
    } else if (message.kind === "fault") {
        globalThis.console.error("FAULT", ufork.fault_msg(message.code));
    }
});
parseq.sequence([
    core.h_initialize(),
    core.h_import(src),
    requestorize(function () {
        const h_on_stdin = io_dev(core, function on_stdout(string) {
            Deno.stdout.write(utf8_encoder.encode(string));
        });
        let in_buffer = new Uint8Array(65536);
        (function read() {
            return Deno.stdin.read(in_buffer).then(function (nr_bytes) {
                if (!Number.isSafeInteger(nr_bytes)) {
                    return; // EOF
                }
                h_on_stdin(in_buffer.slice(0, nr_bytes));
                return read();
            });
        }());
        core.h_boot();
        driver.command({kind: "statuses", verbose: {audit: true, fault: true}});
        driver.command({kind: "play"});
        return true;
    })
])(function (ok, reason) {
    if (ok === undefined) {
        globalThis.console.error(reason);
        Deno.exit(1);
    }
});
