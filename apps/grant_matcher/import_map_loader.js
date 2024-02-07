// A Node.js loader that polyfills support for import maps.

/*jslint node */

import import_map from "./import_map.js";

function resolve(src, context, next_resolve) {
    const alias = Object.keys(import_map).find(function (key) {
        return src.startsWith(key);
    });
    if (alias !== undefined) {
        return {
            url: src.replace(alias, import_map[alias]),
            format: "module",
            shortCircuit: true
        };
    }
    return next_resolve(src, context);
}

export {resolve};
