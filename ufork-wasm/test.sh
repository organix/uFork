#!/bin/bash

# Run the test runners in parallel.

cargo test --lib &

deno run \
    --allow-read=. \
    --allow-net=localhost:7273 \
    run_asm_tests.js \
    examples \
    lib \
    &

wait %1 %2
