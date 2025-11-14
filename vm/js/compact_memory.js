// Trim a Uint8Array core memory bank of any quads that appear to be above the
// top of memory (that is, those with a T field of #?).

import ufork from "./ufork.js";

const bytes_per_word = 4; // 32 bits
const bytes_per_quad = bytes_per_word * 4;

function compact_memory(bytes) {
    let top = 0;
    let data_view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength
    );
    while (
        bytes.length >= (top + bytes_per_word)
        && data_view.getUint32(top, true) !== ufork.UNDEF_RAW
    ) {
        top += bytes_per_quad;
    }
    return bytes.slice(0, top);
}

if (import.meta.main) {
    const words = new Uint32Array([
        ufork.FREE_T, 0, 0, 0,
        ufork.FIXNUM_T, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0
    ]);
    const bytes = new Uint8Array(words.buffer);
    const trimmed_words = new Uint32Array(
        compact_memory(bytes).buffer
    );
    if (trimmed_words.length !== 8) {
        throw new Error("FAIL");
    }
}

export default Object.freeze(compact_memory);
