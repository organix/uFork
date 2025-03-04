// Visualize the readonly memory of a uFork core.

/*jslint browser, global, bitwise */

import assemble from "https://ufork.org/lib/assemble.js";
import dom from "https://ufork.org/lib/dom.js";
import hex from "https://ufork.org/lib/hex.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import theme from "https://ufork.org/lib/theme.js";
import make_ui from "https://ufork.org/lib/ui.js";
import ucode from "https://ufork.org/ucode/ucode.js";
import ufork from "../ufork.js";
import raw_ui from "./raw_ui.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");

const bytes_per_word = 4; // 32 bits
const bytes_per_quad = bytes_per_word * 4;
const dummy_bytes = new Uint8Array([
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
    0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF,
    0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF,
    0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10
]);

function words(bytes) {
    return new Uint32Array(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength / bytes_per_word
    );
}

function bin_dump16(bytes) {
    let bin = new Uint8Array(bytes.byteLength / 2);
    let data_view = new DataView(bin.buffer);
    words(bytes).forEach(function (cell, addr) {
        data_view.setUint16(addr << 1, ucode.from_uf(cell), false);
    });
    return bin;
}

function test_bin_dump16() {
    const bin = bin_dump16(dummy_bytes);
    if (
        bin[0] !== 0x31
        || bin[1] !== 0x00
        || bin[2] !== 0x75
        || bin[3] !== 0x44
    ) {
        throw new Error("FAIL bin_dump16");
    }
}

function bin_dump32(bytes) {
    let bin = new Uint8Array(bytes.byteLength);
    let data_view = new DataView(bin.buffer);
    words(bytes).forEach(function (cell, addr) {
        data_view.setUint32(addr << 2, cell, false);
    });
    return bin;
}

function test_bin_dump32() {
    const bin = bin_dump32(dummy_bytes);
    if (
        bin[0] !== 0x33
        || bin[1] !== 0x22
        || bin[2] !== 0x11
        || bin[3] !== 0x00
        || bin[4] !== 0x77
    ) {
        throw new Error("FAIL bin_dump32");
    }
}

function memh_dump16(bytes) {
    const cells = words(bytes);
    let s = "/*   T     X     Y     Z      ADDR */\n";
    //         0123  4567  89AB  CDEF  // ^0000
    cells.forEach(function (cell, addr) {
        s += "  " + hex.from(ucode.from_uf(cell), 16);
        if ((addr & 0x3) === 0x3) {
            s += "  // ^" + hex.from((addr >> 2), 16) + "\n";
        }
    });
    const n = cells.length;
    s += "/* " + n + " cells, " + (n >> 2) + " quads */\n";
    return s;
}

function memh_dump32(bytes) {
    const cells = words(bytes);
    let s = "/*       T         X         Y         Z          ADDR */\n";
    //         00112233  44556677  8899AABB  CCDDEEFF  // ^00000000
    cells.forEach(function (cell, addr) {
        s += "  " + hex.from(cell, 32);
        if ((addr & 0x3) === 0x3) {
            s += "  // ^" + hex.from((addr >> 2), 32) + "\n";
        }
    });
    const n = cells.length;
    s += "/* " + n + " cells, " + (n >> 2) + " quads */\n";
    return s;
}

function forth_dump16(bytes) {
    const cells = words(bytes);
    let s = "(    T        X        Y        Z       ADDR )\n";
    //       0x0123 , 0x4567 , 0x89AB , 0xCDEF ,  ( ^0000 )
    cells.forEach(function (cell, addr) {
        s += "0x" + hex.from(ucode.from_uf(cell), 16);
        s += (
            (addr & 0x3) !== 0x3
            ? " , "
            : " ,  ( ^" + hex.from((addr >> 2), 16) + " )\n"
        );
    });
    const n = cells.length;
    s += "( " + n + " cells, " + (n >> 2) + " quads )\n";
    return s;
}

function forth_dump32(bytes) {
    const cells = words(bytes);
    let s = (
        "(        T            X            Y            Z           ADDR )\n"
    //   0x00112233 , 0x44556677 , 0x8899AABB , 0xCCDDEEFF ,  ( ^00000000 )
    );
    cells.forEach(function (cell, addr) {
        s += "0x" + hex.from(cell, 32);
        s += (
            (addr & 0x3) !== 0x3
            ? " , "
            : " ,  ( ^" + hex.from((addr >> 2), 32) + " )\n"
        );
    });
    const n = cells.length;
    s += "( " + n + " cells, " + (n >> 2) + " quads )\n";
    return s;
}

