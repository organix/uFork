// Optimizes the playground for production.

// All we do is inject <link rel="preload"> tags into index.html, avoiding the
// long chain of network roundtrips otherwise necessary to load the
// playground's scripts and other assets.

// Usage:

//  deno run --allow-read --allow-write optimize.js <path_to_index_html>

/*jslint deno */

import import_map from "../../tools/import_map.js";
const playground_href = import.meta.resolve("./");
const main_href = import.meta.resolve("./main.js");

function map_import(url) {
    const alias = Object.keys(import_map).find(function (key) {
        return url.href.startsWith(key);
    });
    return (
        alias !== undefined
        ? new URL(url.href.replace(alias, import_map[alias]))
        : url
    );
}

// Traverse the JavaScript module graph.

const rx_import_statement = /^import\s[^]+?\sfrom\s"([^"]+)";/gm;
const rx_import_meta_resolve = /^const\s\w+\s=\simport\.meta\.resolve\(\s*"([^"]+)"\s*\)/gm;

// Capturing groups:
//  [1] import specifier

function follow_imports(url, seen = []) {
    if (seen.includes(url.href)) {
        return Promise.resolve(seen);
    }
    if (!url.href.endsWith("/")) {
        seen.push(url.href);
    }
    if (url.href.endsWith(".js")) {
        return fetch(
            map_import(url)
        ).then(function (response) {
            return response.text();
        }).then(function (text) {
            const match_array = [
                ...text.matchAll(rx_import_statement),
                ...text.matchAll(rx_import_meta_resolve)
            ];
            return Promise.all(match_array.map(function (matches) {
                const specifier = matches[1];
                const import_url = new URL(specifier, url);
                return follow_imports(import_url, seen);
            }));
        }).then(function () {
            return seen;
        });
    }
    return Promise.resolve(seen);
}

const path_to_index_html = Deno.args[0];
Promise.all([
    follow_imports(new URL(main_href)),
    Deno.readTextFile(path_to_index_html)
]).then(function ([hrefs, html]) {
    const preload_elements = hrefs.map(function (href) {
        const extension = href.split(".").pop();
        const relative_href = href.replace(
            playground_href,
            ""
        ).replace(
            "https://ufork.org/",
            "../"
        );
        if (extension === "js") {
            return `<link rel="modulepreload" href="${
                relative_href
            }" as="script" />`;
        }
        const as = (
            extension === "woff2"
            ? "font"
            : "fetch"
        );
        return `<link rel="preload" crossorigin="anonymous" href="${
            relative_href
        }" as="${as}" />`;
    });
    return Deno.writeTextFile(
        path_to_index_html,
        html.replace(
            "<!-- PRELOADS GO HERE -->",
            preload_elements.sort().join("\n")
        )
    );
});
