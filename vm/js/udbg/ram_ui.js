// Visualize the volatile memory of a uFork core.

/*jslint browser, global */

import assemble from "https://ufork.org/lib/assemble.js";
import dom from "https://ufork.org/lib/dom.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import theme from "https://ufork.org/lib/theme.js";
import make_ui from "https://ufork.org/lib/ui.js";
import ufork from "../ufork.js";
import pprint_ui from "./pprint_ui.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");

const bytes_per_word = 4; // 32 bits
const bytes_per_quad = bytes_per_word * 4;
const ram_ui = make_ui("ram-explorer-ui", function (element, {
    ram = new Uint8Array(),
    rom = new Uint8Array(),
    rom_debugs = Object.create(null),
    hide_free = false
}) {
    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            display: flex;
            flex-direction: column;
            justify-content: stretch;
        }
        :host > dl {
            margin: 0;
            flex: 1 1;
            display: grid;
            grid-template-columns: max-content 1fr;
            gap: 0 10px;
            align-content: start;
            overflow-x: hidden;
            overflow-y: auto;
            scrollbar-color: ${theme.gray} transparent;
            padding: 10px;
        }
        :host > dl > dt {
            display: flex;
            justify-content: flex-end;
            align-items: baseline;
            font-family: ${theme.monospace_font_family};
            white-space: pre;
        }
        :host > dl > dd {
            margin: 0;
            min-width: 0; /* truncate long summaries */
        }
        :host > label {
            display: flex;
            align-items: center;
            font-family: ${theme.proportional_font_family};
            font-size: 13px;
            padding: 8px 10px;
            border-top: 1px solid ${theme.gray};
        }
    `);
    const dl = dom("dl");
    let hide_free_checkbox;

    function refresh() {
        dl.innerHTML = "";
        const nr_quads = Math.floor(ram.byteLength / bytes_per_quad);
        new Array(nr_quads).fill().forEach(function (_, ofs) {
            const quad = ufork.read_quad(ram, ofs);
            if (!hide_free || quad.t !== ufork.FREE_T) {
                const ptr = ufork.ramptr(ofs);
                dl.append(dom("dt", ufork.print(ptr)));
                const value = pprint_ui({
                    value: (
                        (quad.t === ufork.ACTOR_T || quad.t === ufork.PROXY_T)
                        ? ufork.ptr_to_cap(ptr)
                        : ptr
                    ),
                    depth: 1,
                    expand: 0,
                    ram,
                    rom,
                    rom_debugs
                });
                dl.append(dom("dd", [value]));
            }
        });
    }

    function get_ram() {
        return ram;
    }

    function set_ram(new_ram) {
        ram = new_ram;
        refresh();
    }

    function set_rom(new_rom, new_rom_debugs = Object.create(null)) {
        rom = new_rom;
        rom_debugs = new_rom_debugs;
        refresh();
    }

    function set_hide_free(new_hide_free) {
        hide_free = new_hide_free;
        hide_free_checkbox.checked = hide_free;
        refresh();
    }

    hide_free_checkbox = dom("input", {
        type: "checkbox",
        checked: hide_free,
        oninput() {
            set_hide_free(hide_free_checkbox.checked);
        }
    });
    const hide_free_label = dom("label", [
        dom("span", ["Hide ", dom("code", "FREE_T")]),
        hide_free_checkbox
    ]);
    shadow.append(style, dl, hide_free_label);
    set_ram(ram);
    set_hide_free(hide_free);
    element.get_ram = get_ram;
    element.set_ram = set_ram;
    element.set_rom = set_rom;
});

function demo(log) {
    document.documentElement.innerHTML = "";
    const core = ufork.make_core({
        wasm_url,
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble}
    });
    const element = ram_ui({});
    element.style.position = "fixed";
    element.style.inset = "0";
    parseq.sequence([
        core.h_initialize(),
        core.h_import("https://ufork.org/lib/future.asm"),
        requestorize(function () {
            core.h_boot();
            core.h_run_loop(25);
            element.set_ram(core.h_ram());
            element.set_rom(core.h_rom(), core.u_rom_debugs());
            return true;
        })
    ])(log);
    document.head.append(
        dom("meta", {name: "color-scheme", content: "dark"})
    );
    document.body.append(element);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(ram_ui);
