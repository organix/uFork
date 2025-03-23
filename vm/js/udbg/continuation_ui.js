// Visualize the actors within a uFork core.

/*jslint browser, global */

import assemble from "https://ufork.org/lib/assemble.js";
import dom from "https://ufork.org/lib/dom.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import split_ui from "https://ufork.org/lib/split_ui.js";
import theme from "https://ufork.org/lib/theme.js";
import make_ui from "https://ufork.org/lib/ui.js";
import make_core_driver from "./core_driver.js";
import ufork from "../ufork.js";
import make_core from "../core.js";
import raw_ui from "./raw_ui.js";
import source_monitor_ui from "./source_monitor_ui.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");

const continuation_ui = make_ui("continuation-ui", function (element, {
    ram = new Uint8Array(),
    rom = new Uint8Array(),
    rom_debugs = Object.create(null),
    module_texts = Object.create(null)
}) {
    const source_element = source_monitor_ui({});
    const details_element = dom("continuation_details");
    details_element.style.background = theme.black;
    details_element.style.padding = "12px";
    details_element.style.overflowY = "auto";
    details_element.style.contain = "strict";

    function invalidate() {
        details_element.innerHTML = "";
        details_element.append(dom(
            "h1",
            {
                style: {
                    fontFamily: theme.proportional_font_family,
                    color: theme.white,
                    margin: "0 0 12px"
                }
            },
            "Continuation"
        ));
        const dd_quad = ufork.read_quad(ram, ufork.DDEQUE_OFS);
        if (dd_quad !== undefined) {
            const k_first = dd_quad.y;
            details_element.append(raw_ui({
                value: k_first,
                depth: 1,
                expand: [[1], [2, 1, 2], [2, 1, 3], [2, 2]],
                ram,
                rom,
                rom_debugs
            }));
            if (ufork.in_mem(k_first)) {
                const k_quad = ufork.read_quad(ram, ufork.rawofs(k_first));
                const ip = k_quad.t;
                const debug = rom_debugs[ufork.rawofs(ip)];
                const text = module_texts[debug?.src];
                return source_element.set_sourcemap({debug, text});
            }
        }
        source_element.set_sourcemap(undefined);
    }

    function set_ram(new_ram) {
        ram = new_ram;
        invalidate();
    }

    function set_rom(new_rom, new_rom_debugs, new_module_texts) {
        rom = new_rom;
        rom_debugs = new_rom_debugs;
        module_texts = new_module_texts;
        invalidate();
    }

    const split_element = dom(
        split_ui({
            placement: "right",
            divider_color: theme.gray,
            size: 0,  // set on connect
            divider_width: "3px"
        }),
        {style: {width: "100%", height: "100%"}},
        [
            dom(source_element, {slot: "main"}),
            dom(details_element, {slot: "peripheral"})
        ]
    );
    element.append(split_element);
    set_ram(ram);
    set_rom(rom, rom_debugs, module_texts);
    element.set_ram = set_ram;
    element.set_rom = set_rom;
    return {
        connect() {
            if (split_element.get_size() === 0) {
                split_element.set_size(Math.min(
                    420,
                    0.8 * element.clientWidth
                ));
            }
        }
    };
});

function demo(log) {
    document.documentElement.innerHTML = "";
    const element = continuation_ui({});
    element.style.position = "fixed";
    element.style.inset = "0";
    const core = make_core({
        wasm_url,
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble}
    });
    const driver = make_core_driver(core, function on_status(message) {
        if (message.kind === "ram") {
            element.set_ram(message.bytes);
        } else if (message.kind === "rom") {
            element.set_rom(
                message.bytes,
                message.debugs,
                message.module_texts
            );
        } else {
            log(message);
        }
    });
    parseq.sequence([
        core.h_initialize(),
        core.h_import("https://ufork.org/lib/fork.asm"),
        requestorize(function () {
            core.h_boot();
            driver.command({kind: "subscribe", topic: "rom"});
            driver.command({kind: "subscribe", topic: "ram"});
            driver.command({kind: "play", steps: 5});
            return true;
        })
    ])(log);
    document.head.append(dom("style", theme.monospace_font_css));
    document.body.append(element);
    document.body.onkeydown = function (event) {
        if (event.key === "s") {
            driver.command({kind: "play", steps: 1});
        }
    };
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(continuation_ui);
