// Text editor support for Scheme.

import scm from "https://ufork.org/lib/scheme.js";
import ed_comment from "./ed_comment.js";
import ed_duplication from "./ed_duplication.js";
import ed_tab from "./ed_tab.js";
import dom from "./dom.js";
import theme from "./theme.js";

const indent = "    ";
const rx_comment = /^(\s*)(;+\u0020?)/;
const comment_prefix = "; ";
const rainbow = [theme.yellow, theme.purple, theme.orange, theme.green];

function highlight(element) {
    const text = element.textContent;
    const ir = scm.compile(text);
    element.innerHTML = "";
    const errors = ir.errors.filter(function (error) {
        return (
            Number.isSafeInteger(error.start)
            && Number.isSafeInteger(error.end)
        );
    }).sort(function (a, b) {
        return a.start - b.start;
    });
    if (errors.length > 0) {

// Show the position of the error.

        let position = 0;
        errors.forEach(function (error) {
            element.append(
                text.slice(position, error.start),
                dom("span", {
                    textContent: text.slice(error.start, error.end),
                    title: error.error,
                    style: {
                        borderRadius: "2px",
                        outline: "1px solid " + theme.red
                    }
                })
            );
            position = error.end;
        });
        element.append(text.slice(position));  // remnant
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
                const char = dom("span", {
                    textContent: glyph,
                    style: {color: theme.blue}
                });
                element.append(char);
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
    ed_comment(editor, event, rx_comment, comment_prefix);
    ed_duplication(editor, event);
    ed_tab(editor, event, indent);
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
