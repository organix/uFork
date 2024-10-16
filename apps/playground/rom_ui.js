// Visualize the compiled ROM image of a uFork program.

/*jslint browser, bitwise, long */

import hex from "https://ufork.org/lib/hex.js";
import hexdump from "https://ufork.org/lib/hexdump.js";
import disassemble from "https://ufork.org/lib/disassemble.js";
import make_ui from "./ui.js";
import dom from "./dom.js";
import theme from "./theme.js";

// Map 32-bit address space to 16-bits

function from_uf(uf) {  // also exported from `fpga/fomu/cpu/ucode.js`
    const lsb13 = (uf >> 0) & 0x1FFF;
    const msb3 = (uf >> 16) & 0xE000;
    return (msb3 | lsb13);
}

// console.log(hex.from(from_uf(-1), 16));
// console.log(hex.from(from_uf(0x60000002), 16));

const rom_ui = make_ui("rom-ui", function (element, {
    module_ir,
    buffer,
    format = "memh",
    bitwidth = 16
}) {
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
    `);
    const dump_element = dom("rom_dump", {
        contentEditable: "false",
        spellcheck: false,
        title: "ROM dump"
    });

    function memh_dump16(octets) {
        const cells = new Uint32Array(octets.buffer);
        let s = "/*   T     X     Y     Z      ADDR */\n";
        //         0123  4567  89AB  CDEF  // ^0000
        cells.forEach(function (cell, addr) {
            s += "  " + hex.from(from_uf(cell), 16);
            if ((addr & 0x3) === 0x3) {
                s += "  // ^" + hex.from((addr >> 2), 16) + "\n";
            }
        });
        const n = cells.length;
        s += "/* " + n + " cells, " + (n >> 2) + " quads */\n";
        return s;
    }

    function memh_dump32(octets) {
        const cells = new Uint32Array(octets.buffer);
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

    function forth_dump16(octets) {
        const cells = new Uint32Array(octets.buffer);
        let s = "(    T        X        Y        Z       ADDR )\n";
        //       0x0123 , 0x4567 , 0x89AB , 0xCDEF ,  ( ^0000 )
        cells.forEach(function (cell, addr) {
            s += "0x" + hex.from(from_uf(cell), 16);
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

    function forth_dump32(octets) {
        const cells = new Uint32Array(octets.buffer);
        let s = "(        T            X            Y            Z           ADDR )\n";
        //       0x00112233 , 0x44556677 , 0x8899AABB , 0xCCDDEEFF ,  ( ^00000000 )
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

    function dump() {
        const text = (
            buffer !== undefined
            ? (
                format === "memh"
                ? (
                    bitwidth === 16
                    ? memh_dump16(buffer)
                    : memh_dump32(buffer)
                )
                : (
                    format === "forth"
                    ? (
                        bitwidth === 16
                        ? forth_dump16(buffer)
                        : forth_dump32(buffer)
                    )
                    : (
                        (format === "asm" && module_ir !== undefined)
                        ? disassemble(module_ir)
                        : hexdump(buffer)
                    )
                )
            )
            : "Press Run to load and display the ROM image."
        );
        dump_element.textContent = text;
    }

    function on_bitwidth_change(event) {
        bitwidth = parseInt(event.target.value);
        dump();
    }

    function on_format_change(event) {
        format = event.target.value;
        dump();
    }

    function set_buffer(new_buffer, new_ir) {
        buffer = new_buffer;
        module_ir = new_ir;
        dump();
    }

    const controls_element = dom("rom_controls", [
        dom(
            "select",
            {onchange: on_bitwidth_change, title: "Bit width", value: bitwidth},
            [
                dom("option", {value: 16, textContent: "16 bit"}),
                dom("option", {value: 32, textContent: "32 bit"})
            ]
        ),
        dom(
            "select",
            {onchange: on_format_change, title: "Text format", value: format},
            [
                dom("option", {value: "memh", textContent: "Memfile"}),
                dom("option", {value: "forth", textContent: "Forth"}),
                dom("option", {value: "asm", textContent: "Assembly"})
            ]
        )
    ]);
    set_buffer(buffer);
    shadow.append(style, dump_element, controls_element);
    element.set_buffer = set_buffer;
});

//debug document.documentElement.innerHTML = "";
//debug const rom = dom(
//debug     rom_ui({format: "hex", bitwidth: 32}),
//debug     {style: {width: "400px", height: "400px", background: "black"}}
//debug );
//debug document.body.append(rom);
//debug rom.set_buffer(new Uint8Array([
//debug     0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
//debug     0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF,
//debug     0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF,
//debug     0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10
//debug ]));

export default Object.freeze(rom_ui);
