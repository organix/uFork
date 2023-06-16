// Runs the distributed Grant Matcher demo.

/*jslint node, long */

import {webcrypto} from "node:crypto";
import instantiate_core from "../www/ufork.js";
import debug_device from "../www/devices/debug_device.js";
import awp_device from "../www/devices/awp_device.js";
import node_tls_transport from "../www/devices/node_tls_transport.js";

const transport = node_tls_transport();
const bob_address = {host: "localhost", port: 4001};
const carol_address = {host: "localhost", port: 4002};
const alice_cert = "-----BEGIN CERTIFICATE-----\nMIIBlzCB+QIJAKdXgQPMUTS5MAoGCCqGSM49BAMCMBAxDjAMBgNVBAMMBXVmb3JrMB4XDTIzMDYxNTAxMzEzOVoXDTIzMDcxNTAxMzEzOVowEDEOMAwGA1UEAwwFdWZvcmswgZswEAYHKoZIzj0CAQYFK4EEACMDgYYABABAO06FL/42NDAfp8YFC7KZs0ArEM6ocluQe+u7IPkis0kl1O8/6B3FmnR7GfTXQubdc0EFcueKjMyR8D/JY9wDhQAqUjXzVIePzADbfo8vUjrPQ9TBzl+T85XjeBKbDiKZQb8QxeyYlqO246/XksSZJl0vn91gXTbBAR1ZgYeTPd44ljAKBggqhkjOPQQDAgOBjAAwgYgCQgHvlQMSDNJpJTT9/0PsiQIkI2Ui4fJpBDJr1fzYQgVMmnqx5Uvng9DHr1+AU7DDU9+2X1V2OaRsgJAymv1om/vz5wJCAKoHuyWggL9LGkTPUiUqm3dA/JS5dOnKGmdDEqMbEeiofFpt/joV8sdTAw2uigkliw+9vfLMLkJyr2sW3fjiWTBo\n-----END CERTIFICATE-----";
const alice_key = "-----BEGIN EC PRIVATE KEY-----\nMIHbAgEBBEFCXfqEm5o/WBTMWkHpyz4f+6xqJv7GF+AajgBkyRYMncp6lZInDOKk2aC6oNerZdcDTXnqZ/TKZl1z9OSPkwIsd6AHBgUrgQQAI6GBiQOBhgAEAEA7ToUv/jY0MB+nxgULspmzQCsQzqhyW5B767sg+SKzSSXU7z/oHcWadHsZ9NdC5t1zQQVy54qMzJHwP8lj3AOFACpSNfNUh4/MANt+jy9SOs9D1MHOX5PzleN4EpsOIplBvxDF7JiWo7bjr9eSxJkmXS+f3WBdNsEBHVmBh5M93jiW\n-----END EC PRIVATE KEY-----";
const bob_cert = "-----BEGIN CERTIFICATE-----\nMIIBlzCB+QIJAMfPBllRxdANMAoGCCqGSM49BAMCMBAxDjAMBgNVBAMMBXVmb3JrMB4XDTIzMDYxNTAxMjYzM1oXDTIzMDcxNTAxMjYzM1owEDEOMAwGA1UEAwwFdWZvcmswgZswEAYHKoZIzj0CAQYFK4EEACMDgYYABACCfQXDKhuHQUQIzpU2HsgZK1n5eziSRHu+/tl67Pso6mSNSiWdhDwObikaOplnFO10IdGaoflbWn+qV3tSXTMYTABd6K9nN7ki/8/Ppoz0It9cqLn60u3RHHPpgrcAEFHpNA/LqItP/t55f6XPArvnt0xIfxjaI4gdwb2uUfnzITruSTAKBggqhkjOPQQDAgOBjAAwgYgCQgEqJCq5FDRvWYC8dMhzzcObvMJJ4FriVRlaEPH94FV1eZIvWLhpSkpzh02+KfiwclO0YJVzGAh7tFEBFZ1U+0A1BAJCAZ9ugBLIqRZXOR+ndUIAs917W9Dw+imQkbiHlKdU8rhGZgA7r29VAfx3A7l+1BmXUrvQRBuU6BoBMxW2BRTQ4wQ1\n-----END CERTIFICATE-----";
const bob_key = "-----BEGIN EC PRIVATE KEY-----\nMIHbAgEBBEE8BpKem+dZRCbbI33kCwXCADskDId/WhAE7RFRttOnV0m2kxwkad/bDpd20I7dNdUSD5VRk0GsVQacoHtMxdsBlKAHBgUrgQQAI6GBiQOBhgAEAIJ9BcMqG4dBRAjOlTYeyBkrWfl7OJJEe77+2Xrs+yjqZI1KJZ2EPA5uKRo6mWcU7XQh0Zqh+Vtaf6pXe1JdMxhMAF3or2c3uSL/z8+mjPQi31youfrS7dEcc+mCtwAQUek0D8uoi0/+3nl/pc8Cu+e3TEh/GNojiB3Bva5R+fMhOu5J\n-----END EC PRIVATE KEY-----";
const carol_cert = "-----BEGIN CERTIFICATE-----\nMIIBlzCB+QIJAKXgK2B3FNUbMAoGCCqGSM49BAMCMBAxDjAMBgNVBAMMBXVmb3JrMB4XDTIzMDYxNTAxMDExNFoXDTIzMDcxNTAxMDExNFowEDEOMAwGA1UEAwwFdWZvcmswgZswEAYHKoZIzj0CAQYFK4EEACMDgYYABAD/K8/8lKykhrjH8R6VlEKg2leMjkxBZe/6mzzsymuvD9bn4kDsIj6wjRRaiErlcYisw8ZiJOKlGGAjrIU1ISzitACOZDZ50Xj63N6LQ8rpkoKmbDhWuoD1v0uClMr7IhjG26nsPiHjhJ5UB4FIY/gVu4cci/tkCPgNu4KQUnyYU1SgXTAKBggqhkjOPQQDAgOBjAAwgYgCQgHcMCYkwLybOyQ7ErtE5ucY2CjHStIJWOhgHD/RYrTX4uoXOVl2ISb7F4COQ8Xm1vepNvlWA9PfTbHjXopB6f2D+wJCAZ/Vzcnjsf8wSpm8x34uNYlvo0K+LZNFlQ7EuImKk33QbVR30KAS3y+Ok8yNAucg3Zh1243k09iCFLXmyclcUZgk\n-----END CERTIFICATE-----";
const carol_key = "-----BEGIN EC PRIVATE KEY-----\nMIHbAgEBBEErmNL2SxVE8Mi13BclwRfR1j/OWNDrt8fMXT8VTzVwfhFBV1XmIXRCB+s4VkQEQWfi69xgA1J1nz/4eWAOuieFoqAHBgUrgQQAI6GBiQOBhgAEAP8rz/yUrKSGuMfxHpWUQqDaV4yOTEFl7/qbPOzKa68P1ufiQOwiPrCNFFqISuVxiKzDxmIk4qUYYCOshTUhLOK0AI5kNnnRePrc3otDyumSgqZsOFa6gPW/S4KUyvsiGMbbqew+IeOEnlQHgUhj+BW7hxyL+2QI+A27gpBSfJhTVKBd\n-----END EC PRIVATE KEY-----";
const dana_cert = "-----BEGIN CERTIFICATE-----\nMIIBlzCB+QIJAPLWr8RQKQBGMAoGCCqGSM49BAMCMBAxDjAMBgNVBAMMBXVmb3JrMB4XDTIzMDYxNTAxMzIwOVoXDTIzMDcxNTAxMzIwOVowEDEOMAwGA1UEAwwFdWZvcmswgZswEAYHKoZIzj0CAQYFK4EEACMDgYYABAAGfk1CmCfXy63+jOA/S2HgjWiILtTI5R14khfnxzo17+CxdmgiVd3nBtlw8JSP7epZN79Bb+v8sstpBpXPsdJAsQCLEczVVhPA4s32qXM5cPqeua2hOeJAIWs2T2gmJY5NmMsWEksyWKAJRqyks/T37rrCbJXla6r5EtWkDi+zFwVFUDAKBggqhkjOPQQDAgOBjAAwgYgCQgFQMwTdOqg3jFTKcnKagjd6YAFVFsFPEVaZWkLFbpzb7PGOGu8mpB3MGp5381jFjIUK3TEZpvuH54AfWaajtBKCqwJCAdloA77rsAnqlFsz0buZ4nGXSu8eNokvztuDQcFoiCeNtke4NVSdbdclj3xa0LMbLj7ts1sDI/R4t2QT1T2XgFvm\n-----END CERTIFICATE-----";
const dana_key = "-----BEGIN EC PRIVATE KEY-----\nMIHbAgEBBEGdbH0ztVSCg/8231sFBl07WGdEt26fuMauXcU3Gp24luV+MwaegTDYG7M9CG7LrMvuZipiQPVOgai40b41RzNOjKAHBgUrgQQAI6GBiQOBhgAEAAZ+TUKYJ9fLrf6M4D9LYeCNaIgu1MjlHXiSF+fHOjXv4LF2aCJV3ecG2XDwlI/t6lk3v0Fv6/yyy2kGlc+x0kCxAIsRzNVWE8Dizfapczlw+p65raE54kAhazZPaCYljk2YyxYSSzJYoAlGrKSz9PfuusJsleVrqvkS1aQOL7MXBUVQ\n-----END EC PRIVATE KEY-----";
const acquaintances = [
    {
        name: transport.extract_public_key(bob_cert),
        address: bob_address
    },
    {
        name: transport.extract_public_key(carol_cert),
        address: carol_address
    }
];
const stores = {
    alice: {
        identity: {cert: alice_cert, key: alice_key},
        name: transport.extract_public_key(alice_cert),
        acquaintances
    },
    bob: {
        identity: {cert: bob_cert, key: bob_key},
        name: transport.extract_public_key(bob_cert),
        address: bob_address,
        bind_info: bob_address
    },
    carol: {
        identity: {cert: carol_cert, key: carol_key},
        name: transport.extract_public_key(carol_cert),
        address: carol_address,
        bind_info: carol_address
    },
    dana: {
        identity: {cert: dana_cert, key: dana_key},
        name: transport.extract_public_key(dana_cert),
        acquaintances
    }
};
const store_name = process.argv[2];
const asm_url = new URL(process.argv[3], "http://localhost:7273/gm/").href;
instantiate_core(
    "http://localhost:7273/target/wasm32-unknown-unknown/debug/ufork_wasm.wasm",
    console.log
).then(function (core) {
    function resume() {
        console.log("HALT", store_name, core.u_fault_msg(core.h_run_loop()));
    }
    debug_device(core);
    awp_device(core, resume, transport, [stores[store_name]], webcrypto);
    return core.h_import(asm_url).then(function (asm_module) {
        core.h_boot(asm_module.boot);
        resume();
    });
});
