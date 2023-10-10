#!/bin/bash

rustup default stable \
&& rustup target add wasm32-unknown-unknown \
&& cargo build \
&& cargo build --release \
&& du -h ../target/*/*/*.wasm
