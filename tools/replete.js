// uFork's Replete configuration. Replete is a JavaScript REPL for the browser,
// Node.js, and Deno. The VSCode extension is available at
// https://marketplace.visualstudio.com/items?itemName=jamesdiacono.Replete.

// Its 'source' function enables specially commented code during evaluation,
// making it possible to run the tests embedded in many of uFork's JavaScript
// modules.

// Its 'mime' function allows the REPL to serve a wide variety of files,
// including uFork assembly and WASM binaries.

/*jslint deno, long */

import ecomcon from "https://raw.githubusercontent.com/douglascrockford/ecomcon/b3eda9196a827666af178199aff1c5b8ad9e45b3/ecomcon.js";
import run_replete from "https://deno.land/x/replete/run.js";
import import_map from "./import_map.js";

const mime_types = {
    js: "text/javascript",
    mjs: "text/javascript",
    wasm: "application/wasm",
    asm: "text/plain",
    css: "text/css",
    html: "text/html",
    map: "application/json",
    json: "application/json",
    jpg: "image/jpeg",
    png: "image/png",
    svg: "image/svg+xml",
    woff2: "font/woff2"
};

run_replete({
    browser_port: 3675,
    which_node: "node",
    deno_args: ["--allow-all"],
    source(command) {
        return Promise.resolve(ecomcon(command.source, ["debug"]));
    },
    locate(specifier, parent_locator) {

// Consult the import map.

        const alias = Object.keys(import_map).find(function (key) {
            return specifier.startsWith(key);
        });
        if (alias !== undefined) {
            specifier = specifier.replace(alias, import_map[alias]);
        }

// Pass thru network specifiers.

        if (/^\w+:/.test(specifier)) {
            return Promise.resolve(specifier);
        }

// Resolve relative specifiers against the importing module.

        if (specifier.startsWith(".")) {
            return Promise.resolve(new URL(specifier, parent_locator).href);
        }

// Don't bother searching "node_modules", we don't use it.

        return Promise.reject(new Error("Not found."));
    },
    mime(locator) {
        const extension = new URL(locator).pathname.split(".").pop();
        return mime_types[extension];
    }
});
