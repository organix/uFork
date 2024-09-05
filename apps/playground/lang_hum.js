// Text editor support for Humus.

import compile from "https://ufork.org/lib/humus.js";
import ed_comment from "./ed_comment.js";
import ed_duplication from "./ed_duplication.js";
import ed_tab from "./ed_tab.js";

const indent = "    ";
const rx_comment = /^(\s*)(#\u0020?)/;
const comment_prefix = "# ";

function highlight(element) {
    const text = element.textContent;
    element.textContent = text;  // discard formatting from other lang packs
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
    compile,
    handle_keydown,
    highlight,
    stringify_error,
    docs_url: "https://dalnefre.github.io/humus_js/"
});
