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
    const result = compile(text);

// Fail if there was a compilation error.

    if (result?.errors?.length) {
        result.errors.forEach(function (err) {
            Deno.stderr.write(text_encoder.encode(
                err.src + ":" + err.line + " " + err.error + "\n"));
        })
        return Deno.exit(1);
    }

// Compose lines of output.

    let lines = [];

/*
// Dump symbol table as leading comments.

    for (const [name, word] of Object.entries(result.words)) {
        if (typeof word === "number" && (word & 0x8000 !== 0)) {
            const word_hex = word.toString(16).padStart(4, "0");
            lines.push("// " + word_hex + ": " + name);   // symbol table entry
        }
    }
*/

    result.prog.forEach(function (word, address) {

// Occasionally include the current word's address in a comment.

        if (address % 16 === 0) {
            const address_hex = address.toString(16).padStart(8, "0");
            lines.push("// 0x" + address_hex);
        }

// Include symbol-table entries as comments.

        const call = 0xC000 | address;
        for (const [name, word] of Object.entries(result.words)) {
            if (word === call) {
                const address_hex = address.toString(16).padStart(3, "0");
                lines.push("// " + address_hex + ": " + name);   // symbol table entry
            }
        }

// Encode each word as a hex string, one per line.

        const word_hex = word.toString(16).padStart(4, "0");
        lines.push(word_hex);

    });

// Include length as a final comment.

    const length_hex = result.prog.length.toString(16).padStart(8, "0");
    lines.push("// 0x" + length_hex);

    const mem = lines.join("\n") + "\n";
    Deno.stdout.write(text_encoder.encode(mem));

    return Deno.exit(0);
});
