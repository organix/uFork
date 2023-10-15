#!/bin/bash

pushd "$( dirname "${BASH_SOURCE[0]}" )"

rustup default stable \
&& rustup target add wasm32-unknown-unknown \
&& cargo build \
&& cargo build --release \
&& cp ./target/wasm32-unknown-unknown/debug/ufork_wasm.wasm www/ufork.wasm \
&& cp ./target/wasm32-unknown-unknown/release/ufork_wasm.wasm www/ufork.opt.wasm \
&& du -h www/*.wasm
