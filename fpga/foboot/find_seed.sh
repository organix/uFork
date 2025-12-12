#!/bin/bash
set -euo pipefail

SEED=0
while ! ./build_hw.sh $SEED
do
    SEED=$(( SEED + 1 ))
done
echo "Set SEED in build_hw.sh to $SEED"
