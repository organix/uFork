// uFork's Replete configuration. Replete is a JavaScript REPL for the browser,
// Node.js, and Deno. The VSCode extension is available at
// https://marketplace.visualstudio.com/items?itemName=jamesdiacono.Replete.

// Its 'source' function enables specially commented code during evaluation,
// making it possible to run the tests embedded in many of uFork's JavaScript
// modules.

// Its 'mime' function allows the REPL to serve a wide variety of files,
// including uFork assembly and WASM binaries.

/*jslint deno, long */

import ecomcon from "https://raw.githubusercontent.com/douglascrockford/ecomcon/master/ecomcon.js";
import run_replete from "https://deno.land/x/replete/run.js";

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
    svg: "image/svg+xml"
};

run_replete({
    browser_port: 3675,
    which_node: "node",
    deno_args: ["--allow-all"],
    source(command) {
        return Promise.resolve(
            ecomcon(command.source, ["debug"])
        );
    },
    mime(locator) {
        return mime_types[locator.split(".").pop()];
    }
});
