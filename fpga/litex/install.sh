#!/bin/bash
set -euo pipefail

# Fetch the source code of various LiteX packages.

mkdir litex_pkg
curl \
    --remote-name \
    https://raw.githubusercontent.com/enjoy-digital/litex/master/litex_setup.py
chmod +x litex_setup.py
pushd litex_pkg
../litex_setup.py --init
rm ../litex_setup.py

# Install each LiteX package using Python's 'pip' installer, confining external
# Python dependencies to the project directory.

for repo in *
do
    pushd "$repo"
    pip install --upgrade --editable . --target ../../python_pkg
    popd
done
