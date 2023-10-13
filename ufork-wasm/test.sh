#!/bin/bash

set -euo pipefail

pushd "$( dirname "${BASH_SOURCE[0]}" )"

# Run the test runners in parallel.

deno run \
    --allow-read=. \
    run_asm_tests.js \
    examples \
    lib \
    &

cd ../ufork-rust/ && cargo test --lib &

wait %1 %2
