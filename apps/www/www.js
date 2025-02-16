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
//      <bind_address> \
//      [<udbg_address>]

// where <src> is the relative path (or absolute URL) to a .asm or .hum module
// to boot from, <www_dir> is the root directory for the filesystem device, and
// <bind_address> is a string like "127.0.0.1:5887".

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
import make_core_driver from "https://ufork.org/js/udbg/core_driver.js";
import websockets_bridge from "https://ufork.org/js/udbg/websockets_bridge.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");

let bridge;
let core;
let driver;

const unqualified_src = Deno.args[0];
const www_dir_path = Deno.args[1];
const bind_address = Deno.args[2];
const udbg_address = Deno.args[3];
if (unqualified_src === undefined || unqualified_src === "") {
    globalThis.console.error("Missing src. Try \"static.asm\".");
    Deno.exit(1);
}
const cwd_dir = toFileUrl(join(Deno.cwd(), "./")); // ensure trailing slash
const src = new URL(unqualified_src, cwd_dir).href;

core = ufork.make_core({
    wasm_url,
    on_wakeup(device_offset) {
        driver.wakeup(device_offset);
    },
    on_audit: globalThis.console.error,
    on_log: globalThis.console.error,
    log_level: ufork.LOG_TRACE,
    compilers: {asm: assemble},
    import_map: {"https://ufork.org/lib/": lib_url}
});
driver = make_core_driver(core, function on_status(message) {
    bridge.send(message);
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
        driver.command({kind: "play"});
        return true;
    })
])(function (ok, reason) {
    if (ok === undefined) {
        globalThis.console.error(reason);
        Deno.exit(1);
    }
    if (udbg_address !== undefined) {
        const [udbg_hostname, udbg_port] = udbg_address.split(":");
        const udbg_session = ""; // persistent
        const udbg_url = `ws://${udbg_hostname}:${udbg_port}/${udbg_session}`;
        bridge = websockets_bridge.listen(
            udbg_hostname,
            udbg_port,
            udbg_session,
            function on_message(message) {
                driver.command(message);
            },
            function on_open() {
                globalThis.console.log("udbg connected");
            }
        );
        globalThis.console.log(`udbg listening at ${udbg_url}`);
    }
    globalThis.console.log("www listening at http://" + bind_address);
});
