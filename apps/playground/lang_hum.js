// Text editor support for Humus.

import compile from "https://ufork.org/lib/humus.js";
import dom from "./dom.js";
import ed_comment from "./ed_comment.js";
import ed_duplication from "./ed_duplication.js";
import ed_tab from "./ed_tab.js";
import theme from "./theme.js";

const indent = "    ";
const rx_comment = /^(\s*)(#\u0020?)/;
const comment_prefix = "# ";

function highlight(element) {
    const text = element.textContent;
    element.textContent = "";
    const result = compile(text);
    let position = 0;
    result.errors.filter(function (error) {
        return (
            Number.isSafeInteger(error.start)
            && Number.isSafeInteger(error.end)
        );
    }).sort(function (a, b) {
        return b.start - a.start;
    }).forEach(function (error) {
        element.append(
            text.slice(position, error.start),
            dom(
                "span",
                {
                    style: {
                        borderRadius: "2px",
                        outline: "1px solid " + theme.red
                    },
                    title: error.message
                },
                text.slice(error.start, error.end)
            )
        );
        position = error.end;
    });
    element.append(text.slice(position));  // remnant
}

function handle_keydown(editor, event) {
    ed_comment(editor, event, rx_comment, comment_prefix);
    ed_duplication(editor, event);
    ed_tab(editor, event, indent);
}

function stringify_error(error) {
    return `[${error.line ?? "?"}:${error.column ?? "?"}] ${error.message}`;
}

export default Object.freeze({
    compile,
    handle_keydown,
    highlight,
    stringify_error,
    docs_url: "https://dalnefre.github.io/humus_js/"
});
