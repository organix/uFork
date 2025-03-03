// Text editor support for uFork assembly.

/*jslint browser */

import assemble from "https://ufork.org/lib/assemble.js";
import dom from "https://ufork.org/lib/dom.js";
import theme from "https://ufork.org/lib/theme.js";
import ed_comment from "./ed_comment.js";

const indent = "    ";
const rx_comment = /^(\s*)(;+\u0020?)/;
const comment_prefix = "; ";
const styles = {
    comment: {color: theme.silver},
    conditional: {color: theme.purple},
    data: {color: theme.blue, fontStyle: "italic"},
    directive: {color: theme.purple},
    error: {color: theme.red, background: "black"},
    literal: {color: theme.green},
    name: {color: theme.yellow},
    namespace: {color: theme.orange},
    number: {color: theme.green},
    operator: {color: theme.blue},
    string: {color: theme.yellow},
    terminal: {color: theme.purple, fontStyle: "italic"},
    warning: {borderRadius: "2px", outline: "1px solid " + theme.red}
};

function highlight(element) {
    const text = element.textContent;
    const ir = assemble(text);
    element.innerHTML = "";
    ir.tokens.forEach(function (token) {
        const errors = ir.errors.filter(function (error) {
            return token.start >= error.start && token.end <= error.end;
        });

// Chrome has a weird layout performance bug that can be worked around by giving
// all elements the same set of properties. That is why all elements get a
// "title" property when only some need it.
// See https://issues.chromium.org/issues/379186294.

        let title = "";
        let style = styles[token.context ?? token.kind];
        if (errors.length > 0) {
            title = errors.map(function (error) {
                return error.message;
            }).join(
                "\n"
            );
            style = Object.assign({}, style, styles.warning);
        }
        element.append(dom(
            "span",
            {title, style},
            text.slice(token.start, token.end)
        ));
    });
}

function handle_keydown(editor, event) {
    ed_comment(editor, event, rx_comment, comment_prefix);
    if (event.defaultPrevented) {
        return;
    }
    const text = editor.get_text();
    const cursor = editor.get_cursor();
    const cursor_start = Math.min(...cursor);
    const cursor_end = Math.max(...cursor);
    const is_collapsed = cursor_start === cursor_end;
    const pre = text.slice(0, cursor_start);
    const post = text.slice(cursor_end);
    const line_pre = pre.split("\n").pop();
    const line_post = post.split("\n").shift();

// Increase or maintain indentation following a linebreak.

    if (
        event.key === "Enter"
        && is_collapsed
        && (
            line_pre.endsWith(":")
            || line_pre === ".import"
            || line_pre === ".export"
            || (line_pre.startsWith(indent) && line_pre !== indent)
        )
        && line_post === ""
    ) {
        event.preventDefault();
        editor.insert("\n" + indent);
    }
}

function stringify_error(error) {
    return `[${error.line}:${error.column}] ${error.message}`;
}

export default Object.freeze({
    compile: assemble,
    handle_keydown,
    highlight,
    stringify_error,
    docs_url: "https://github.com/organix/uFork/blob/main/docs/asm.md",
    ruler: 28,
    indent
});
