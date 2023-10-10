#!/bin/bash

# Run the test runners in parallel.

deno run \
    --allow-read=. \
    --allow-net=localhost:7273 \
    run_asm_tests.js \
    examples \
    lib \
    &

cd ../ufork-rust/ && cargo test --lib &

wait %1 %2
