// This module exports functions for encoding and decoding Uint8Arrays as
// hexadecimal strings.

/*jslint web, global, bitwise */

function from(number, nr_bits = 32) {

// Converts a number ('nr_bits' wide) into a hexadecimal string.

// The following bitwise expression is equivalent to Math.ceil(nr_bits / 4),
// but is two orders of magnitude faster.

    const digits = (nr_bits + 0b11) >> 2;
    return number.toString(16).padStart(digits, "0");
}

function encode(uint8array) {

// We can not use the Uint8Array's 'map' method, as it attempts to cast our hex
// pairs back to integers.

    return Array.from(
        uint8array,
        function hexify(byte) {
            return from(byte, 8);
        }
    ).join("").toUpperCase();
}

function decode(string) {

// Each byte is represented as two hexadecimal digits.

    let bytes = [];
    string.replace(/../g, function (pair) {
        bytes.push(parseInt(pair, 16));
    });
    return new Uint8Array(bytes);
}

if (import.meta.main) {
    globalThis.console.log(encode(decode("FF0c10")));
    globalThis.console.log(encode(decode("")));
}

export default Object.freeze({from, encode, decode});
