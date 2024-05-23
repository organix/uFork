// uCode compiler for Deno.

// uCode Forth is accepted on STDIN, Verilog textual memory image is produced on
// STDOUT.

// Example usage:

//      deno run ucode_cli.js <ucode.f >ucode_rom.mem

/*jslint deno, bitwise */

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

// Compose rows of columns.

    let lines = [
        "//  CODE    ADR  DISASM                  NAMES                     //",
        "/////////////////////////////////////////////////////////////////////"
//           021f // 0ac: (LIT)                   RX? KEY?
//           0002 // 0ad: 0x0002
//           533f // 0ae: IO@ EXIT
//           c0ac // 0af: RX?                     KEY
//           90af // 0b0: jump_ifzero(0af)
// E.g.      021f // 0b1: (LIT)                   RX@
//           0003 // 0b2: 0x0003
//           533f // 0b3: IO@ EXIT
//           2100 // 0b4: >R                      SPACES
//           80b7 // 0b5: jump(0b7)
//           c0a6 // 0b6: SPACE
//           b0b6 // 0b7: jump_ifnz_dec(0b6)
//           5000 // 0b8: NOP EXIT
    ];
    lines = lines.concat(prog.map(function (code, address) {
        const call = 0xC000 | address;
        const line = (
            "    " + code.toString(16).padStart(4, "0")             // CODE
            + " // " + address.toString(16).padStart(3, "0") + ": " // ADR
            + ucode.disasm(code, words).padEnd(24, " ")             // DISASM
            + Object.entries(                                       // NAMES
                words
            ).filter(function ([ignore, word]) {
                return word === call;
            }).map(function ([name, ignore]) {
                return name;
            }).join(
                " "
            )
        );
        return line.trimEnd();
    }));
    Deno.stdout.write(text_encoder.encode(lines.join("\n") + "\n"));
    return Deno.exit(0);
});
