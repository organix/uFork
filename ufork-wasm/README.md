# uFork Simulator in Rust

This implementation of the [**uFork** virtual machine](../ufork.md)
is written in [Rust](https://www.rust-lang.org/)
and targets the browser's [WASM engine](https://webassembly.org/).
A browser-based GUI implements a debugger for a uFork processor core.

## Running the browser-based demo

1. Run `wasm-pack build --target web`.
2. Run `node www/server.mjs`.
3. Navigate to the printed URL.

Based on [wasm-pack-template](https://github.com/rustwasm/wasm-pack-template).
