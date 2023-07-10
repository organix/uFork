// Runs the distributed Grant Matcher demo on Node.js, using TLS to encrypt
// communications.

/*jslint node */

import crypto from "node:crypto";
import ufork from "../../www/ufork.js";
import parseq from "../../www/parseq.js";
import lazy from "../../www/requestors/lazy.js";
import requestorize from "../../www/requestors/requestorize.js";
import debug_device from "../../www/devices/debug_device.js";
import awp_device from "../../www/devices/awp_device.js";
import node_tls_transport from "../../www/transports/node_tls_transport.js";

const transport = node_tls_transport();
const bob_address = {host: "localhost", port: 4001};
const carol_address = {host: "localhost", port: 4002};
const alice_identity = crypto.createPrivateKey(`-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIBe3+oTrkYxovSHOmjhrbCHQmv5h1qFOipXXlG5swzEW
-----END PRIVATE KEY-----`);
const bob_identity = crypto.createPrivateKey(`-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIN6VM5RlTK8uRHP2ZEmJCfUsXnGBF4RBF1jLrdWpt+4H
-----END PRIVATE KEY-----`);
const carol_identity = crypto.createPrivateKey(`-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIBsN+u2pWW58jJteLzvYpNy+cpsKzByJWBS21sCyMkTd
-----END PRIVATE KEY-----`);
const dana_identity = crypto.createPrivateKey(`-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEINTatAbnOgcatVHstpOCLskSHU5nogWEpe7fiDQUMZIF
-----END PRIVATE KEY-----`);
const acquaintances = [
    {
        name: transport.identity_to_name(bob_identity),
        address: bob_address
    },
    {
        name: transport.identity_to_name(carol_identity),
        address: carol_address
    }
];
const stores = {
    alice: {
        identity: alice_identity,
        name: transport.identity_to_name(alice_identity),
        acquaintances
    },
    bob: {
        identity: bob_identity,
        name: transport.identity_to_name(bob_identity),
        address: bob_address,
        bind_info: bob_address
    },
    carol: {
        identity: carol_identity,
        name: transport.identity_to_name(carol_identity),
        address: carol_address,
        bind_info: carol_address
    },
    dana: {
        identity: dana_identity,
        name: transport.identity_to_name(dana_identity),
        acquaintances
    }
};
const store_name = process.argv[2];
const origin = "http://localhost:7273";
const asm_url = new URL(
    process.argv[3],
    origin + "/examples/grant_matcher/"
).href;
let core;
parseq.sequence([
    ufork.instantiate_core(
        origin + "/target/wasm32-unknown-unknown/debug/ufork_wasm.wasm",
        function on_wakeup() {
            console.log(
                "IDLE",
                store_name,
                core.u_fault_msg(core.h_run_loop())
            );
        },
        console.log
    ),
    lazy(function (the_core) {
        core = the_core;
        return core.h_import(asm_url);
    }),
    requestorize(function (asm_module) {
        debug_device(core);
        awp_device(
            core,
            transport,
            [stores[store_name]],
            crypto.webcrypto
        );
        core.h_boot(asm_module.boot);
        return core.u_fault_msg(core.h_run_loop());
    })
])(console.log);
