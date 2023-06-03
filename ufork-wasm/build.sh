#!/bin/bash

rustup default stable \
&& rustup target add wasm32-unknown-unknown \
&& cargo build --target wasm32-unknown-unknown \
&& cargo build --target wasm32-unknown-unknown --release \
&& du -h target/*/*/*.wasm
