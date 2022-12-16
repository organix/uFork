A Rust implementation of the uFork virtual machine that compiles to WASM, so it can be run in the browser.

To run the interactive demo:

1. Run `wasm-pack build --target web`
2. Run `node demo_server.js`
3. Navigate to the page in a browser

Based on [wasm-pack-template](https://github.com/rustwasm/wasm-pack-template).
