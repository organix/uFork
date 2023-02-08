# Pin the dependencies to a specific nixpkgs version. Upgrade the packages by
# replacing the hash below with a more recent one from status.nixos.org.

{
    pkgs ? import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/5a211d5e8d18b20b5a2b22157266cc00f8c4f3b9.tar.gz") {}
}:

pkgs.mkShell {
    buildInputs = [
        pkgs.rustup                     # cargo and rustc
        pkgs.nodejs-19_x                # node
        pkgs.fswatch                    # file change watcher
        pkgs.twiggy                     # WASM code size profiler
    ];

    shellHook = ''
        rustup default nightly          # no_std support
        rustup target add wasm32-unknown-unknown

        alias s="./serve.sh"
        alias b="./build.sh"
        alias w="./watch.sh"
    '';
}
