# Reusable Module Library

The sources in this directory are modules
meant to be included in larger designs.
Most of the modules have one or more test-benches
(with filenames ending in `_tb.v`),
which drive the modules in simulation.

Each module contains documentation
describing its iterface and operation.

## Build and Deploy

We use a `Makefile` to define the build process.

To build and run all the simulation test-benches (generating `vcd` files):

    make

The tests can be run individually,
for example:

    make serial_rx+tx.vcd

The resulting `vcd` file can be loaded into the `GTKWave` tool for viewing.

To remove the build artifacts,
forcing everything to be rebuilt from source:

    make clean
