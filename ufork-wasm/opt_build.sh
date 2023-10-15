#!/bin/bash

pushd "$( dirname "${BASH_SOURCE[0]}" )"

nightly="nightly-2023-10-09"

# RUSTFLAGS="-Zlocation-detail=none" disables location details
# -Z build-std=core,alloc,panic_abort builds a custom std with only the components needed
# -Z build-std-features=panic_immediate_abort disables panic format generation and immediately aborts

cargo install --root .cargo wasm-opt \
&& rustup +"$nightly" target add wasm32-unknown-unknown \
&& rustup +"$nightly" component add rust-src \
&& cargo +"$nightly" build --release -Z build-std=core,alloc,panic_abort -Z build-std-features=panic_immediate_abort \
&& .cargo/bin/wasm-opt -Oz -o www/ufork.opt.wasm target/wasm32-unknown-unknown/release/ufork_wasm.wasm \
&& du -h www/ufork.opt.wasm
