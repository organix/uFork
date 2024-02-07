// Command-line linter for uFork assembly files. Reads source from stdin, writes
// errors to stdout one per line, like

//  <line>:<col> <msg>

/*jslint deno */

import assemble from "https://ufork.org/lib/assemble.js";

let decoder = new TextDecoder();
let text = "";
let buffer = new Uint8Array(4096);
Deno.stdin.read(buffer).then(function on_chunk(nr_bytes) {
    if (Number.isSafeInteger(nr_bytes)) {
        text += decoder.decode(
            buffer.slice(0, nr_bytes),
            {stream: true}
        );
        return Deno.stdin.read(buffer).then(on_chunk);
    }
    const crlf = assemble(text);
    if (Array.isArray(crlf.errors)) {
        crlf.errors.forEach(function (error) {
            window.console.log(
                error.line + ":" + error.column + " " + error.message
            );
        });
    }
});
