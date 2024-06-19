# Running nix-shell from the current directory will drop you into a shell with
# all the commands necessary to work on this project.

# Download Nix from https://nixos.org/download.html.

# We pin the dependencies to a specific nixpkgs version. They can be upgraded
# by replacing the hash below with a more recent one obtained from
# https://status.nixos.org.

{
    pkgs ? import (
        fetchTarball
        "https://github.com/NixOS/nixpkgs/archive/718895c14907b60069520b6394b4dbb6e3aa9c33.tar.gz"
    ) {}
}:

pkgs.mkShell {
    buildInputs = [

# LiteX prerequisites. Python 3.9 appears to be the highest version that works
# correctly with Migen, so the Nix hash is pinned accordinly.

        pkgs.python3                      # https://www.python.org/
        pkgs.python39Packages.pip         # https://pypi.org/project/pip/
        pkgs.python39Packages.setuptools  # https://pypi.org/project/setuptools/
        pkgs.json_c                       # https://github.com/json-c/json-c/
        pkgs.libevent                     # https://libevent.org/
        pkgs.verilator                    # https://www.veripool.org/verilator/
    ];

    shellHook = ''

# Instead of polluting the site-packages directory at the system or user level,
# use a dedicated site-packages at the project level.

        export PYTHONPATH="$(pwd)/site-packages/:$PYTHONPATH"

# Take the absence of the Python packages directory to mean installation is
# required.

        if ! test -d site-packages
        then
            ./install.sh
        fi

# We also shadow site-packages/* with litex_repos/*, because otherwise local
# module resolution within litex_repos/litex-boards fails, and outdated packages
# in site-packages override the up-to-date sources in litex_repos.

        for repo in litex_repos/*
        do
            export PYTHONPATH="$(pwd)/$repo/:$PYTHONPATH"
        done
    '';
}
