// Concatenate two Uint8Arrays. Involves copying.

function concat_bytes(a, b) {
    let array = new Uint8Array(a.byteLength + b.byteLength);
    array.set(a, 0);
    array.set(b, a.byteLength);
    return array;
}

export default Object.freeze(concat_bytes);
