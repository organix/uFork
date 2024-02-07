// Performs a series of alterations on a string and returns the new string.

// The 'alterations' array contains objects like {range, replacement} where
// 'replacement' is a string to insert at the 'range', an array like
// [start, end] where 'start' and 'end' are positions in the original string.

// The alterations may be provided in any order, but should not overlap.

function alter_string(string, alterations) {
    alterations = alterations.slice().sort(function compare(a, b) {
        return a.range[0] - b.range[0] || a.range[1] - b.range[1];
    });
    let end = 0;
    return alterations.map(function ({range, replacement}) {
        const chunk = string.slice(end, range[0]) + replacement;
        end = range[1];
        return chunk;
    }).concat(
        string.slice(end)
    ).join(
        ""
    );
}

export default Object.freeze(alter_string);
