#!/bin/bash

# Run the test runners in sequentially.

cd ../ufork-rust/
cargo test --lib

cd ../ufork-wasm/
deno run \
    --allow-read=. \
    run_asm_tests.js \
    examples \
    lib
