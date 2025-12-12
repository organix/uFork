#!/bin/bash
set -euo pipefail

SEED=${1:-"2"}

# Download source.

if ! test -d foboot
then
    git clone https://github.com/im-tomu/foboot.git
fi
cd foboot/hw

# Specifying a random ROM avoids the need to build the software component, which
# depends on a huge RISC-V toolchain.

python3 foboot-bitstream.py \
    --revision pvt \
    --boot-source rand \
    --lx-ignore-deps \
    --seed $SEED

# List the built files, including intermediate artifacts.

cd -
find foboot/hw/build/gateware/
