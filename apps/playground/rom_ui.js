// Visualize the compiled ROM image of a uFork program.

/*jslint browser */

import hexdump from "https://ufork.org/lib/hexdump.js";
import make_ui from "./ui.js";
import dom from "./dom.js";
import theme from "./theme.js";

const rom_ui = make_ui("rom-ui", function (element, {
    buffer,
    format = "memfile",
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
        contentEditable: "true",
        spellcheck: false,
        title: "ROM dump"
    });

    function dump() {
        dump_element.textContent = (
            buffer !== undefined
            ? hexdump(buffer)
            : "Press Run to load and display the ROM image."
        );
    }

    function on_bitwidth_change(event) {
        bitwidth = parseInt(event.target.value);
        dump();
    }

    function on_format_change(event) {
        format = event.target.value;
        dump();
    }

    function set_buffer(new_buffer) {
        buffer = new_buffer;
        dump();
    }

    const controls_element = dom("rom_controls", [
        dom(
            "select",
            {onclick: on_bitwidth_change, title: "Bit width", value: bitwidth},
            [
                dom("option", {value: 16, textContent: "16 bit"}),
                dom("option", {value: 32, textContent: "32 bit"})
            ]
        ),
        dom(
            "select",
            {onclick: on_format_change, title: "Text format", value: format},
            [
                dom("option", {value: "memfile", textContent: "Memfile"}),
                dom("option", {value: "forth", textContent: "Forth"})
            ]
        )
    ]);
    set_buffer(buffer);
    shadow.append(style, dump_element, controls_element);
    element.set_buffer = set_buffer;
});

//debug document.documentElement.innerHTML = "";
//debug const rom = dom(
//debug     rom_ui({format: "forth", bitwidth: 32}),
//debug     {style: {width: "400px", height: "400px", background: "black"}}
//debug );
//debug document.body.append(rom);
//debug rom.set_buffer(new Uint8Array([1, 2, 3]));

export default Object.freeze(rom_ui);
