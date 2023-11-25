// The import map for local development, as a module.
// Used for resolving both JavaScript and uFork modules.

const std_href = import.meta.resolve("../lib/");
const js_href = import.meta.resolve("../vm/js/");
const wasm_href = import.meta.resolve("../vm/wasm/");

export default Object.freeze({
    "std/": std_href,
    "js/": js_href,
    "wasm/": wasm_href
});
