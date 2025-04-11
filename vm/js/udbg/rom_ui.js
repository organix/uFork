// Visualize the readonly memory of a uFork core.

/*jslint browser, global, bitwise */

import assemble from "https://ufork.org/lib/assemble.js";
import dom from "https://ufork.org/lib/dom.js";
import hex from "https://ufork.org/lib/hex.js";
import theme from "https://ufork.org/lib/theme.js";
import make_ui from "https://ufork.org/lib/ui.js";
import ufork from "../ufork.js";
import loader from "../loader.js";
import raw_ui from "./raw_ui.js";

const bytes_per_word = 4; // 32 bits
const bytes_per_quad = bytes_per_word * 4;
const dummy_bytes = new Uint8Array([
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
    0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF,
    0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF,
    0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10
]);

function words(bytes) {

// Avoid the exception "RangeError: start offset of Uint32Array should be a
// multiple of 4".

    if (bytes.byteOffset % 4 !== 0) {
        bytes = bytes.slice();
    }
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
        data_view.setUint16(addr << 1, ufork.to_word16(cell), false);
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
        s += "  " + hex.from(ufork.to_word16(cell), 16);
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
        s += "0x" + hex.from(ufork.to_word16(cell), 16);
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
            background: ${theme.black};
            color: ${theme.white};
            contain: strict;
        }
        :host > :nth-child(2) {
            flex: 1 1;
            scrollbar-color: ${theme.gray} transparent;
            padding: 10px;
        }
        :host > rom_text {
            font-family: ${theme.monospace_font_family};
            line-height: ${theme.monospace_line_height};
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
            padding-top: 3px;
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

const demo_module = `
data:
    pair_t 42
    pair_t 1729
    ref #nil
beh:
    state 0
    actor self
    actor send
    end commit
`;

function demo() {
    document.documentElement.innerHTML = "";
    let rom_words = new Uint32Array(ufork.QUAD_ROM_MAX * 4);
    rom_words.set(ufork.reserved_rom);
    let rom_top = ufork.reserved_rom.length / 4;
    let rom_debugs = Object.create(null);
    loader.load({
        ir: assemble(demo_module),
        alloc_quad(debug_info) {
            const ptr = ufork.romptr(rom_top);
            rom_top += 1;
            rom_debugs[ptr] = debug_info;
            return ptr;
        },
        read_quad(ptr) {
            return ufork.read_quad(rom_words, ufork.rawofs(ptr));
        },
        write_quad(ptr, quad) {
            ufork.write_quad(rom_words, ufork.rawofs(ptr), quad);
        }
    });
    const element = rom_ui({});
    element.style.position = "fixed";
    element.style.inset = "0";
    element.set_rom(rom_words.slice(0, rom_top * 4), rom_debugs);
    document.head.append(dom("meta", {name: "color-scheme", content: "dark"}));
    document.body.append(element);
}

if (import.meta.main) {
    test_bin_dump16();
    test_bin_dump32();
    demo(globalThis.console.log);
}

export default Object.freeze(rom_ui);
