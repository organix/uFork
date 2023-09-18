// Runs a uFork program with its IO device hooked up to stdin and stdout.

// Usage:

//  $ deno run --allow-read=. examples/stdio/stdio.js <boot>

// where <boot> is the relative path (or absolute URL) to a .asm or .scm module
// to boot from.

/*jslint deno */

import {join} from "https://deno.land/std@0.201.0/path/join.ts";
import {toFileUrl} from "https://deno.land/std@0.201.0/path/to_file_url.ts";
import ufork from "../../www/ufork.js";
import parseq from "../../www/parseq.js";
import requestorize from "../../www/requestors/requestorize.js";
import io_device from "../../www/devices/io_device.js";
const wasm_url = import.meta.resolve(
    "../../target/wasm32-unknown-unknown/debug/ufork_wasm.wasm"
);

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
                window.console.error("FAULT", msg);
                break;  // report error, then exit...
            }
        } else {
            window.console.error("SIGNAL", core.u_print(sig));
            break;  // report signal, then exit...
        }
    }
}

const boot = Deno.args[0];
if (boot === undefined || boot === "") {
    window.console.error(
        "Missing boot specifier. Try \"examples/stdio/echo.asm\"."
    );
    Deno.exit(1);
}
const cwd_dir = toFileUrl(join(Deno.cwd(), "./")); // ensure trailing slash
const boot_url = new URL(boot, cwd_dir).href; // resolve specifier if relative

core = ufork.make_core({
    wasm_url,
    on_wakeup: run,
    on_log: window.console.error,
    log_level: ufork.LOG_WARN
});
parseq.sequence([
    core.h_initialize(),
    core.h_import(boot_url),
    requestorize(function (asm_module) {
        const on_stdin = io_device(core, function on_stdout(string) {
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
        window.console.error(reason);
        Deno.exit(1);
    }
});
