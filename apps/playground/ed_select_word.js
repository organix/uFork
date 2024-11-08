// Ed keybinding that selects the word at the collapsed cursor, or the next
// occurrence of the selected text.

/*jslint browser */

import ed from "./ed.js";
import select_word from "./select_word.js";

function ed_select_word(editor, event) {
    if (event.defaultPrevented) {
        return;
    }
    if (editor.is_command(event) && !event.altKey && event.key === "d") {
        event.preventDefault();
        const text = editor.get_text();
        const cursor = editor.get_cursor();
        const is_collapsed = cursor[0] === cursor[1];
        if (is_collapsed) {
            return editor.edit([], select_word(cursor, text));
        }
        const cursor_start = Math.min(...cursor);
        const cursor_end = Math.max(...cursor);
        const selected_text = text.slice(cursor_start, cursor_end);
        let next_at = text.indexOf(selected_text, cursor_end);
        if (next_at === -1) {
            next_at = text.indexOf(selected_text); // wrap around
        }
        editor.edit([], [next_at, next_at + selected_text.length]);
        editor.show_cursor();
    }
}

if (import.meta.main) {
    document.documentElement.innerHTML = "";
    document.body.style.whiteSpace = "pre";
    document.body.textContent = `Ctrl+D (Windows) or ⌘D (Mac)

Select the current word, or select the
next occurrence of the selected text.
`;
    const editor = ed({
        element: document.body,
        on_keydown(event) {
            ed_select_word(editor, event);
        }
    });
}

export default Object.freeze(ed_select_word);