const rom_ui = make_ui("rom-ui", function (element, {
    rom = new Uint8Array(),
    rom_debugs = Object.create(null),
    format = "bin",
    word_size = 16
}) {
    let download_element;
    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            display: flex;
            flex-direction: column;
            color: ${theme.white};
        }
        ${theme.monospace_font_css}
        :host > :nth-child(2) {
            flex: 1 1;
            scrollbar-color: ${theme.gray} transparent;
            padding: 10px;
        }
        :host > rom_text {
            font-family: ${theme.monospace_font_family};
            font-size: 17px;
            line-height: 1.3;
            white-space: pre;
            min-height: 60px;
            color: ${theme.green};
            overflow: auto;
        }
        :host > dl {
            margin: 0;
            display: grid;
            grid-template-columns: max-content 1fr;
            gap: 0 10px;
            align-content: start;
            overflow: hidden auto;
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
        :host > rom_controls {
            display: flex;
            justify-content: flex-start;
            align-items: center;
            gap: 8px;
            padding: 8px 10px;
            border-top: 1px solid ${theme.gray};
        }
        :host > rom_controls > a {
            font-family: ${theme.proportional_font_family};
            font-size: 13px;
            color: ${theme.white};
        }
    `);
    const dl_element = dom("dl");
    const text_element = dom("rom_text", {
        contentEditable: "false",
        spellcheck: false
    });

    function refresh() {
        let contents;
        let filename;
        if (format === "bin") {
            contents = (
                word_size === 16
                ? bin_dump16(rom)
                : bin_dump32(rom)
            );
            filename = "rom" + word_size + ".bin";
            dl_element.innerHTML = "";
            const nr_quads = Math.floor(rom.byteLength / bytes_per_quad);
            new Array(nr_quads).fill().forEach(function (_, ofs) {
                const ptr = ufork.romptr(ofs);
                dl_element.append(dom("dt", ufork.print(ptr)));
                const value_element = raw_ui({
                    value: ptr,
                    depth: 1,
                    expand: 0,
                    rom_constant_depth: 1,
                    rom,
                    rom_debugs
                });
                dl_element.append(dom("dd", [value_element]));
            });
            shadow.children[1].replaceWith(dl_element);
        } else {
            contents = (
                format === "forth"
                ? (
                    word_size === 16
                    ? forth_dump16(rom)
                    : forth_dump32(rom)
                )
                : (
                    word_size === 16
                    ? memh_dump16(rom)
                    : memh_dump32(rom)
                )
            );
            text_element.textContent = contents;
            shadow.children[1].replaceWith(text_element);
            filename = "rom" + word_size + (
                format === "forth"
                ? ".f"
                : ".mem"
            );
        }
        download_element.download = filename;
        download_element.textContent = "Download " + filename;
        download_element.href = URL.createObjectURL(new Blob([contents]));
    }

    function set_rom(new_rom, new_rom_debugs = Object.create(null)) {
        rom = new_rom;
        rom_debugs = new_rom_debugs;
        refresh();
    }

    download_element = dom("a", {title: "Download as file"});
    const controls_element = dom("rom_controls", [
        dom(
            "select",
            {
                title: "Format",
                value: format,
                onchange(event) {
                    format = event.target.value;
                    refresh();
                }
            },
            [
                dom("option", {value: "bin", textContent: "Binary"}),
                dom("option", {value: "memh", textContent: "Memfile"}),
                dom("option", {value: "forth", textContent: "Forth"})
            ]
        ),
        dom(
            "select",
            {
                title: "Word size",
                value: word_size,
                onchange(event) {
                    word_size = parseInt(event.target.value);
                    refresh();
                }
            },
            [
                dom("option", {value: 16, textContent: "16 bit"}),
                dom("option", {value: 32, textContent: "32 bit"})
            ]
        ),
        download_element
    ]);
    shadow.append(style, text_element, controls_element);
    set_rom(rom, rom_debugs);
    element.set_rom = set_rom;
});

function demo(log) {
    document.documentElement.innerHTML = "";
    const core = ufork.make_core({
        wasm_url,
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble}
    });
    const element = rom_ui({});
    element.style.position = "fixed";
    element.style.inset = "0";
    parseq.sequence([
        core.h_initialize(),
        core.h_import("https://ufork.org/lib/future.asm"),
        requestorize(function () {
            core.h_boot();
            core.h_run_loop(25);
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
    test_bin_dump16();
    test_bin_dump32();
    demo(globalThis.console.log);
}

export default Object.freeze(rom_ui);
