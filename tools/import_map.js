// The import map for local development, as a module.
// Used for resolving both JavaScript and uFork modules.

const lib_href = import.meta.resolve("../lib/");
const js_href = import.meta.resolve("../vm/js/");
const wasm_href = import.meta.resolve("../vm/wasm/");

export default Object.freeze({
    "https://ufork.org/lib/": lib_href,
    "https://ufork.org/js/": js_href,
    "https://ufork.org/wasm/": wasm_href
});
