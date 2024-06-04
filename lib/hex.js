// This module exports functions for encoding and decoding Uint8Arrays as
// hexadecimal strings.

/*jslint bitwise */

// Convert a number (nbits wide) into a hexadecimal string.

function from(number, nbits = 32) {
    return number.toString(16).padStart(((nbits + 0x3) >> 2), "0");
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

//debug console.log(encode(decode("FF0c10")));
//debug console.log(encode(decode("")));

export default Object.freeze({from, encode, decode});
