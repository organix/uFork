#!/bin/bash

pushd "$( dirname "${BASH_SOURCE[0]}" )"

rustup default stable \
&& rustup target add wasm32-unknown-unknown \
&& cargo build \
&& cargo build --release \
&& cp ./target/wasm32-unknown-unknown/debug/ufork_wasm.wasm www/wasm/ufork_wasm.wasm \
&& cp ./target/wasm32-unknown-unknown/release/ufork_wasm.wasm www/wasm/ufork_wasm.opt.wasm \
&& du -h www/wasm/*.wasm
