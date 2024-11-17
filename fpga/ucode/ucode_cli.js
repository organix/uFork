// uCode compiler for Deno.

// uCode Forth is accepted on STDIN, Verilog textual memory image is produced on
// STDOUT.

// Example usage:

//      deno run ucode_cli.js <ucode.f >ucode_rom.mem

/*jslint deno */

import ucode from "./ucode.js";

const text_encoder = new TextEncoder();

// Read the entirety of STDIN as a string.

new Response(Deno.stdin.readable).text().then(function (text) {
    const {errors, words, prog} = ucode.compile(text);

// Fail if there was a compilation error.

    if (errors !== undefined && errors.length > 0) {
        errors.forEach(function (err) {
            Deno.stderr.write(text_encoder.encode(
                err.src + ":" + err.line + " " + err.error + "\n"
            ));
        });
        return Deno.exit(1);
    }

// Pretty-print annotated Verilog memory image.

    const memh = ucode.print_memh(prog, words);
    Deno.stdout.write(text_encoder.encode(memh));
    return Deno.exit(0);
});
