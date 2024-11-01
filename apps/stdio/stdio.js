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
import io_dev from "https://ufork.org/js/io_dev.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");

const utf8_encoder = new TextEncoder();
const stdin_buffer_size = 65536; // 64KB

let core;

function refill() {
    // refill root-sponsor with resources
    const spn = core.u_ramptr(ufork.SPONSOR_OFS);
    const sponsor = core.u_read_quad(spn);
    sponsor.t = core.u_fixnum(4096);  // memory
    sponsor.x = core.u_fixnum(256);  // events
    sponsor.y = core.u_fixnum(8192);  // cycles
    core.u_write_quad(spn, sponsor);
}

function run() {
    while (true) {
        // run until there is no more work, or an error occurs
        const sig = core.h_run_loop(0);
        if (core.u_is_fix(sig)) {
            const err = core.u_fix_to_i32(sig);
            const msg = core.u_fault_msg(err);
            if (err === ufork.E_OK) {
                break;  // no more work to do, so we exit...
            }
            if (
                err === ufork.E_MEM_LIM
                || err === ufork.E_MSG_LIM
                || err === ufork.E_CPU_LIM
            ) {
                refill();
            } else {
                globalThis.console.error("FAULT", msg);
                break;  // report error, then exit...
            }
        } else {
            globalThis.console.error("SIGNAL", core.u_print(sig));
            break;  // report signal, then exit...
        }
    }
}

const unqualified_src = Deno.args[0];
if (unqualified_src === undefined || unqualified_src === "") {
    globalThis.console.error("Missing src. Try \"echo.asm\".");
    Deno.exit(1);
}
const cwd_dir = toFileUrl(join(Deno.cwd(), "./")); // ensure trailing slash
const src = new URL(unqualified_src, cwd_dir).href;

core = ufork.make_core({
    wasm_url,
    on_wakeup: run,
    on_log: globalThis.console.error,
    log_level: ufork.LOG_WARN,
    compilers: {asm: assemble, scm: scm.compile},
    import_map: {"https://ufork.org/lib/": lib_url}
});
parseq.sequence([
    core.h_initialize(),
    core.h_import(src),
    requestorize(function (asm_module) {
        const on_stdin = io_dev(core, function on_stdout(string) {
            Deno.stdout.write(utf8_encoder.encode(string));
        });
        let in_buffer = new Uint8Array(stdin_buffer_size);
        (function read() {
            return Deno.stdin.read(in_buffer).then(function (nr_bytes) {
                if (!Number.isSafeInteger(nr_bytes)) {
                    return; // EOF
                }
                on_stdin(in_buffer.slice(0, nr_bytes));
                return read();
            });
        }());
        core.h_boot(asm_module.boot);
        run();
        return true;
    })
])(function (ok, reason) {
    if (ok === undefined) {
        globalThis.console.error(reason);
        Deno.exit(1);
    }
});
