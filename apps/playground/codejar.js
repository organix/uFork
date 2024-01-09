/*jslint browser */

import {CodeJar} from "https://esm.sh/codejar@4.2.0";
import tokenize from "https://ufork.org/lib/asm_tokenize.js";

function alter_string(string, alterations) {

// The 'alter_string' function applies an array of substitutions to a string.
// The ranges of the alterations must be disjoint. The 'alterations' parameter
// is an array of arrays like [range, replacement] where the range is an object
// like {start, end}.

    alterations = alterations.slice().sort(function compare(a, b) {
        return a[0].start - b[0].start || a[0].end - b[0].end;
    });
    let end = 0;
    return alterations.map(function ([range, replacement]) {
        const chunk = string.slice(end, range.start) + replacement;
        end = range.end;
        return chunk;
    }).concat(
        string.slice(end)
    ).join(
        ""
    );
}

const rx_html_unsafe = /[<>]/g;

function highlight(element) {
    const source = element.textContent;
    let alterations = [];
    let generator = tokenize(source);
    while (true) {
        const token = generator();
        if (token === undefined) {
            break;
        }
        const kind = (
            token.kind.length === 1
            ? "separator"
            : token.kind
        );
        const text = source.slice(
            token.start,
            token.end
        ).replace(
            rx_html_unsafe,
            ""
        );
        alterations.push([token, `<span class="${kind}">${text}</span>`]);
    }
    element.innerHTML = alter_string(source, alterations);
}

const jar = new CodeJar(
    document.getElementById("editor"),
    highlight,
    {tab: "    "}
);

function fetch_source() {
    const src = new URL(location.href).searchParams.get("src");
    return (
        src
        ? fetch(src).then(function (response) {
            return (
                response.ok
                ? response.text()
                : Promise.reject(new Error(response.status))
            );
        })
        : Promise.resolve("; Write some uFork assembly here...")
    );
}

fetch_source().then(function (source) {
    jar.updateCode(source);
}).catch(function (error) {
    window.alert("Failed to load source: " + error.message);
});
