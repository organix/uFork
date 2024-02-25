# Canonical Stack Machine (CSM)

The sources in this directory
implement Koopman's _Canonical Stack Machine_
from Chapter 3 of
"[Stack Computers: the new wave](https://users.ece.cmu.edu/~koopman/stack_computers/)".
Programs for the machine
are written in [Forth](https://en.wikipedia.org/wiki/Forth_(programming_language)).

## Build and Deploy

We use a `Makefile` to define the build process.

To build the bitstream (packaged as a `dfu` file):

    make

On power-up the Fomu runs the DFU boot-loader.
To deploy the bitstream to the Fomu:

    make install

To remove the build artifacts,
forcing everything to be rebuilt from source:

    make clean
