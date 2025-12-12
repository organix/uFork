# Foboot analysis

This directory contains the necessary scaffolding to build the hardware portion
of Foboot, the bootloader for the Fomu FPGA, so that we can review the
intermediate Verilog.

Firstly, run `nix-shell` from this directory. Then run `./build_hw.sh`. If it
fails to meet timing, you may need to run `./find_seed.sh`.
