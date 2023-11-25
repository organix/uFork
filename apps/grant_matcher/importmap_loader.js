// A Node.js loader that polyfills support for import maps.

/*jslint node */

const import_map = {
    "std/": new URL("../../lib/", import.meta.url).href,
    "js/": new URL("../../vm/js/", import.meta.url).href,
    "wasm/": new URL("../../vm/wasm/", import.meta.url).href
};

function resolve(specifier, context, next_resolve) {
    const alias = Object.keys(import_map).find(function (key) {
        return specifier.startsWith(key);
    });
    if (alias !== undefined) {
        return {
            url: specifier.replace(alias, import_map[alias]),
            shortCircuit: true
        };
    }
    return next_resolve(specifier, context);
}

export {resolve};
