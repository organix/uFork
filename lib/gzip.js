// Gzip compression and decompression.

//  encode(data)
//      The 'data' may be provided as a string, a Blob, an ArrayBuffer, or a
//      Uint8Array. The returned Promise resolves to a Uint8Array.

//  decode(bytes)
//      The 'bytes' may be provided as a Blob, an ArrayBuffer, or a Uint8Array.
//      The returned Promise resolves to a Uint8Array.

/*jslint web */

function consume(readable_stream) {
    return new Response(readable_stream).arrayBuffer().then(function (buffer) {
        return new Uint8Array(buffer);
    });
}

function encode(data) {
    const plain = new Blob([data]).stream();
    const gzip = new CompressionStream("gzip");
    return consume(plain.pipeThrough(gzip));
}

function decode(bytes) {
    const compressed = new Blob([bytes]).stream();
    const gunzip = new DecompressionStream("gzip");
    return consume(compressed.pipeThrough(gunzip));
}

//debug encode("hello 💸").then(decode).then(function (bytes) {
//debug     console.log(new TextDecoder().decode(bytes));
//debug });

export default Object.freeze({encode, decode});
