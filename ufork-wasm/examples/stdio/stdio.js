// Runs a uFork program with its IO device hooked up to stdin and stdout.

/*jslint deno */

import ufork from "../../www/ufork.js";
import parseq from "../../www/parseq.js";
import lazy from "../../www/requestors/lazy.js";
import requestorize from "../../www/requestors/requestorize.js";
import io_device from "../../www/devices/io_device.js";
const wasm_url = import.meta.resolve(
    "../../target/wasm32-unknown-unknown/debug/ufork_wasm.wasm"
);
const asm_url = import.meta.resolve(
    "./echo.asm"
);

const utf8_encoder = new TextEncoder();
const stdin_buffer_size = 65536; // 64KB

let core;

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
            if (err === ufork.E_MEM_LIM
            ||  err === ufork.E_MSG_LIM
            ||  err === ufork.E_CPU_LIM) {
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

function refill() {
    // refill root-sponsor with resources
    const spn = core.u_ramptr(ufork.SPONSOR_OFS);
    const sponsor = core.u_read_quad(spn);
    sponsor.t = core.u_fixnum(4096);  // memory
    sponsor.x = core.u_fixnum(256);  // events
    sponsor.y = core.u_fixnum(8192);  // cycles
    core.u_write_quad(spn, sponsor);
}

parseq.sequence([
    ufork.instantiate_core(wasm_url, run, window.console.error, ufork.LOG_WARN),
    lazy(function (the_core) {
        core = the_core;
        return core.h_import(asm_url);
    }),
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
