// uFork's Replete configuration. Replete is a JavaScript REPL for the browser,
// Node.js, and Deno. The VSCode extension is available at
// https://marketplace.visualstudio.com/items?itemName=jamesdiacono.Replete.

// Its 'command' function enables specially commented code during evaluation,
// making it possible to run the tests embedded in many of uFork's JavaScript
// modules.

// Its 'mime' function allows the REPL to serve a wide variety of files,
// including uFork assembly and WASM binaries.

/*jslint deno, long */

import {toFileUrl} from "https://deno.land/std@0.203.0/path/to_file_url.ts";
import {fromFileUrl} from "https://deno.land/std@0.203.0/path/from_file_url.ts";
import ecomcon from "https://raw.githubusercontent.com/douglascrockford/ecomcon/b3eda9196a827666af178199aff1c5b8ad9e45b3/ecomcon.js";
import run_replete from "https://deno.land/x/replete@0.0.25/run.js";
// import {minify} from "https://esm.sh/terser";
import import_map from "./import_map.js";

const content_types = {
    asm: "text/plain",
    css: "text/css",
    html: "text/html; charset=utf-8",
    jpg: "image/jpeg",
    js: "text/javascript",
    json: "application/json",
    map: "application/json",
    mjs: "text/javascript",
    png: "image/png",
    hum: "text/plain",
    scm: "text/plain",
    svg: "image/svg+xml",
    wasm: "application/wasm",
    woff2: "font/woff2"
};

function cwd_href() {
    const href = toFileUrl(Deno.cwd()).href;
    return (
        href.endsWith("/")
        ? href
        : href + "/"
    );
}

function locator_to_url(locator) {
    return locator.replace("file:///", cwd_href());
}

function url_to_locator(url) {
    return url.replace(cwd_href(), "file:///");
}

run_replete({
    browser_port: 3675,
    which_node: "node",
    deno_args: ["--allow-all"],
    root_locator: "file:///", // cwd
    command(message) {
        message.source = ecomcon(message.source, ["debug"]);
        if (message.locator !== undefined) {
            message.locator = url_to_locator(message.locator);
        }
        return Promise.resolve(message);
    },
    read(locator) {
        const file_url = new URL(locator_to_url(locator));

// Uncomment the code below to enable minification.

        // return Deno.readFile(file_url).then(function (buffer) {
        //     if (locator.endsWith(".js")) {
        //         const source = new TextDecoder().decode(buffer);
        //         return minify(source, {
        //             module: true,
        //             compress: {unsafe_arrows: true, passes: 2, ecma: "6"}
        //         }).then(function ({code}) {
        //             return code;
        //         });
        //     }
        //     return buffer;
        // });
        return Deno.readFile(file_url);
    },
    headers(locator) {
        const extension = new URL(locator).pathname.split(".").pop();
        const type = content_types[extension];
        if (typeof type === "string") {
            return {"Content-Type": type};
        }
    },
    locate(specifier, parent_locator) {

// Consult the import map.

        const alias = Object.keys(import_map).find(function (key) {
            return specifier.startsWith(key);
        });
        if (alias !== undefined) {
            specifier = url_to_locator(
                specifier.replace(alias, import_map[alias])
            );
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
    watch(locator) {
        const watcher = Deno.watchFs(fromFileUrl(locator_to_url(locator)));
        return watcher[Symbol.asyncIterator]().next().finally(function () {
            watcher.close();
        });
    }
});
