#!/bin/bash
set -euo pipefail

git clone https://github.com/litex-hub/wishbone-utils.git
cd wishbone-utils/wishbone-tool
git checkout v0.7.9  # latest
cargo build --release
cd -
find wishbone-utils/wishbone-tool/target/*/wishbone-tool
