// Format the contents of uFork ROM or RAM as text.

/*jslint web, global */

import ufork from "../ufork.js";

const bytes_per_word = 4; // 32 bits
const bytes_per_quad = bytes_per_word * 4;

function memory_dump(bytes, bottom_ptr, gc_colors = []) {
    const nr_quads = Math.floor(bytes.length / bytes_per_quad);
    const lines = new Array(nr_quads).fill().map(function (_, quad_nr) {
        const address = ufork.print(bottom_ptr + quad_nr).padStart(9);
        const quad = ufork.read_quad(bytes, quad_nr);
        const line = address + ": " + ufork.print_quad(quad);
        if (gc_colors[quad_nr] !== undefined) {
            const color = gc_colors[quad_nr];
            return line.padEnd(64) + ufork.print_gc_color(color).toUpperCase();
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
