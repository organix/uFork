// Text editor support for Scheme.

import scm from "https://ufork.org/lib/scheme.js";
import ed_tab from "./ed_tab.js";
import ed_comment from "./ed_comment.js";
import dom from "./dom.js";
import theme from "./theme.js";

const indent = "    ";
const rx_comment = /^(\s*)(;+\u0020?)/;
const comment_prefix = "; ";
const rainbow = [theme.yellow, theme.purple, theme.orange, theme.green];

function highlight(element) {
    const text = element.textContent;
    element.style.color = theme.blue;
    element.innerHTML = "";
    const ir = scm.compile(text);
    if (ir.errors !== undefined && ir.errors.length > 0) {

// Show the position of the error.

        const error = ir.errors[0];
        element.append(
            text.slice(0, error.start),
            dom("span", {
                textContent: text.slice(error.start, error.end),
                title: error.error,
                style: {
                    outline: "1px solid " + theme.red,
                    borderRadius: "2px"
                }
            }),
            text.slice(error.end)
        );
    } else {

// Rainbow parens, pending detailed token information.

        let depth = 0;
        let mode = source_mode;

        function source_mode(glyph) {
            if (glyph === ";") {
                mode = comment_mode;
                mode(glyph);
            } else if (glyph === "(") {
                const open = dom("span", {
                    textContent: glyph,
                    style: {color: rainbow[depth % rainbow.length]}
                });
                element.append(open);
                depth += 1;
            } else if (glyph === ")") {
                depth -= 1;
                const close = dom("span", {
                    textContent: glyph,
                    style: {color: rainbow[depth % rainbow.length]}
                });
                element.append(close);
            } else {
                element.append(glyph);
            }
        }

        function comment_mode(glyph) {
            if (glyph === "\n") {
                mode = source_mode;
                mode(glyph);
            } else {
                const dim = dom("span", {
                    textContent: glyph,
                    style: {color: theme.silver}
                });
                element.append(dim);
            }
        }

        Array.from(text).forEach(function (glyph) {
            mode(glyph);  // handle `gylph` in current `mode`
        });
    }
}

function handle_keydown(editor, event) {
    ed_tab(editor, event, indent);
    ed_comment(editor, event, rx_comment, comment_prefix);
}

function stringify_error(error) {
    return error.error;
}

export default Object.freeze({
    compile: scm.compile,
    handle_keydown,
    highlight,
    stringify_error,
    docs_url: "https://github.com/organix/uFork/blob/main/docs/scheme.md"
});
