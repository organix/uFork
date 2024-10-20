// Runs the distributed Grant Matcher demo on Node.js, using TLS to encrypt
// communications.

/*jslint node */

import console from "node:console";
import crypto from "node:crypto";
import fs from "node:fs";
import process from "node:process";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import assemble from "https://ufork.org/lib/assemble.js";
import ufork from "https://ufork.org/js/ufork.js";
import awp_dev from "https://ufork.org/js/awp_dev.js";
import host_dev from "https://ufork.org/js/host_dev.js";
import node_tls_transport from "https://ufork.org/js/node_tls_transport.js";
import import_map from "./import_map.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");
const asm_urls = {
    alice: import.meta.resolve("./donor.asm"),
    bob: import.meta.resolve("./gm.asm"),
    carol: import.meta.resolve("./keqd.asm"),
    dana: import.meta.resolve("./donor.asm")
};

// Node.js, as of v20, does not yet support the fetching of file:// URLs.
// Until it does, we polyfill the 'fetch' function used by ufork.js to load the
// WASM and assembly modules.

globalThis.fetch = function file_fetch(file_url) {
    return fs.promises.readFile(new URL(file_url)).then(function (buffer) {
        return new Response(buffer, (
            file_url.endsWith(".wasm")
            ? {headers: {"content-type": "application/wasm"}}
            : undefined
        ));
    });
};

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
const core = ufork.make_core({
    wasm_url,
    on_wakeup() {
        console.log(
            "IDLE",
            store_name,
            core.u_fault_msg(core.u_fix_to_i32(core.h_run_loop()))
        );
    },
    on_log: console.log,
    log_level: ufork.LOG_DEBUG,
    compilers: {asm: assemble},
    import_map
});
parseq.sequence([
    core.h_initialize(),
    core.h_import(asm_urls[store_name]),
    requestorize(function (asm_module) {
        const make_ddev = host_dev(core);
        awp_dev({
            core,
            make_ddev,
            transport,
            stores: [stores[store_name]],
            webscrypto: crypto.webcrypto
        });
        core.h_boot(asm_module.boot);
        return core.u_fault_msg(core.u_fix_to_i32(core.h_run_loop()));
    })
])(console.log);
