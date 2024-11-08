// Expand a cursor to encompass the paragraph. Newlines preceeding or following
// the paragraph are excluded from the selection. The direction of the cursor
// is preserved.

function find_paragraph_edge(text, position, reverse) {
    while (position >= 0 && position <= text.length) {
        const next = text[
            reverse
            ? position - 1
            : position
        ];
        const next_next = text[
            reverse
            ? position - 2
            : position + 1
        ];
        if (
            (next === undefined || next === "\n")
            && (next_next === undefined || next_next === "\n")
        ) {
            return position;
        }
        position += (
            reverse
            ? -1
            : 1
        );
    }
}

if (import.meta.main) {
    [
        ["", 0, false, 0],
        ["", 0, true, 0],
        ["abc", 0, false, 3],
        ["abc", 0, true, 0],
        ["abc", 3, false, 3],
        ["abc", 3, true, 0],
        ["\nabc\ndef\n\nghi", 6, false, 8],
        ["\nabc\ndef\n\nghi", 6, true, 1]
    ].forEach(function ([text, position, reverse, expected]) {
        const actual = find_paragraph_edge(text, position, reverse);
        if (actual !== expected) {
            throw new Error("FAIL find_paragraph_edge");
        }
    });
}

function select_paragraph(cursor, text) {
    let start = Math.min(...cursor);
    let end = Math.max(...cursor);
    start = find_paragraph_edge(text, start, true);
    end = find_paragraph_edge(text, end, false);
    if (cursor[1] < cursor[0]) {
        [start, end] = [end, start];
    }
    return [start, end];
}

export default Object.freeze(select_paragraph);
