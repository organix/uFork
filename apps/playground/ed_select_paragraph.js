// Ed keybinding that selects the current paragraph.

/*jslint browser */

import ed from "./ed.js";
import is_apple from "./is_apple.js";
import select_paragraph from "./select_paragraph.js";

function ed_select_paragraph(editor, event) {
    if (event.defaultPrevented) {
        return;
    }
    if (
        (
            is_apple()
            ? event.ctrlKey
            : event.altKey
        )
        && !event.metaKey
        && !event.shiftKey
        && event.key === "p"
    ) {
        event.preventDefault();
        const text = editor.get_text();
        const cursor = editor.get_cursor();
        editor.edit([], select_paragraph(cursor, text));
    }
}

if (import.meta.main) {
    document.documentElement.innerHTML = "";
    document.body.style.whiteSpace = "pre";
    document.body.textContent = `Alt+P (Windows) or ⌃P (Mac)

Expand the selection
to the paragraph.
`;
    const editor = ed({
        element: document.body,
        on_keydown(event) {
            ed_select_paragraph(editor, event);
        }
    });
}

export default Object.freeze(ed_select_paragraph);
