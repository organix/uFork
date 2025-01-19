// Remove the demo, if present, from each JavaScript module. The original files
// are overwritten.

// USAGE

//  $ deno run -A tools/purify.js path...

/*jslint deno */

import bind_main from "https://ufork.org/lib/bind_main.js";

Promise.all(Deno.args.map(function (path) {
    return Deno.readTextFile(path).then(function (text) {
        return Deno.writeTextFile(path, bind_main(text, false));
    });
}));
