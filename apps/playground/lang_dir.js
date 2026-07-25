// Text editor support for Director.

/*jslint browser */

import director from "https://ufork.org/lib/director.js";
import dom from "https://ufork.org/lib/dom.js";
import theme from "https://ufork.org/lib/theme.js";
import ed_comment from "./ed_comment.js";

const indent = "    ";
const rx_comment = /^(\s*)(\/\/\u0020?)/;
const comment_prefix = "//";
const styles = {
    comment: {color: theme.silver},
    directive: {color: theme.purple},
    error: {color: theme.red, background: "black"},
    literal: {color: theme.orange},
    number: {color: theme.green},
    text: {color: theme.green},
    operator: {color: theme.purple},
    name: {color: theme.yellow},
    namespace: {color: theme.orange, fontStyle: "italic"},
    keyword: {color: theme.blue, fontWeight: "bold"},
    warning: {borderRadius: "2px", outline: "1px solid " + theme.red}
};

function highlight(element) {
    const text = element.textContent;
    const ir = director.compile(text);
    element.innerHTML = "";
    ir.tokens.forEach(function (token) {
        const errors = ir.errors.filter(function (error) {
            return token.start >= error.start && token.end <= error.end;
        });

// Chrome has a weird layout performance bug that can be worked around by giving
// all elements the same set of properties. That is why all elements get a
// "title" property when only some need it.
// See https://issues.chromium.org/issues/379186294.

        let title = JSON.stringify(token, undefined, 2);
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
            || line_pre === "export"
            || (line_pre.startsWith(indent) && line_pre !== indent)
        )
        && line_post === ""
    ) {
        event.preventDefault();
        editor.insert("\n" + indent);
    }
}

export default Object.freeze({
    name: "Director",
    compile: director.compile,
    handle_keydown,
    highlight,
    docs_url: "https://github.com/organix/uFork/blob/main/docs/director.md",
    indent
});
