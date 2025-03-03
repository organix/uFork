// Visualize the volatile memory of a uFork core.

/*jslint browser, global */

import dom from "https://ufork.org/lib/dom.js";
import theme from "https://ufork.org/lib/theme.js";
import make_ui from "https://ufork.org/lib/ui.js";
import ufork from "../ufork.js";
import memory_dump from "./memory_dump.js";

const ram_explorer_ui = make_ui("ram-explorer-ui", function (element, {
    bytes = new Uint8Array(),
    hide_free = false,
    text_color = "inherit"
}) {
    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            display: flex;
            flex-direction: column;
            justify-content: stretch;
            padding: 10px;
            gap: 10px;
        }
        ram_dump {
            color: ${text_color};
            font-family: monospace;
            white-space: pre;
            overflow: auto;
            flex: 1 1;
        }
        label {
            display: flex;
            align-items: center;
            font-family: ${theme.proportional_font_family};
            font-size: 13px;
        }
    `);
    const dump = dom("ram_dump");
    let hide_free_checkbox;

    function get_bytes() {
        return bytes;
    }

    function set_bytes(new_bytes) {
        bytes = new_bytes;
        const text = memory_dump(bytes, ufork.ramptr(0));
        dump.textContent = (
            hide_free
            ? text.split(
                "\n"
            ).filter(function (line) {
                return !line.includes("[FREE_T,");
            }).join(
                "\n"
            )
            : text
        );
    }

    function set_hide_free(new_hide_free) {
        hide_free = new_hide_free;
        hide_free_checkbox.checked = hide_free;
        set_bytes(bytes);  // refresh
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
    shadow.append(style, dump, hide_free_label);
    set_bytes(bytes);
    set_hide_free(hide_free);
    element.get_bytes = get_bytes;
    element.set_bytes = set_bytes;
});

function demo() {
    document.documentElement.innerHTML = "";
    const element = ram_explorer_ui({text_color: "maroon"});
    element.style.position = "fixed";
    element.style.inset = "0";
    let bytes = new Uint8Array(2048 * Math.random());
    crypto.getRandomValues(bytes);
    element.set_bytes(bytes);
    document.body.append(element);
}

if (import.meta.main) {
    demo();
}

export default Object.freeze(ram_explorer_ui);
