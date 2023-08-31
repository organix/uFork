// Runs the distributed Grant Matcher demo on Node.js, using TLS to encrypt
// communications.

/*jslint node */

import crypto from "node:crypto";
import ufork from "../../www/ufork.js";
import parseq from "../../www/parseq.js";
import requestorize from "../../www/requestors/requestorize.js";
import awp_device from "../../www/devices/awp_device.js";
import host_device from "../../www/devices/host_device.js";
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
const alice = {
    name: transport.identity_to_name(alice_identity)
};
const bob = {
    name: transport.identity_to_name(bob_identity),
    address: bob_address
};
const carol = {
    name: transport.identity_to_name(carol_identity),
    address: carol_address
};
const dana = {
    name: transport.identity_to_name(dana_identity)
};
const stores = {
    alice: {
        identity: alice_identity,
        acquaintances: [alice, bob, carol]
    },
    bob: {
        identity: bob_identity,
        bind_info: bob_address,
        acquaintances: [bob]
    },
    carol: {
        identity: carol_identity,
        bind_info: carol_address,
        acquaintances: [carol]
    },
    dana: {
        identity: dana_identity,
        acquaintances: [dana, bob, carol]
    }
};
const store_name = process.argv[2];
const origin = "http://localhost:7273";
const asm_url = new URL(
    process.argv[3],
    origin + "/examples/grant_matcher/"
).href;
const core = ufork.make_core({
    wasm_url: origin + "/target/wasm32-unknown-unknown/debug/ufork_wasm.wasm",
    on_wakeup() {
        console.log(
            "IDLE",
            store_name,
            core.u_fault_msg(core.u_fix_to_i32(core.h_run_loop()))
        );
    },
    on_log: console.log,
    log_level: ufork.LOG_DEBUG
});
parseq.sequence([
    core.h_initialize(),
    core.h_import(asm_url),
    requestorize(function (asm_module) {
        const make_dynamic_device = host_device(core);
        awp_device({
            core,
            make_dynamic_device,
            transport,
            stores: [stores[store_name]],
            webscrypto: crypto.webcrypto
        });
        core.h_boot(asm_module.boot);
        return core.u_fault_msg(core.u_fix_to_i32(core.h_run_loop()));
    })
])(console.log);
