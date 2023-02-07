#!/bin/bash

# Profile the WASM build for code size.
# See https://rustwasm.github.io/docs/book/reference/code-size.html.

twiggy top -n 20 target/wasm32-unknown-unknown/release/minimal_wasm.wasm
