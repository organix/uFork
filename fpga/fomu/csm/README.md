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

## Benchmarks

uCode Feature Set:

  * 4-phase instruction execution
  * 12MHz clock (divided from 48MHz)
  * 10-bit address, 16-bit data path

### Baseline (12-deep stacks, 16#002x primitives)

    Info: Device utilisation:
    Info: 	         ICESTORM_LC:  1115/ 5280    21%
    Info: 	        ICESTORM_RAM:     4/   30    13%
    Info: 	               SB_IO:     8/   96     8%
    Info: 	               SB_GB:     8/    8   100%
    Info: 	        ICESTORM_PLL:     0/    1     0%
    Info: 	         SB_WARMBOOT:     0/    1     0%
    Info: 	        ICESTORM_DSP:     0/    8     0%
    Info: 	      ICESTORM_HFOSC:     0/    1     0%
    Info: 	      ICESTORM_LFOSC:     0/    1     0%
    Info: 	              SB_I2C:     0/    2     0%
    Info: 	              SB_SPI:     0/    2     0%
    Info: 	              IO_I3C:     0/    2     0%
    Info: 	         SB_LEDDA_IP:     0/    1     0%
    Info: 	         SB_RGBA_DRV:     1/    1   100%
    Info: 	      ICESTORM_SPRAM:     0/    4     0%
    ...
    Info: Max frequency for clock                    'clk': 36.52 MHz (PASS at 12.00 MHz)

### Single-Cycle Stack-SWAP, non-registered ALU output

    Info: Device utilisation:
    Info: 	         ICESTORM_LC:  1016/ 5280    19%
    Info: 	        ICESTORM_RAM:     4/   30    13%
    Info: 	               SB_IO:     8/   96     8%
    Info: 	               SB_GB:     7/    8    87%
    Info: 	        ICESTORM_PLL:     0/    1     0%
    Info: 	         SB_WARMBOOT:     0/    1     0%
    Info: 	        ICESTORM_DSP:     0/    8     0%
    Info: 	      ICESTORM_HFOSC:     0/    1     0%
    Info: 	      ICESTORM_LFOSC:     0/    1     0%
    Info: 	              SB_I2C:     0/    2     0%
    Info: 	              SB_SPI:     0/    2     0%
    Info: 	              IO_I3C:     0/    2     0%
    Info: 	         SB_LEDDA_IP:     0/    1     0%
    Info: 	         SB_RGBA_DRV:     1/    1   100%
    Info: 	      ICESTORM_SPRAM:     0/    4     0%
    ...
    Info: Max frequency for clock                    'clk': 31.80 MHz (PASS at 12.00 MHz)

### Customized LIFO w/ swap

    Info: Device utilisation:
    Info: 	         ICESTORM_LC:   988/ 5280    18%
    Info: 	        ICESTORM_RAM:     4/   30    13%
    Info: 	               SB_IO:     8/   96     8%
    Info: 	               SB_GB:     7/    8    87%
    Info: 	        ICESTORM_PLL:     0/    1     0%
    Info: 	         SB_WARMBOOT:     0/    1     0%
    Info: 	        ICESTORM_DSP:     0/    8     0%
    Info: 	      ICESTORM_HFOSC:     0/    1     0%
    Info: 	      ICESTORM_LFOSC:     0/    1     0%
    Info: 	              SB_I2C:     0/    2     0%
    Info: 	              SB_SPI:     0/    2     0%
    Info: 	              IO_I3C:     0/    2     0%
    Info: 	         SB_LEDDA_IP:     0/    1     0%
    Info: 	         SB_RGBA_DRV:     1/    1   100%
    Info: 	      ICESTORM_SPRAM:     0/    4     0%
    ...
    Info: Max frequency for clock                    'clk': 34.74 MHz (PASS at 12.00 MHz)
