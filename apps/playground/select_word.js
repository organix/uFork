// Expand a cursor to encompass the current word. The direction of the cursor is
// preserved.

const rx_word = /\w/;

function find_word_edge(text, position, reverse) {
    while (position >= 0 && position <= text.length) {
        const next = text[
            reverse
            ? position - 1
            : position
        ];
        if (next === undefined || !rx_word.test(next)) {
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
        ["12.34 ", 0, false, 2],
        ["12.34 ", 1, false, 2],
        ["12.34 ", 2, false, 2],
        ["12.34 ", 3, false, 5],
        ["12.34 ", 4, false, 5],
        ["12.34 ", 5, false, 5],
        ["12.34 ", 6, false, 6],
        [" 12.34", 0, true, 0],
        [" 12.34", 1, true, 1],
        [" 12.34", 2, true, 1],
        [" 12.34", 3, true, 1],
        [" 12.34", 4, true, 4],
        [" 12.34", 5, true, 4],
        [" 12.34", 6, true, 4]
    ].forEach(function ([text, position, reverse, expected], case_nr) {
        const actual = find_word_edge(text, position, reverse);
        if (actual !== expected) {
            throw new Error("FAIL find_word_edge" + case_nr);
        }
    });
}

function select_word(cursor, text) {
    let start = Math.min(...cursor);
    let end = Math.max(...cursor);
    start = find_word_edge(text, start, true);
    end = find_word_edge(text, end, false);
    if (cursor[1] < cursor[0]) {
        [start, end] = [end, start];
    }
    return [start, end];
}

export default Object.freeze(select_word);
