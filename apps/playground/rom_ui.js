// Visualize the compiled ROM image of a uFork program.

/*jslint browser, bitwise */

import disassemble from "https://ufork.org/lib/disassemble.js";
import dom from "https://ufork.org/lib/dom.js";
import hex from "https://ufork.org/lib/hex.js";
import hexdump from "https://ufork.org/lib/hexdump.js";
import make_ui from "https://ufork.org/lib/ui.js";
import ucode from "https://ufork.org/ucode/ucode.js";
import theme from "./theme.js";

const dummy_bytes = new Uint8Array([
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
    0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF,
    0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF,
    0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10
]);

function bin_dump16(bytes) {
    let bin = new Uint8Array(bytes.byteLength / 2);
    let data_view = new DataView(bin.buffer);
    new Uint32Array(bytes.buffer).forEach(function (cell, addr) {
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
    new Uint32Array(bytes.buffer).forEach(function (cell, addr) {
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
    const cells = new Uint32Array(bytes.buffer);
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
    const cells = new Uint32Array(bytes.buffer);
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
    const cells = new Uint32Array(bytes.buffer);
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
    const cells = new Uint32Array(bytes.buffer);
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
    bytes,
    module_ir,
    format = "bin",
    word_size = 16
}) {
    let download_element;
    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            display: flex;
            flex-direction: column;
            color: white;
        }
        ${theme.monospace_font_css}
        rom_dump {
            font-family: ${theme.monospace_font_family}, monospace;
            font-size: 17px;
            line-height: 1.3;
            white-space: pre;
            min-height: 60px;
            overflow: auto;
            scrollbar-color: ${theme.gray} transparent;
            caret-color: white;
            color: #3F0;
            flex: 1 1;
        }
        rom_controls {
            display: flex;
            justify-content: flex-end;
            margin-top: 6px;
        }
        rom_controls > * {
            margin-left: 4px;
        }
        rom_controls > a {
            font-family: system-ui;
            font-size: 12px;
            color: white;
        }
    `);
    const dump_element = dom("rom_dump", {
        contentEditable: "false",
        spellcheck: false,
        title: "ROM dump"
    });

    function dump() {
        if (bytes !== undefined) {
            if (format === "memh") {
                return (
                    word_size === 16
                    ? memh_dump16(bytes)
                    : memh_dump32(bytes)
                );
            }
            if (format === "forth") {
                return (
                    word_size === 16
                    ? forth_dump16(bytes)
                    : forth_dump32(bytes)
                );
            }
            if (format === "bin") {
                return (
                    word_size === 16
                    ? bin_dump16(bytes)
                    : bin_dump32(bytes)
                );
            }
            if (format === "asm" && module_ir !== undefined) {
                return disassemble(module_ir);
            }
        }
    }

    function refresh() {
        const contents = dump();
        if (contents !== undefined) {
            dump_element.textContent = (
                typeof contents === "string"
                ? contents
                : hexdump(contents)
            );
            const blob = new Blob([contents]);
            const url = URL.createObjectURL(blob);
            const filename = "rom" + word_size + (
                typeof contents === "string"
                ? ".txt"
                : ".bin"
            );
            download_element.download = filename;
            download_element.textContent = "Download " + filename;
            download_element.href = url;
        } else {
            dump_element.textContent = (
                "Press Run to load and display the ROM image."
            );
            download_element.textContent = "";
        }
    }

    function set_bytes(new_bytes, new_ir) {
        bytes = new_bytes;
        module_ir = new_ir;
        refresh();
    }

    download_element = dom("a", {title: "Download as file"});
    const controls_element = dom("rom_controls", [
        download_element,
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
                dom("option", {value: "forth", textContent: "Forth"}),
                dom("option", {value: "asm", textContent: "Assembly"})
            ]
        )
    ]);
    set_bytes(bytes);
    shadow.append(style, dump_element, controls_element);
    element.set_bytes = set_bytes;
});

function demo() {
    document.documentElement.innerHTML = "";
    const rom = dom(
        rom_ui({}),
        {style: {width: "100%", height: "500px", background: "black"}}
    );
    document.body.append(rom);
    rom.set_bytes(dummy_bytes);
}

if (import.meta.main) {
    test_bin_dump16();
    test_bin_dump32();
    demo();
}

export default Object.freeze(rom_ui);
