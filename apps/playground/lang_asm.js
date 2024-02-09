// Text editor support for uFork assembly.

import assemble from "https://ufork.org/lib/assemble.js";
import handle_tab from "./handle_tab.js";
import handle_comment from "./handle_comment.js";
import handle_duplication from "./handle_duplication.js";

const indent = "    ";
const rx_comment = /^(\s*)(;+\u0020?)/;
const comment_prefix = "; ";

function highlight(element) {
    const document = element.getRootNode();
    const text = element.textContent;
    element.innerHTML = "";
    const crlf = assemble(text);
    crlf.tokens.forEach(function (token) {
        const errors = crlf.errors.filter(function (error) {
            return token.start >= error.start && token.end <= error.end;
        });
        const span = document.createElement("span");
        span.textContent = text.slice(token.start, token.end);
        span.classList.add(
            (token.context === undefined && token.kind.length === 1)
            ? "separator"
            : token.context ?? token.kind
        );
        if (errors.length > 0) {
            span.title = errors.map(function (error) {
                return error.message;
            }).join(
                "\n"
            );
            span.classList.add("warning");
        }
        element.append(span);
    });
}

function handle_keydown(editor, event) {
    handle_tab(editor, event, indent);
    handle_comment(editor, event, rx_comment, comment_prefix);
    handle_duplication(editor, event);
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
        editor.insert_text("\n" + indent);
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
    docs_url: "https://github.com/organix/uFork/blob/main/docs/asm.md"
});
