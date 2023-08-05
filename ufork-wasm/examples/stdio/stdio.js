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
    const status = core.u_fix_to_i32(core.h_run_loop());
    if (status !== ufork.E_OK) {
        window.console.error("FAULT", core.u_fault_msg(status));
    }
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
