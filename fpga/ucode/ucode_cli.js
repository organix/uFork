// uCode compiler for Deno.

// uCode Forth is accepted on STDIN, Verilog textual memory image is produced on
// STDOUT.

// Example usage:

//      deno run ucode_cli.js <ucode.f >ucode_rom.mem

/*jslint deno, global */

import ucode from "./ucode.js";

function report(err) {
    globalThis.console.error("line " + err.line + ": " + err.error);
}

// Read the entirety of STDIN as a string.

new Response(Deno.stdin.readable).text().then(function (text) {
    const {errors, warnings, words, prog} = ucode.compile(text);

// Fail if there was a compilation error.

    if (errors !== undefined && errors.length > 0) {
        errors.forEach(report);
        return Deno.exit(1);
    }
    warnings.forEach(report);

// Pretty-print annotated Verilog memory image.

    const memh = ucode.print_memh(prog, words);
    globalThis.console.log(memh);
    return Deno.exit(0);
});
