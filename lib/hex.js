// This module exports functions for encoding and decoding Uint8Arrays as
// hexadecimal strings.

/*jslint bitwise */

// Convert a number (nbits wide) into a hexadecimal string.

function nybbles(nbits) {
    return ((nbits + 0b11) >> 2);  // Math.ceil(nbits / 4);
}
function from(number, nbits = 32) {
    const digits = nybbles(nbits);
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

//debug console.log(encode(decode("FF0c10")));
//debug console.log(encode(decode("")));

//debug function nibbles(nbits) {
//debug     return Math.ceil(nbits / 4);
//debug }
//debug function perf_test(fn) {
//debug     let n = 0;
//debug     let i = 0x00FF_FFFF;
//debug     const t0 = performance.now();
//debug     while (i !== 0) {
//debug         n ^= fn(i);
//debug         i -= 1;
//debug     }
//debug     const t1 = performance.now();
//debug     const dt = (t1 - t0);
//debug     console.log("dt=", dt, "t0=", t0, "t1=", t1);
//debug     return dt;
//debug }
//debug const t_y = perf_test(nybbles);
//debug const t_i = perf_test(nibbles);
//debug console.log("ratio i/y:", (t_i / t_y));

export default Object.freeze({from, encode, decode});
