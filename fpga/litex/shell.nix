# Running nix-shell from the current directory will drop you into a shell with
# all the commands necessary to work on this project.

# Download Nix from https://nixos.org/download.html.

# We pin the dependencies to a specific nixpkgs version. They can be upgraded
# by replacing the hash below with a more recent one obtained from
# https://status.nixos.org.

{
    pkgs ? import (
        fetchTarball
        "https://github.com/NixOS/nixpkgs/archive/cc54fb41d137.tar.gz"
    ) {}
}:

pkgs.mkShell {
    buildInputs = [

# LiteX prerequisites.

        pkgs.python3                      # https://www.python.org/
        pkgs.python311Packages.pip        # https://pypi.org/project/pip/
        pkgs.json_c                       # https://github.com/json-c/json-c/
        pkgs.libevent                     # https://libevent.org/
        pkgs.verilator                    # https://www.veripool.org/verilator/
    ];

    shellHook = ''

# Instead of polluting the "site-packages" directory at the system or user
# level, use one at the project level.

        PYTHONPATH="$PYTHONPATH:$(pwd)/python_pkg/"
        export PYTHONPATH

# Take the absence of the Python packages directory to mean installation is
# required.

        if ! test -d python_pkg
        then
            ./install.sh
        fi
    '';
}
