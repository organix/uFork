#!/bin/bash
set -euo pipefail

# Update the source code of the various LiteX repositories, or fetch them if
# missing.

curl -sSfO https://raw.githubusercontent.com/enjoy-digital/litex/master/litex_setup.py
chmod +x litex_setup.py
if test -d litex_repos
then
    pushd litex_repos
    ../litex_setup.py --update
else
    mkdir litex_repos
    pushd litex_repos
    ../litex_setup.py --init
fi

# Install each LiteX package using Python's 'pip' installer, confining external
# Python dependencies to the project directory.

for repo in *
do
    pip install --upgrade --editable "$repo" --target ../site-packages
done
