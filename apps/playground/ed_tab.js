// Support for managing indentation with tab, shift+tab, and backspace.

import alter_string from "./alter_string.js";
import alter_cursor from "./alter_cursor.js";

const rx_leading_spaces = /^\u0020*/;

function ed_tab(editor, event, indent) {
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
    const lines = text.slice(cursor_start, cursor_end).split("\n");
    if (event.key === "Tab") {
        event.preventDefault();
        if (lines.length > 1) {

// Multiline.

            lines[0] = line_pre + lines[0];         // expand to start of line
            lines[lines.length - 1] += line_post;   // expand to end of line
            let position = cursor_start - line_pre.length;
            const alterations = lines.map(function (line) {
                const [spaces] = line.match(rx_leading_spaces);
                const indent_alteration = {
                    range: [position, position],
                    replacement: indent
                };
                const outdent_alteration = {
                    range: [
                        position,
                        position + Math.min(spaces.length, indent.length)
                    ],
                    replacement: ""
                };
                position += line.length + 1; // \n
                return (
                    event.shiftKey
                    ? outdent_alteration
                    : indent_alteration
                );
            });
            editor.set_text(alter_string(text, alterations));
            editor.set_cursor(alter_cursor(cursor, alterations));
        } else {

// Insert spaces up to next tabstop.

            editor.insert_text(indent.slice(line_pre.length % indent.length));
        }
    }
    if (event.key === "Backspace" && is_collapsed && line_pre.length > 0) {

// Remove spaces back to previous tabstop.

        const excess = indent.slice(
            0,
            1 + (line_pre.length - 1) % indent.length
        );
        if (line_pre.endsWith(excess)) {
            event.preventDefault();
            editor.set_cursor([
                cursor_start - excess.length,
                cursor_start
            ]);
            editor.insert_text("");
        }
    }
}

export default Object.freeze(ed_tab);
