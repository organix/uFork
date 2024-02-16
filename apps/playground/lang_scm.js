// Text editor support for Scheme.

import scm from "https://ufork.org/lib/scheme.js";
import handle_tab from "./handle_tab.js";
import handle_comment from "./handle_comment.js";
import element from "./element.js";
import theme from "./theme.js";

const indent = "    ";
const rx_comment = /^(\s*)(;+\u0020?)/;
const comment_prefix = "; ";
const rainbow = Object.values(theme);

function highlight(the_element) {
    const text = the_element.textContent;
    the_element.innerHTML = "";
    const ir = scm.compile(text);
    if (ir.errors !== undefined && ir.errors.length > 0) {

// Show the position of the error.

        const error = ir.errors[0];
        the_element.append(
            text.slice(0, error.start),
            element("span", {
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
            const paren = element("span", {
                textContent: glyph,
                style: {color: rainbow[depth]}
            });
            if (glyph === "(") {
                the_element.append(paren);
                depth += 1;
            } else if (glyph === ")") {
                depth -= 1;
                the_element.append(paren);
            } else {
                the_element.append(glyph);
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
