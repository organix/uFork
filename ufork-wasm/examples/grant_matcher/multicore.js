// Runs the distributed Grant Matcher demo using a multi-core configuration
// comprising several uFork cores running locally.

// Run it like

//  $ deno run --allow-read=. examples/grant_matcher/multicore.js

/*jslint deno */

import ufork from "../../www/ufork.js";
import parseq from "../../www/parseq.js";
import requestorize from "../../www/requestors/requestorize.js";
import awp_device from "../../www/devices/awp_device.js";
import host_device from "../../www/devices/host_device.js";
import memory_transport from "../../www/transports/memory_transport.js";
const wasm_url = import.meta.resolve("../../www/ufork.wasm");
const donor_url = import.meta.resolve("./donor.asm");
const gm_url = import.meta.resolve("./gm.asm");
const keqd_url = import.meta.resolve("./keqd.asm");

const transport = memory_transport();
const alice = {name: "alice"};
const bob = {name: "bob"};
const carol = {name: "carol"};
const dana = {name: "dana"};
const configurations = [
    {
        name: "bob",
        store: {
            identity: "bob",
            acquaintances: [bob]
        },
        asm_url: gm_url
    },
    {
        name: "carol",
        store: {
            identity: "carol",
            acquaintances: [carol]
        },
        asm_url: keqd_url
    },
    {
        name: "alice",
        store: {
            identity: "alice",
            acquaintances: [alice, bob, carol]
        },
        asm_url: donor_url
    },
    {
        name: "dana",
        store: {
            identity: "dana",
            acquaintances: [dana, bob, carol]
        },
        asm_url: donor_url
    }
];

// Instantiate a uFork core for each party. This must be done in sequence to
// ensure, for instance, Bob is listening when Carol attempts to connect.

parseq.sequence(
    configurations.map(function ({name, store, asm_url}) {
        const core = ufork.make_core({
            wasm_url,
            on_wakeup() {
                window.console.log("IDLE", name, core.u_fault_msg(
                    core.u_fix_to_i32(core.h_run_loop())
                ));
            },
            on_log: window.console.log,
            log_level: ufork.LOG_DEBUG
        });
        return parseq.sequence([
            core.h_initialize(),
            core.h_import(asm_url),
            requestorize(function (asm_module) {
                const make_dynamic_device = host_device(core);
                awp_device({
                    core,
                    make_dynamic_device,
                    transport,
                    stores: [store]
                });
                core.h_boot(asm_module.boot);
                return core.u_fault_msg(
                    core.u_fix_to_i32(core.h_run_loop())
                );
            })
        ]);
    })
)(window.console.log);
