// Visualize the current continuation of a uFork core.

/*jslint browser, global */

import assemble from "https://ufork.org/lib/assemble.js";
import dom from "https://ufork.org/lib/dom.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import split_ui from "https://ufork.org/lib/split_ui.js";
import theme from "https://ufork.org/lib/theme.js";
import make_ui from "https://ufork.org/lib/ui.js";
import ufork from "../ufork.js";
import make_core from "../core.js";
import make_core_driver from "./core_driver.js";
import audit_ui from "./audit_ui.js";
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
    let audit;
    const source = source_monitor_ui({});
    const details = dom("continuation_details");
    details.style.color = "white";
    details.style.background = theme.black;
    details.style.padding = "12px";
    details.style.overflowY = "auto";
    details.style.contain = "strict";
    details.style.display = "flex";
    details.style.flexDirection = "column";
    details.style.gap = "12px";

    function invalidate() {
        if (!element.isConnected) {
            return;
        }
        details.innerHTML = "";
        if (audit !== undefined) {
            details.append(audit_ui({
                code: audit.code,
                evidence: audit.evidence,
                ram,
                rom,
                rom_debugs
            }));
        }
        details.append(dom(
            "h1",
            {
                style: {
                    fontFamily: theme.proportional_font_family,
                    margin: "0"
                }
            },
            "Continuation"
        ));
        const dd_quad = ufork.read_quad(ram, ufork.DDEQUE_OFS);
        if (dd_quad !== undefined) {
            const k_first = dd_quad.y;
            details.append(raw_ui({
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
                return source.set_sourcemap({debug, text});
            }
        }
        source.set_sourcemap(undefined);
    }

    function set_audit(new_audit) {
        audit = new_audit;
        invalidate();
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
            dom(source, {slot: "main"}),
            dom(details, {slot: "peripheral"})
        ]
    );
    element.append(split_element);
    set_ram(ram);
    set_rom(rom, rom_debugs, module_texts);
    element.set_audit = set_audit;
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
            invalidate();
        }
    };
});

function demo(log) {
    let driver;
    document.documentElement.innerHTML = "";
    const element = continuation_ui({});
    element.style.position = "fixed";
    element.style.inset = "0";
    const core = make_core({
        wasm_url,
        on_audit(...args) {
            driver.audit(...args);
        },
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble}
    });
    driver = make_core_driver(core, function on_status(message) {
        log("status:", Object.keys(message).join(", "));
        if (message.ram !== undefined) {
            element.set_ram(message.ram.bytes);
        }
        if (message.rom !== undefined) {
            element.set_rom(
                message.rom.bytes,
                message.rom.debugs,
                message.rom.module_texts
            );
        }
        if (message.audit !== undefined) {
            element.set_audit(message.audit);
        } else if (message.instr !== undefined) {
            element.set_audit(undefined);
        }
    });
    parseq.sequence([
        core.h_initialize(),
        core.h_import("https://ufork.org/lib/fork.asm"),
        requestorize(function () {
            core.h_boot();
            driver.command({
                kind: "statuses",
                verbose: {
                    audit: true,
                    fault: true,
                    instr: true,
                    ram: true,
                    rom: true
                }
            });
            driver.command({
                kind: "auto_pause",
                on: ["audit", "fault", "instr"]
            });
            driver.command({kind: "play"});
            return true;
        })
    ])(log);
    document.body.append(element);
    document.body.onkeydown = function (event) {
        if (event.key === "s") {
            driver.command({kind: "play"});
        }
    };
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(continuation_ui);
