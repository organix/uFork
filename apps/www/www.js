// Runs a web server.

// Usage:

//  $ deno run \
//      --no-lock \
//      --allow-read=../..,<www_dir> \
//      --allow-write=<www_dir> \
//      --allow-net \
//      --allow-import \
//      tcp.js \
//      <src> \
//      <www_dir> \
//      <bind_address>

// where <src> is the relative path (or absolute URL) to a .asm or .hum module
// to boot from, <www_dir> is the root directory for the filesystem device, and
// <bind_address> defaults to 127.0.0.1:5887.

/*jslint deno, global */

import {join} from "https://deno.land/std@0.203.0/path/join.ts";
import {resolve} from "https://deno.land/std@0.203.0/path/resolve.ts";
import {toFileUrl} from "https://deno.land/std@0.203.0/path/to_file_url.ts";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import assemble from "https://ufork.org/lib/assemble.js";
import ufork from "https://ufork.org/js/ufork.js";
import random_dev from "https://ufork.org/js/random_dev.js";
import host_dev from "https://ufork.org/js/host_dev.js";
import blob_dev from "https://ufork.org/js/blob_dev.js";
import tcp_dev from "https://ufork.org/js/tcp_dev.js";
import tcp_transport_deno from "https://ufork.org/js/tcp_transport_deno.js";
import fs_dev from "https://ufork.org/js/fs_dev.js";
import fs_deno from "https://ufork.org/js/fs_deno.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");

let core;

function run() {
    while (true) {
        // run until there is no more work, or an error occurs
        const sig = core.h_run_loop(0);
        const err = ufork.fix_to_i32(sig);
        const msg = ufork.fault_msg(err);
        if (err === ufork.E_OK) {
            break;  // no more work to do, so we exit...
        }
        if (
            err === ufork.E_MEM_LIM
            || err === ufork.E_MSG_LIM
            || err === ufork.E_CPU_LIM
        ) {
            core.h_refill({memory: 4096, events: 256, cycles: 8192});
        } else {
            globalThis.console.error("FAULT", msg);
            break;  // report error, then exit...
        }
    }
}

const unqualified_src = Deno.args[0];
const www_dir_path = Deno.args[1];
const bind_address = Deno.args[2] ?? "127.0.0.1:5887";
if (unqualified_src === undefined || unqualified_src === "") {
    globalThis.console.error("Missing src. Try \"static.asm\".");
    Deno.exit(1);
}
const cwd_dir = toFileUrl(join(Deno.cwd(), "./")); // ensure trailing slash
const src = new URL(unqualified_src, cwd_dir).href;

core = ufork.make_core({
    wasm_url,
    on_wakeup: run,
    on_audit: globalThis.console.error,
    on_log: globalThis.console.error,
    log_level: ufork.LOG_TRACE,
    compilers: {asm: assemble},
    import_map: {"https://ufork.org/lib/": lib_url}
});
parseq.sequence([
    core.h_initialize(),
    core.h_import(src),
    requestorize(function (module) {
        const make_ddev = host_dev(core);
        random_dev(core);
        const the_blob_dev = blob_dev(core, make_ddev);
        tcp_dev(
            core,
            make_ddev,
            the_blob_dev,
            [bind_address],
            tcp_transport_deno()
        );
        fs_dev(
            core,
            make_ddev,
            the_blob_dev,
            toFileUrl(resolve(Deno.cwd(), www_dir_path)),
            fs_deno()
        );
        core.h_boot(module.boot);
        run();
        return true;
    })
])(function (ok, reason) {
    if (ok === undefined) {
        globalThis.console.error(reason);
        Deno.exit(1);
    }
    globalThis.console.log("Listening at " + bind_address);
});
