// Text editor support for IR JSON. See ir.md.

/*jslint browser, global */

import dom from "https://ufork.org/lib/dom.js";
import theme from "https://ufork.org/lib/theme.js";

function compile(text, src) {
    try {
        return JSON.parse(text);
    } catch (exception) {
        return {
            lang: "uFork",
            ast: {
                kind: "module",
                import: {},
                define: {},
                export: []
            },
            tokens: [],
            errors: [{
                kind: "error",
                code: "bad_json",
                message: exception.message,
                start: 0,
                end: 0,
                line: 1,
                column: 1,
                src
            }]
        };
    }
}

function highlight(element) {
    const text = element.textContent;
    const ir = compile(text);
    const errors = ir?.errors ?? [];
    element.innerHTML = "";
    element.append(dom(
        "span",
        {
            title: (
                errors.length > 0
                ? "Error: " + ir.errors[0].message
                : "Valid JSON"
            ),
            style: {
                color: (
                    errors.length > 0
                    ? theme.red
                    : theme.green
                )
            }
        },
        text
    ));
}

if (import.meta.main) {
    globalThis.console.log(compile("[1, 2, 3]", "good"));
    globalThis.console.log(compile("some stuff", "bad"));
}

export default Object.freeze({
    compile,
    highlight,
    docs_url: "https://github.com/organix/uFork/blob/main/docs/ir.md",
    indent: "    "
});
