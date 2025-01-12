// Make the #nil explicit in #nil-terminated Scheme-style list depictions.

//      (a)             ->      (a . #nil)
//      (a b c)         ->      (a b c . #nil)
//      (#nil)          ->      (#nil . #nil)
//      (a b . c)       ->      (a b . c)

// USAGE

//  $ git ls-tree -r --name-only HEAD >/tmp/paths
//  $ deno run -A tools/touchup_dotted_nil.js prepare /tmp/paths /tmp/touchups
//  $ deno run -A tools/touchup_dotted_nil.js apply /tmp/paths /tmp/touchups

/*jslint deno */

import touchup from "./touchup.js";

const rx_crlf = /\n|\r\n?/;
let rx = /(?<!(?:\w|\)|\?|function\u0020\w*|\]))(\([^\n`()\u0020]+(?:\u0020[^\n`()\u0020]+)*\))/g;

function is_parameter(element) {
    return element.endsWith(",");
}

function is_url(element) {
    return element.startsWith("https://");
}

function is_list(element) {
    return element.includes(",");
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
        const elements = result[1].slice(1, -1).split(" ");
        const end = result.index + result[1].length;
        const line_prefix = text.slice(0, result.index).split(rx_crlf).pop();
        if (
            !elements.some(is_parameter)
            && !elements.some(is_url)
            && elements[elements.length - 2] !== "."
            && (!path.endsWith(".js") || line_prefix.includes("//"))
            && (!path.endsWith(".rs") || line_prefix.includes("//"))
            && (!path.endsWith(".v") || line_prefix.includes("//"))
            && (!path.endsWith(".asm") || line_prefix.includes(";"))
            && elements.some(is_list)
            && text[end] !== ","
        ) {
            hunks.push({
                remove: result[1],
                insert: "(" + elements.join(" ") + " . #nil)",
                position: result.index
            });
        }
    }
    return hunks;
}

if (
    diff(`
        if (err === ufork.E_OK) {
        state 0                 ; size list=(len,blob),...,#nil
    `, "x.asm").length !== 0
) {
    throw new Error("FAIL false positive");
}
if (
    diff(`
        room_beh:                   ; (tx party . content) | (tx party)
        ; (cust p)
        ; (cust,q p)
    `, "x.asm").length !== 1
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
