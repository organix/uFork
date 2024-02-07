// Support for indenting and outdenting using the tab key.

function handle_tab(editor, event, indent) {
    if (event.defaultPrevented) {
        return;
    }
    const text = editor.get_text();
    const cursor = editor.get_cursor();
    const cursor_start = Math.min(...cursor);
    const cursor_end = Math.max(...cursor);
    const is_collapsed = cursor_start === cursor_end;
    const pre = text.slice(0, cursor_start);
    const line_pre = pre.split("\n").pop();

// Increase indentation.

    if (event.key === "Tab") {
        event.preventDefault();
        editor.insert_text(indent.slice(line_pre.length % indent.length));
    }

// Decrease indentation.

    if (event.key === "Backspace" && is_collapsed && line_pre.length > 0) {
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

export default Object.freeze(handle_tab);
