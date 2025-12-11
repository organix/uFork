#!/bin/bash
set -euo pipefail

# Update the source code of the various LiteX repositories, or fetch them if
# missing.

LITEX_TAG=2025.08
curl -sSfO https://raw.githubusercontent.com/enjoy-digital/litex/$LITEX_TAG/litex_setup.py
chmod +x litex_setup.py

# The --dev flag disables auto-update of litex_setup.py, which otherwise thwarts
# our ability to pin the Litex version.

if test -d litex_repos
then
    PRE_ACTION="--update"
else
    mkdir litex_repos
    PRE_ACTION="--init"
fi
pushd litex_repos
../litex_setup.py --dev --tag $LITEX_TAG $PRE_ACTION --install
