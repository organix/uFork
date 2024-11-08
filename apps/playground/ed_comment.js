// Ed keybinding that comments or uncomments single or multiple lines.

/*jslint browser */

import ed from "./ed.js";

function ed_comment(editor, event, rx_comment, comment_prefix) {
    if (event.defaultPrevented) {
        return;
    }
    if (editor.is_command(event) && event.key === "/") {
        event.preventDefault();
        const text = editor.get_text();
        const cursor = editor.get_cursor();
        const cursor_start = Math.min(...cursor);
        const cursor_end = Math.max(...cursor);
        const pre = text.slice(0, cursor_start);
        const post = text.slice(cursor_end);
        const line_pre = pre.split("\n").pop();
        const line_post = post.split("\n").shift();
        let line_start = cursor_start - line_pre.length;
        let line_end = cursor_end + line_post.length;
        const lines = text.slice(line_start, line_end).split("\n");

// If some lines are commented and some aren't, comment all non-empty lines.

        let comment = false;
        const matches_array = lines.map(function (line) {
            const matches = line.match(rx_comment);
            if (!matches && line !== "") {
                comment = true;
            }
            return matches;
        });
        let alterations = [];
        lines.forEach(function (line, line_nr) {
            if (comment) {
                if (line !== "") {
                    alterations.push({
                        range: [line_start, line_start],
                        replacement: comment_prefix
                    });
                }
            } else {
                const matches = matches_array[line_nr];
                if (matches) {

// Capturing groups:
//  [1] indentation
//  [2] semicolon(s) optionally followed by a space

                    alterations.push({
                        range: [
                            line_start + matches[1].length,
                            line_start + matches[0].length
                        ],
                        replacement: ""
                    });
                }
            }
            line_start += line.length + 1; // account for \n
        });
        editor.edit(alterations);
    }
}

if (import.meta.main) {
    document.documentElement.innerHTML = "";
    document.body.style.whiteSpace = "pre";
    document.body.textContent = `Ctrl+/ (Windows) or ⌘/ (Mac)

Comment or uncomment the current line,
or each line of selected text.

Blank lines are left alone.
`;
    const editor = ed({
        element: document.body,
        on_keydown(event) {
            ed_comment(editor, event, /^(\s*)(#\u0020?)/, "# ");
        }
    });
    document.body.focus();
}

export default Object.freeze(ed_comment);
