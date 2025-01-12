// Replaces () in stack diagrams with #nil.

// USAGE

//  $ git ls-tree -r --name-only HEAD | grep -Ev ".(scm|hum)$" >/tmp/paths
//  $ deno run -A tools/touchup_nil.js prepare /tmp/paths /tmp/touchups
//  $ deno run -A tools/touchup_nil.js apply /tmp/paths /tmp/touchups

/*jslint deno */

import touchup from "./touchup.js";

let rx = /(?<!(?:function\u0020|\w|\}|\]|<|>))(\(\))(?!\u0020=>)/g;

function diff(text) {
    let hunks = [];
    rx.lastIndex = 0;
    while (true) {
        const result = rx.exec(text);
        if (!Array.isArray(result)) {
            break;
        }
        hunks.push({
            remove: result[1],
            insert: "#nil",
            position: result.index
        });
    }
    return hunks;
}

if (
    diff(`
        (function () {
            asdf();
        }());
        Result<(), Error>
        ::core::mem::size_of::<BlobDevice>()
        watcher[Symbol.asyncIterator]()
        () => true
    `).length !== 0
) {
    throw new Error("FAIL false positive");
}
if (
    diff(`
        () ((a () (b . x) . c)) (foo=())
    `).length !== 3
) {
    throw new Error("FAIL false negative");
}

const [subcommand, path_file, touchup_file] = Deno.args;
if (subcommand === "prepare") {
    touchup.prepare_all(path_file, touchup_file, diff);
} else if (subcommand === "apply") {
    touchup.apply_all(path_file, touchup_file);
} else {
    throw new Error("Bad subcommand.");
}
