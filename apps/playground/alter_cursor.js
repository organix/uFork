// Adjusts the cursor to accomodate an array of alterations (see
// alter_string.js). The cursor expands to encompass any alterations that it
// overlaps.

function alter_cursor(cursor, alterations) {
    const cursor_start = Math.min(...cursor);
    const cursor_end = Math.max(...cursor);
    let start = cursor_start;
    let end = cursor_end;
    alterations.forEach(function ({range, replacement}) {
        const [range_start, range_end] = range;
        const difference = replacement.length - (range_end - range_start);
        if (cursor_end > range_start) {

// rrrr         rrrr        rrrr        rrrr
//      cccc      cccc       cc       cccc

            end += difference + Math.max(0, range_end - cursor_end);
        }
        if (cursor_start < range_end) {

//      rrrr      rrrr      rrrr         rr       rrrr
// cccc         cccc         cc         cccc        cccc

            start += Math.min(0, range_start - cursor_start);
        } else {

// rrrr
//      cccc

            start += difference;
        }
    });
    return (
        cursor[0] > cursor[1]
        ? [end, start]
        : [start, end]
    );
}

export default Object.freeze(alter_cursor);
