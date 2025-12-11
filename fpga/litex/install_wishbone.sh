#!/bin/bash
set -euo pipefail

git clone https://github.com/litex-hub/wishbone-utils.git
cd wishbone-utils/wishbone-tool
cargo build --release
cd -
find wishbone-utils/wishbone-tool/target/*/wishbone-tool
