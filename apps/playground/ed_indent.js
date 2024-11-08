// Ed keybindings for managing indentation.

/*jslint browser */

import ed from "./ed.js";

const rx_leading_spaces = /^\u0020*/;

function ed_indent(editor, event, indent = "    ") {
    if (event.defaultPrevented) {
        return;
    }
    if (event.key === "Tab" || event.key === "Backspace") {
        const text = editor.get_text();
        const cursor = editor.get_cursor();
        const cursor_start = Math.min(...cursor);
        const cursor_end = Math.max(...cursor);
        const is_collapsed = cursor_start === cursor_end;
        const pre = text.slice(0, cursor_start);
        const post = text.slice(cursor_end);
        const line_pre = pre.split("\n").pop();
        const line_post = post.split("\n").shift();
        let lines = text.slice(cursor_start, cursor_end).split("\n");
        if (event.key === "Tab") {
            event.preventDefault();
            if (lines.length > 1 || event.shiftKey) {

// Indent or outdent a multiline block.

// Expand the selection to the start of the first line.

                lines[0] = line_pre + lines[0];

// Expand the selection to the end of the last line if at least one character of
// that line has been selected. Otherwise contract the selection to exclude the
// last line.

                if (lines[lines.length - 1] !== "") {
                    lines[lines.length - 1] += line_post;
                } else {
                    lines.pop();
                }
                let position = cursor_start - line_pre.length;
                let alterations = [];
                lines.forEach(function (line) {
                    if (line !== "") {
                        const [spaces] = line.match(rx_leading_spaces);
                        const indent_alteration = {
                            range: [position, position],
                            replacement: indent
                        };
                        const outdent_alteration = {
                            range: [
                                position,
                                position + Math.min(
                                    spaces.length,
                                    indent.length
                                )
                            ],
                            replacement: ""
                        };
                        alterations.push(
                            event.shiftKey
                            ? outdent_alteration
                            : indent_alteration
                        );
                    }
                    position += line.length + 1; // \n
                });
                editor.edit(alterations);
            } else {

// Insert spaces up to next tabstop.

                editor.insert(indent.slice(line_pre.length % indent.length));
            }
        } else if (
            event.key === "Backspace"
            && is_collapsed
            && line_pre.length > 0
        ) {

// Remove spaces back to previous tabstop.

            const excess = indent.slice(
                0,
                1 + (line_pre.length - 1) % indent.length
            );
            if (line_pre.endsWith(excess)) {
                event.preventDefault();
                editor.edit([{
                    range: [
                        cursor_start - excess.length,
                        cursor_start
                    ],
                    replacement: ""
                }]);
            }
        }
    }
}

if (import.meta.main) {
    document.documentElement.innerHTML = "";
    document.body.style.fontFamily = "monospace";
    document.body.style.whiteSpace = "pre";
    document.body.textContent = `Tab increases the indentation.
    Shift+Tab decreases the indentation.
        Backspace consumes the preceeding indentation, if there is one.
`;
    const editor = ed({
        element: document.body,
        on_keydown(event) {
            ed_indent(editor, event);
        }
    });
}

export default Object.freeze(ed_indent);
