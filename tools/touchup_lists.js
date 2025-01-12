// Rewrite dotted tail Scheme-style pairlist depictions in the Humus style,
// where elements are separated by commas.

//      (a . b)         ->      a,b
//      (a b . c)       ->      a,b,c
//      (#nil . #nil)   ->      #nil,#nil

// USAGE

//  $ git ls-tree -r --name-only HEAD >/tmp/paths
//  $ deno run -A tools/touchup_lists.js prepare /tmp/paths /tmp/touchups
//  $ deno run -A tools/touchup_lists.js apply /tmp/paths /tmp/touchups

/*jslint deno */

import touchup from "./touchup.js";

let rx = /(\([^\n`()\u0020]+(?:\u0020[^\n`()\u0020]+)*\))/g;

function wrap_if_list(element) {
    return (
        element.includes(",")
        ? "(" + element + ")"
        : element
    );
}

function diff(text, path) {
    if (
        path.endsWith(".hum")
        || path.endsWith(".scm")
    ) {
        return [];
    }
    let hunks = [];
    rx.lastIndex = 0;
    while (true) {
        const result = rx.exec(text);
        if (!Array.isArray(result)) {
            break;
        }
        let elements = result[1].slice(1, -1).split(" ");
        const dot = elements.length - 2;
        const tail = elements.length - 1;
        if (elements[dot] === ".") {
            elements.splice(dot, 1);
            hunks.push({
                remove: result[1],
                insert: elements.slice(
                    0,
                    tail
                ).map(
                    wrap_if_list
                ).concat(
                    elements.slice(tail) // no need to wrap the tail
                ).join(
                    ","
                ),
                position: result.index
            });
        }
    }
    return hunks;
}

if (
    diff(`
        (a b)
        (a b .c)
    `, "x.asm").length !== 0
) {
    throw new Error("FAIL false positive");
}
if (
    diff(`
        (a . b)
        (a b . c)
        (#nil . #nil)
    `, "x.asm").length !== 3
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
