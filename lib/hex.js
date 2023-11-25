// This module exports functions for encoding and decoding Uint8Arrays as
// hexadecimal strings.

function encode(uint8array) {

// We can not use the Uint8Array's 'map' method, as it attempts to cast our hex
// pairs back to integers.

    return Array.from(
        uint8array,
        function hexify(byte) {
            return byte.toString(16).padStart(2, "0");
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

export default Object.freeze({encode, decode});
