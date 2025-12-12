# Configures a shell with Python 3.9, a prerequisite for LiteX, with a virtual
# environment.

{
    pkgs ? import (
        fetchTarball
        "https://github.com/NixOS/nixpkgs/archive/718895c14907b60069520b6394b4dbb6e3aa9c33.tar.gz"
    ) {}
}:

pkgs.mkShell {
    buildInputs = [
        pkgs.python3                      # https://www.python.org/
    ];

    shellHook = ''

# Instead of polluting the site-packages directory at the system or user level,
# use a Python Virtual Environment.

        python3 -m venv venv
        source venv/bin/activate
    '';
}
