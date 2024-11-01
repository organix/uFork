# Running nix-shell from the current directory will drop you into a shell with
# all the commands necessary to work on the uFork project.

# Download Nix from https://nixos.org/download.html.

# We pin the dependencies to a specific nixpkgs version. They can be upgraded
# by replacing the hash below with a more recent one obtained from
# https://status.nixos.org.

{
    pkgs ? import (
        fetchTarball
        "https://github.com/NixOS/nixpkgs/archive/2d2a9ddbe3f2.tar.gz"
    ) {}
}:

pkgs.mkShell {
    buildInputs = [

# Two JavaScript runtimes: Deno and its predecessor, Node.js. Most of our
# libraries and tools are written in JavaScript for portability.

        pkgs.deno               # https://deno.com
        pkgs.nodejs_22          # https://nodejs.org

# The Rust toolchain, for the uFork VM.

        pkgs.rustup             # https://www.rust-lang.org

# The Fomu development toolchain, for FPGA development.
# This includes yosys for synthesis, nextpnr for place and route, iverilog for
# simulation, and GTK Wave for wave visualization.

        pkgs.dfu-util           # https://dfu-util.sourceforge.net
        pkgs.gtkwave            # https://gtkwave.sourceforge.net
        pkgs.icestorm           # https://github.com/YosysHQ/icestorm
        pkgs.nextpnr            # https://github.com/YosysHQ/nextpnr
        pkgs.verilog            # https://github.com/steveicarus/iverilog
        pkgs.yosys              # https://github.com/YosysHQ/yosys
    ];

    shellHook = ''
        alias b="deno task build"
        alias s="deno task serve"
        alias t="deno task test || echo FAIL"
    '';
}
