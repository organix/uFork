# A Simple RGB Blinker Demo

The sources in this directory
build a simple demonstration bitstream
for the Fomu.
When successfully deployed,
the RGB LED will repeatedly cycle through
eight colors.

Color   | Red | Green | Blue
--------|-----|-------|-----
Black   | 0   | 0     | 0
Blue    | 0   | 0     | 1
Green   | 0   | 1     | 0
Cyan    | 0   | 1     | 1
Red     | 1   | 0     | 0
Magenta | 1   | 0     | 1
Yellow  | 1   | 1     | 0
White   | 1   | 1     | 1

## Build and Deploy

We use a `Makefile` to define the build process.

To build the bitstream (packaged as a `dfu` file):

    make

On power-up the Fomu runs the DFU boot-loader.
To deploy the bitstream to the Fomu:

    make install

To reset the Fomu and run the boot-loader,
just remove the Fomu from the USB port
and re-insert it.

The `timer` component has a simulation test-bench.
To build and run the test-bench:

    make timer.vcd

The resulting `vcd` file can be loaded into the `GTKWave` tool for viewing.

To remove the build artifacts,
forcing everything to be rebuilt from source:

    make clean
