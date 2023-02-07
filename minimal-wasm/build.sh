#!/bin/bash

# Build the .wasm file and display its file size.

cargo build --target wasm32-unknown-unknown --release \
&& du -h target/*/*/*.wasm
