// Remove the demo, if present, from each JavaScript module. The original files
// are overwritten.

// USAGE

//  $ deno run -A tools/collapse.js path...

/*jslint deno */

import collapse from "https://repletejs.org/collapse.js";

Promise.all(Deno.args.map(function (path) {
    return Deno.readTextFile(path).then(function (text) {
        return Deno.writeTextFile(path, collapse(text, false));
    });
}));
