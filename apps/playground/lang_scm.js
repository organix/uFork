// Text editor support for Scheme.

import scm from "https://ufork.org/lib/scheme.js";
import handle_tab from "./handle_tab.js";
import handle_comment from "./handle_comment.js";

const indent = "    ";
const rx_comment = /^(\s*)(;+\u0020?)/;
const comment_prefix = "; ";

const red = "#F92672";
const orange = "#FD971F";
const silver = "#BFBFBF";
const blue = "#66D9EF";
const green = "#2EE250";
const purple = "#CE80FF";
const yellow = "#E6DB74";

const rainbow = [blue, green, yellow, purple, orange, red, silver];

function highlight(element) {
    const document = element.getRootNode();

    function span(properties) {
        const the_element = document.createElement("span");
        Object.assign(the_element, properties);
        Object.assign(the_element.style, properties.style);
        return the_element;
    }

    const text = element.textContent;
    element.innerHTML = "";
    const ir = scm.compile(text);
    if (ir.errors !== undefined && ir.errors.length > 0) {

// Show the position of the error.

        const error = ir.errors[0];
        element.append(
            text.slice(0, error.start),
            span({
                textContent: text.slice(error.start, error.end),
                title: error.error,
                className: "warning"
            }),
            text.slice(error.end)
        );
    } else {

// Rainbow parens, pending detailed token information.

        let depth = 0;
        Array.from(text).forEach(function (glyph) {
            if (glyph === "(" || glyph === ")") {
                element.append(span({
                    textContent: glyph,
                    style: {color: rainbow[depth]}
                }));
                depth += (
                    glyph === "("
                    ? 1
                    : -1
                );
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
