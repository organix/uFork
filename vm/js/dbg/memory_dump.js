// Format the contents of uFork ROM or RAM as text.

/*jslint web, global */

import ufork from "../ufork.js";

const bytes_per_word = 4; // 4 bytes === 32 bits
const bytes_per_quad = bytes_per_word * 4;

function memory_dump(bytes, bottom_ptr, gc_colors = []) {
    const nr_quads = Math.floor(bytes.length / bytes_per_quad);
    const data_view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength
    );
    const lines = new Array(nr_quads).fill().map(function (_, ofs) {
        const quad_offset = ofs * bytes_per_quad;
        const fields = new Array(4).fill().map(function (_, field_nr) {
            const byte_offset = quad_offset + (field_nr * bytes_per_word);
            const little = true; // WASM memory is always little endian
            const raw = data_view.getUint32(byte_offset, little);
            return ufork.print(raw);
        });
        const pointer = ufork.print(bottom_ptr + ofs).padStart(9);
        const line = pointer + ": [" + fields.join(", ") + "]";
        if (gc_colors[ofs] !== undefined) {
            const gc_color = ufork.print_gc_color(gc_colors[ofs]).toUpperCase();
            return line.padEnd(64) + gc_color;
        }
        return line;
    });
    return lines.join("\n");
}

if (import.meta.main) {
    const nr_quads = 24;
    let bytes = new Uint8Array(nr_quads * bytes_per_quad);
    crypto.getRandomValues(bytes);
    const rom = memory_dump(bytes, ufork.romptr(0));
    globalThis.console.log(rom);
    const ram = memory_dump(
        bytes,
        ufork.ramptr(0),
        new Array(nr_quads).fill().map(function (_, quad_nr) {
            return ufork.fixnum(quad_nr % 4);
        })
    );
    globalThis.console.log(ram);
}

export default Object.freeze(memory_dump);
