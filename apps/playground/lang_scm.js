// Text editor support for Scheme.

import scm from "https://ufork.org/lib/scheme.js";
import handle_tab from "./handle_tab.js";
import handle_comment from "./handle_comment.js";
import dom from "./dom.js";
import theme from "./theme.js";

const indent = "    ";
const rx_comment = /^(\s*)(;+\u0020?)/;
const comment_prefix = "; ";
const rainbow = [theme.blue, theme.orange, theme.purple, theme.green];

function highlight(element) {
    const text = element.textContent;
    element.style.color = theme.yellow;
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
        Array.from(text).forEach(function (glyph) {
            const paren = dom("span", {
                textContent: glyph,
                style: {color: rainbow[depth % rainbow.length]}
            });
            if (glyph === "(") {
                element.append(paren);
                depth += 1;
            } else if (glyph === ")") {
                depth -= 1;
                element.append(paren);
            } else {
                element.append(glyph);
            }
        });
    }
}

function handle_keydown(editor, event) {
    handle_tab(editor, event, indent);
    handle_comment(editor, event, rx_comment, comment_prefix);
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
