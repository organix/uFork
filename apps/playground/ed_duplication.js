// Support for duplicating the selection, or just the current line.

import alter_string from "./alter_string.js";
import alter_cursor from "./alter_cursor.js";

function ed_duplication(editor, event) {
    if (event.defaultPrevented) {
        return;
    }
    if (editor.is_command(event) && event.shiftKey && event.key === "d") {
        event.preventDefault();
        const text = editor.get_text();
        const cursor = editor.get_cursor();
        let alterations;
        if (cursor[0] === cursor[1]) {

// The cursor is collapsed. Duplicate the line.

            const caret = cursor[1];
            const pre = text.slice(0, caret);
            const post = text.slice(caret);
            const line_pre = pre.split("\n").pop();
            const line_post = post.split("\n").shift();
            const line_start = caret - line_pre.length;
            alterations = [{
                range: [line_start, line_start],
                replacement: line_pre + line_post + "\n"
            }];
        } else {

// Duplicate the selection.

            const cursor_start = Math.min(...cursor);
            const cursor_end = Math.max(...cursor);
            alterations = [{
                range: [cursor_start, cursor_start],
                replacement: text.slice(cursor_start, cursor_end)
            }];
        }
        editor.set_text(alter_string(text, alterations));
        editor.set_cursor(alter_cursor(cursor, alterations));
    }
}

export default Object.freeze(ed_duplication);
