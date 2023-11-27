// A Node.js loader that polyfills support for import maps.

/*jslint node */

import import_map from "./import_map.js";

function resolve(specifier, context, next_resolve) {
    const alias = Object.keys(import_map).find(function (key) {
        return specifier.startsWith(key);
    });
    if (alias !== undefined) {
        return {
            url: specifier.replace(alias, import_map[alias]),
            format: "module",
            shortCircuit: true
        };
    }
    return next_resolve(specifier, context);
}

export {resolve};
