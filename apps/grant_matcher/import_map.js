// The import.meta.resolve function, used by ../../tools/import_map.js, is not
// available within a Node.js loader, yet import.meta.url is. Sorry for the
// duplication.

/*jslint node */

export default Object.freeze({
    "https://ufork.org/lib/": new URL("../../lib/", import.meta.url).href,
    "https://ufork.org/js/": new URL("../../vm/js/", import.meta.url).href,
    "https://ufork.org/wasm/": new URL("../../vm/wasm/", import.meta.url).href
});
