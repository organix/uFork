#!/bin/bash

# Build the .wasm file whenever a file is saved.

fswatch --one-per-batch src | xargs -I{} ./build.sh
