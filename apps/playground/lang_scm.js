// Text editor support for Scheme.

import dom from "https://ufork.org/lib/dom.js";
import scm from "https://ufork.org/lib/scheme.js";
import theme from "https://ufork.org/lib/theme.js";
import ed_comment from "./ed_comment.js";

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
                    title: error.message,
                    style: {
                        borderRadius: "2px",
                        outline: "1px solid " + theme.red
                    }
                })
            );
            position = error.end;
        });
        element.append(text.slice(position));  // remnant
        return;
    }

// Rainbow parens, pending detailed token information.

    let depth = 0;
    let in_comment = false;
    Array.from(text).forEach(function (glyph) {
        in_comment = (
            in_comment
            ? glyph !== "\n"
            : glyph === ";"
        );
        if (in_comment) {
            const dim = dom("span", {
                textContent: glyph,
                style: {color: theme.silver}
            });
            element.append(dim);
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
    });
}

function handle_keydown(editor, event) {
    ed_comment(editor, event, rx_comment, comment_prefix);
}

export default Object.freeze({
    compile: scm.compile,
    handle_keydown,
    highlight,
    docs_url: "https://github.com/organix/uFork/blob/main/docs/scheme.md",
    indent
});
