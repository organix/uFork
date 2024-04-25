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

// Compose rows of columns.
// TODO: explain layout

    let lines = prog.map(function (code, address) {
        const call = 0xC000 | address;
        const line = (
            code.toString(16).padStart(4, "0")
            + " // "
            + "0x" + address.toString(16).padStart(3, "0") + "   "
            + disasm(code, words).padEnd(24, " ")
            + Object.entries(words).filter(function ([ignore, word]) {
                return word === call;
            }).map(function ([name, ignore]) {
                return name;
            }).join(
                " "
            )
        );
        return line.trim();
    });
    lines.unshift("     // [addr]  [disasm]                [names]");
    Deno.stdout.write(text_encoder.encode(lines.join("\n") + "\n"));
    return Deno.exit(0);
});
