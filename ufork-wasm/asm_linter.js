// Command-line linter for uFork assembly files. Reads source from stdin, writes
// errors to stdout one per line, like

//  <line>:<col> <msg>

/*jslint deno */

import assemble from "./www/assemble.js";

let decoder = new TextDecoder();
let source = "";
let buffer = new Uint8Array(4096);
Deno.stdin.read(buffer).then(function on_chunk(nr_bytes) {
    if (Number.isSafeInteger(nr_bytes)) {
        source += decoder.decode(buffer.slice(0, nr_bytes), {stream: true});
        return Deno.stdin.read(buffer).then(on_chunk);
    }
    const result = assemble(source);
    if (result.kind === "error") {
        window.console.log(
            result.line + ":" + result.column + " " + result.message
        );
    }
});
