// Command-line linter for uFork assembly files. Reads source from stdin, writes
// errors to stdout one per line, like

//  <line>:<col> <msg>

/*jslint node */

import assemble from "./www/assemble.js";

let chunks = [];
process.stdin.setEncoding("utf8");
process.stdin.on("data", function (chunk) {
    chunks.push(chunk);
});
process.stdin.on("end", function () {
    const source = chunks.join("");
    const result = assemble(source);
    if (result.kind === "error") {
        console.log(result.line + ":" + result.column + " " + result.message);
    }
});
