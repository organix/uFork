// uCode compiler for Deno.

// uCode Forth is accepted on STDIN, Verilog textual memory image is produced on
// STDOUT.

// Example usage:

//      deno run ucode_cli.js <ucode.f >ucode_rom.mem

/*jslint deno, bitwise */

import compile from "./ucode.js";
import disasm from "./ucode_disasm.js";

const text_encoder = new TextEncoder();

// Read the entirety of STDIN as a string.

new Response(Deno.stdin.readable).text().then(function (text) {
    const {errors, words, prog} = compile(text);

// Fail if there was a compilation error.

    if (errors !== undefined && errors.length > 0) {
        errors.forEach(function (err) {
            Deno.stderr.write(text_encoder.encode(
                err.src + ":" + err.line + " " + err.error + "\n"
            ));
        });
        return Deno.exit(1);
    }

// Compose lines of output.

    let lines = [];

/*
// Dump symbol table as leading comments.

    Object.entries(words).forEach(function ([name, word]) {
        if (typeof word === "number" && (word & 0x8000) !== 0) {
            const word_hex = word.toString(16).padStart(4, "0");
            lines.push("// " + word_hex + ": " + name);   // symbol table entry
        }
    });
*/
    prog.forEach(function (word, address) {

// Occasionally include the current word's address in a comment.

        if (address % 16 === 0) {
            const long_hex = address.toString(16).padStart(8, "0");
            lines.push("// 0x" + long_hex);
        }

// Include symbol-table entries as comments.

        const call = 0xC000 | address;
        Object.entries(words).forEach(function ([name, word]) {
            if (word === call) {
                const hex = address.toString(16).padStart(3, "0");
                lines.push("// " + hex + ": " + name);   // symbol table entry
            }
        });

// Encode each word as a hex string, one per line.

        const short_hex = word.toString(16).padStart(4, "0");
        const annotation = disasm(word, words);
        lines.push(
            annotation !== ""
            ? short_hex + "  // " + annotation
            : short_hex
        );
    });

// Include length as a final comment.

    const length_hex = prog.length.toString(16).padStart(8, "0");
    lines.push("// 0x" + length_hex);
    Deno.stdout.write(text_encoder.encode(lines.join("\n") + "\n"));
    return Deno.exit(0);
});
