#!/bin/bash

# Build the .wasm file and analyse its size.

cargo build --target wasm32-unknown-unknown --release \
&& twiggy top -n 20 target/wasm32-unknown-unknown/release/minimal_wasm.wasm \
&& du -h target/*/*/*.wasm
