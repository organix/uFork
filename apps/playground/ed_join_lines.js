// Ed keybinding that joins the selected lines together.

/*jslint browser */

import ed from "./ed.js";

const rx_leading_spaces = /^\u0020*/;

function ed_join_lines(editor, event) {
    if (event.defaultPrevented) {
        return;
    }
    if (editor.is_command(event) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        const text = editor.get_text();
        const cursor = editor.get_cursor();
        let cursor_start = Math.min(...cursor);
        let cursor_end = Math.max(...cursor);
        let alterations;
        let caret = cursor[1];
        const multiline = text.slice(cursor_start, cursor_end).includes("\n");
        if (!multiline) {

// The selection lies on a single line. Expand it to the start of the next line,
// or else the operation will do nothing.

            const post = text.slice(caret);
            const line_post = post.split("\n").shift();
            cursor_end += line_post.length + 1; // \n
        }

// There is a selection. If it spans multiple lines, join them all together.

        const selected = text.slice(cursor_start, cursor_end);
        const lines = selected.split("\n");
        caret = cursor_start;
        alterations = [];
        lines.forEach(function (line, line_nr) {
            if (lines[line_nr + 1] === undefined) {
                return;
            }
            const next = text.slice(caret + line.length + 1);
            const leading_spaces = next.match(rx_leading_spaces)[0];

// Separate the two lines with a space unless the second line is empty.

            const separator = (
                next[0] !== "\n"
                ? " "
                : ""
            );
            alterations.push({
                range: [
                    caret + line.length,
                    caret + line.length + 1 + leading_spaces.length
                ],
                replacement: separator
            });
            caret += line.length + 1;
        });
        editor.edit(alterations, (

// If the cursor was initially collapsed, place it after the join. Otherwise
// maintain the original selection.

            cursor[0] === cursor[1]
            ? [caret, caret]
            : undefined
        ));
    }
}

if (import.meta.main) {
    document.documentElement.innerHTML = "";
    document.body.style.whiteSpace = "pre";
    document.body.textContent = `Ctrl+J (Windows) or ⌘J (Mac)

Joins the current and following lines,
or any selected lines.
`;
    const editor = ed({
        element: document.body,
        on_keydown(event) {
            ed_join_lines(editor, event);
        }
    });
}

export default Object.freeze(ed_join_lines);
