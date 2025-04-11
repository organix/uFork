// IR disassembly dump.

/*jslint browser */

import assemble from "https://ufork.org/lib/assemble.js";
import disassemble from "https://ufork.org/lib/disassemble.js";
import dom from "https://ufork.org/lib/dom.js";
import theme from "https://ufork.org/lib/theme.js";
import make_ui from "https://ufork.org/lib/ui.js";
import lang_asm from "./lang_asm.js";
const asm_url = import.meta.resolve("https://ufork.org/lib/cell.asm");

const disasm_ui = make_ui("disasm-ui", function (element, {ir}) {
    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            display: flex;
            background: ${theme.black};
        }
        pre {
            flex: 1 1;
            margin: 0;
            color: ${theme.white};
            font-family: ${theme.monospace_font_family};
            line-height: ${theme.monospace_line_height};
            overflow-y: auto;
            scrollbar-color: ${theme.gray} transparent;
            padding: 0 8px 8px;
        }
    `);
    const pre = dom("pre");

    function set_ir(new_ir) {
        ir = new_ir;
        const errors = ir?.errors ?? [];
        pre.textContent = (
            (ir !== undefined && errors.length === 0)
            ? disassemble(ir)
            : "; No disassembly available."
        );
        lang_asm.highlight(pre);
    }

    shadow.append(style, pre);
    set_ir(ir);
    element.set_ir = set_ir;
});

if (import.meta.main) {
    document.documentElement.innerHTML = "";
    const element = disasm_ui({});
    element.style.position = "fixed";
    element.style.inset = "0";
    fetch(asm_url).then(function (response) {
        return response.text();
    }).then(function (text) {
        element.set_ir(assemble(text));
    });
    document.body.append(element);
}

export default Object.freeze(disasm_ui);
