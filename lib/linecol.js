// Precompute line and column numbers for each character in a string.
// Everything is numbered from zero.

/*jslint global */

function linecol(string) {
    let line = 0;
    let column = 0;

// We should really be counting by Unicode glyphs, not UTF-16 characters.

    return string.split("").map(function (character) {
        const coordinates = {line, column, character};
        if (character === "\n") {
            line += 1;
            column = 0;
        } else {
            column += 1;
        }
        return coordinates;
    });
}

if (import.meta.main) {
    globalThis.console.log(linecol(`
abc
def
    here I am!
`));
}


export default Object.freeze(linecol);
