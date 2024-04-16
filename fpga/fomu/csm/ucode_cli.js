// uCode compiler for Deno.

// uCode Forth is accepted on STDIN, Verilog textual memory image is produced on
// STDOUT.

// Example usage:

//      deno run ucode_cli.js <ucode.f >ucode_rom.mem

/*jslint deno */

import compile from "./ucode.js";

const text_encoder = new TextEncoder();

// Read the entirety of STDIN as a string.

new Response(Deno.stdin.readable).text().then(function (text) {
    const word_array = compile(text);

// Fail if there was a compilation error.

    if (!Array.isArray(word_array)) {
        Deno.stderr.write(text_encoder.encode(word_array + "\n"));
        return Deno.exit(1);
    }

// Encode each word as a hex string, one per line. Occasionally include the
// current word's address in a comment.

    let lines = [];
    word_array.forEach(function (word, address) {
        if (address % 16 === 0) {
            const address_hex = address.toString(16).padStart(8, "0");
            lines.push("// 0x" + address_hex);
        }
        const word_hex = word.toString(16).padStart(4, "0");
        lines.push(word_hex);
    });
    const mem = lines.join("\n") + "\n";
    Deno.stdout.write(text_encoder.encode(mem));
    return Deno.exit(0);
});
