/*jslint browser */

import hex from "../../www/hex.js";
import instantiate_core from "../../www/ufork.js";
import debug_device from "../../www/devices/debug_device.js";
import awp_device from "../../www/devices/awp_device.js";
import webrtc_transport from "../../www/transports/webrtc_transport.js";
import websockets_signaller from "../../www/transports/websockets_signaller.js";

function party(asm_url, acquaintance_names = []) {
    const pre = document.createElement("pre");
    document.body.append(pre);

    function print(...things) {
        things = things.map(function (thing) {
            return thing?.message ?? thing;
        });
        pre.textContent += "\n" + things.join(" ");
    }

    const signaller_url = (
        location.protocol === "https:"
        ? "wss://"
        : "ws://"
    ) + location.host;
    const transport = webrtc_transport(websockets_signaller(), print);
    transport.generate_identity(function (identity, reason) {
        if (identity === undefined) {
            return print(reason);
        }
        const name = transport.identity_to_name(identity);
        print("Name", hex.encode(name));
        let core;
        instantiate_core(
            import.meta.resolve(
                "../../target/wasm32-unknown-unknown/debug/ufork_wasm.wasm"
            ),
            function on_wake_up() {
                print("HALT:", core.u_fault_msg(core.h_run_loop()));
            },
            print
        ).then(function (the_core) {
            core = the_core;
            debug_device(core, function (...args) {
                print(...args);
                const div = document.createElement("div");
                div.textContent = "💸";
                div.style.fontSize = "100px";
                document.body.append(div);
            });
            awp_device(core, transport, [
                {
                    identity,
                    name,
                    address: signaller_url,
                    bind_info: signaller_url,
                    acquaintances: acquaintance_names.map(function (name) {
                        return {
                            name,
                            address: signaller_url
                        };
                    })
                }
            ]);
            return core.h_import(asm_url).then(function (asm_module) {
                core.h_boot(asm_module.boot);
                print("HALT:", core.u_fault_msg(core.h_run_loop()));
            });
        }).catch(
            print
        );
    });
}

export default Object.freeze(party);
