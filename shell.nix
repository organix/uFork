# We pin our dependencies to the nixpkgs version. You can upgrade the packages
# by replacing the hash below with a more recent one from status.nixos.org.

{
    pkgs ? import (
        fetchTarball
        "https://github.com/NixOS/nixpkgs/archive/0bd59c54ef06.tar.gz"
    ) {}
}:

pkgs.mkShell {
    buildInputs = [
        pkgs.rustup
        pkgs.nodejs_21
        pkgs.deno
    ];

    shellHook = ''
        alias s="deno task debug"
        alias b="deno task build"
        alias t="deno task test || echo FAIL"
    '';
}

