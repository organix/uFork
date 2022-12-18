A Rust implementation of the uFork virtual machine that compiles to WASM.

To run uFork in the browser:

1. Run `wasm-pack build --target web`.
2. Run `node www/server.js`.
3. Navigate to the printed URL.

Based on [wasm-pack-template](https://github.com/rustwasm/wasm-pack-template).
