# uCode/Forth Processor

The sources in this directory
implement a Forth-oriented processor
that serves as the microcode machine
for implementing uFork instructions.
Programs for the machine
are written in
[Forth](https://en.wikipedia.org/wiki/Forth_(programming_language)).

## Documentation

  * [uCode processor design](../../cpu.md)
  * [uCode Forth programming language](../../ucode/README.md)
  * [Interactive hardware monitor](monitor.md)

## Sample CPU Trace (Simulated)

![CPU Trace](sample_cpu_trace.png)

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

## Serial UART Device

This example includes a [serial](https://en.wikipedia.org/wiki/Asynchronous_serial_communication)
[UART](https://en.wikipedia.org/wiki/Universal_asynchronous_receiver-transmitter) device.
It operates at a fixed [baud rate](https://en.wikipedia.org/wiki/Baud) of 115200
with [8N1](https://en.wikipedia.org/wiki/8-N-1) framing and parity.

The user i/o pads of the Fomu are assigned as follows
(starting from the side with the notch):

  1. GND -- Common Ground
  2. TX -- Transmitted Data
  3. RX -- Received Data (w/ pull-up if not connected)
  4. PWR -- 3v3 Level (do not connect)

Connections between the Fomu and Host must be cross-wired
as a [Null Modem](https://en.wikipedia.org/wiki/Null_modem).

    Fomu              Host
    -----+          +-----
     GND |----------| GND
         |          |
         |          |
      TX |---+  +---| TX
         |    \/    |
         |    /\    |
      RX |---+  +---| RX
    -----+          +-----

Signals are expected to be LVCMOS levels.
Note that a serial line is held high when idle
and transitions to low to indicate the start
of a new character (octet).

### Serial Terminal Program

You'll have to run a serial terminal program
to communicate with the serial device.

On a Mac, determine the available devices like this:

    ls /dev/tty.*

Then run the `screen` program to connect
to the serial port at your desired baud-rate.

    screen /dev/tty.usbserial-AD0JIXTZ 115200

Use the key sequence `Ctrl-a + k` to kill the terminal session.

## Resource Usage

This section tracks usage of FPGA resources
as the design and implementation evolves.

###  Baseline (1k uCode, no devices)

    Info: Device utilisation:
    Info:            ICESTORM_LC:   928/ 5280    17%
    Info:           ICESTORM_RAM:     4/   30    13%
    Info:                  SB_IO:     8/   96     8%
    Info:                  SB_GB:     7/    8    87%
    Info:           ICESTORM_PLL:     0/    1     0%
    Info:            SB_WARMBOOT:     0/    1     0%
    Info:           ICESTORM_DSP:     0/    8     0%
    Info:         ICESTORM_HFOSC:     0/    1     0%
    Info:         ICESTORM_LFOSC:     0/    1     0%
    Info:                 SB_I2C:     0/    2     0%
    Info:                 SB_SPI:     0/    2     0%
    Info:                 IO_I3C:     0/    2     0%
    Info:            SB_LEDDA_IP:     0/    1     0%
    Info:            SB_RGBA_DRV:     1/    1   100%
    Info:         ICESTORM_SPRAM:     0/    4     0%
    Info: Max frequency for clock 'clk': 30.75 MHz (PASS at 12.00 MHz)

### Expand uCode Memory (2k uCode, no devices)

    Info: Device utilisation:
    Info:            ICESTORM_LC:   931/ 5280    17%
    Info:           ICESTORM_RAM:     8/   30    26%
    Info:                  SB_IO:     8/   96     8%
    Info:                  SB_GB:     7/    8    87%
    Info:           ICESTORM_PLL:     0/    1     0%
    Info:            SB_WARMBOOT:     0/    1     0%
    Info:           ICESTORM_DSP:     0/    8     0%
    Info:         ICESTORM_HFOSC:     0/    1     0%
    Info:         ICESTORM_LFOSC:     0/    1     0%
    Info:                 SB_I2C:     0/    2     0%
    Info:                 SB_SPI:     0/    2     0%
    Info:                 IO_I3C:     0/    2     0%
    Info:            SB_LEDDA_IP:     0/    1     0%
    Info:            SB_RGBA_DRV:     1/    1   100%
    Info:         ICESTORM_SPRAM:     0/    4     0%
    Info: Max frequency for clock 'clk': 29.83 MHz (PASS at 12.00 MHz)

### Expand uCode Memory (4k uCode, no devices)

    Info: Device utilisation:
    Info:            ICESTORM_LC:   939/ 5280    17%
    Info:           ICESTORM_RAM:    16/   30    53%
    Info:                  SB_IO:     8/   96     8%
    Info:                  SB_GB:     7/    8    87%
    Info:           ICESTORM_PLL:     0/    1     0%
    Info:            SB_WARMBOOT:     0/    1     0%
    Info:           ICESTORM_DSP:     0/    8     0%
    Info:         ICESTORM_HFOSC:     0/    1     0%
    Info:         ICESTORM_LFOSC:     0/    1     0%
    Info:                 SB_I2C:     0/    2     0%
    Info:                 SB_SPI:     0/    2     0%
    Info:                 IO_I3C:     0/    2     0%
    Info:            SB_LEDDA_IP:     0/    1     0%
    Info:            SB_RGBA_DRV:     1/    1   100%
    Info:         ICESTORM_SPRAM:     0/    4     0%
    Info: Max frequency for clock 'clk': 24.60 MHz (PASS at 12.00 MHz)

### UART Device Component (2k uCode)

    Info: Device utilisation:
    Info:            ICESTORM_LC:  1042/ 5280    19%
    Info:           ICESTORM_RAM:     8/   30    26%
    Info:                  SB_IO:     8/   96     8%
    Info:                  SB_GB:     7/    8    87%
    Info:           ICESTORM_PLL:     0/    1     0%
    Info:            SB_WARMBOOT:     0/    1     0%
    Info:           ICESTORM_DSP:     0/    8     0%
    Info:         ICESTORM_HFOSC:     0/    1     0%
    Info:         ICESTORM_LFOSC:     0/    1     0%
    Info:                 SB_I2C:     0/    2     0%
    Info:                 SB_SPI:     0/    2     0%
    Info:                 IO_I3C:     0/    2     0%
    Info:            SB_LEDDA_IP:     0/    1     0%
    Info:            SB_RGBA_DRV:     1/    1   100%
    Info:         ICESTORM_SPRAM:     0/    4     0%
    Info: Max frequency for clock 'clk': 29.31 MHz (PASS at 12.00 MHz)

### uFork Quad-Memory Component (2k uCode)

    Info: Device utilisation:
    Info:            ICESTORM_LC:  1077/ 5280    20%
    Info:           ICESTORM_RAM:     8/   30    26%
    Info:                  SB_IO:     8/   96     8%
    Info:                  SB_GB:     8/    8   100%
    Info:           ICESTORM_PLL:     0/    1     0%
    Info:            SB_WARMBOOT:     0/    1     0%
    Info:           ICESTORM_DSP:     0/    8     0%
    Info:         ICESTORM_HFOSC:     0/    1     0%
    Info:         ICESTORM_LFOSC:     0/    1     0%
    Info:                 SB_I2C:     0/    2     0%
    Info:                 SB_SPI:     0/    2     0%
    Info:                 IO_I3C:     0/    2     0%
    Info:            SB_LEDDA_IP:     0/    1     0%
    Info:            SB_RGBA_DRV:     1/    1   100%
    Info:         ICESTORM_SPRAM:     3/    4    75%
    Info: Max frequency for clock 'clk': 30.08 MHz (PASS at 12.00 MHz)

### uFork Quad-Memory Component (4k uCode)

    Info: Device utilisation:
    Info:            ICESTORM_LC:  1079/ 5280    20%
    Info:           ICESTORM_RAM:    16/   30    53%
    Info:                  SB_IO:     8/   96     8%
    Info:                  SB_GB:     8/    8   100%
    Info:           ICESTORM_PLL:     0/    1     0%
    Info:            SB_WARMBOOT:     0/    1     0%
    Info:           ICESTORM_DSP:     0/    8     0%
    Info:         ICESTORM_HFOSC:     0/    1     0%
    Info:         ICESTORM_LFOSC:     0/    1     0%
    Info:                 SB_I2C:     0/    2     0%
    Info:                 SB_SPI:     0/    2     0%
    Info:                 IO_I3C:     0/    2     0%
    Info:            SB_LEDDA_IP:     0/    1     0%
    Info:            SB_RGBA_DRV:     1/    1   100%
    Info:         ICESTORM_SPRAM:     3/    4    75%
    Info: Max frequency for clock 'clk': 27.37 MHz (PASS at 12.00 MHz)

### Single-cycle Multiply w/ DSP block

    Info: Device utilisation:
    Info:            ICESTORM_LC:  1114/ 5280    21%
    Info:           ICESTORM_RAM:    16/   30    53%
    Info:                  SB_IO:     8/   96     8%
    Info:                  SB_GB:     8/    8   100%
    Info:           ICESTORM_PLL:     0/    1     0%
    Info:            SB_WARMBOOT:     0/    1     0%
    Info:           ICESTORM_DSP:     1/    8    12%
    Info:         ICESTORM_HFOSC:     0/    1     0%
    Info:         ICESTORM_LFOSC:     0/    1     0%
    Info:                 SB_I2C:     0/    2     0%
    Info:                 SB_SPI:     0/    2     0%
    Info:                 IO_I3C:     0/    2     0%
    Info:            SB_LEDDA_IP:     0/    1     0%
    Info:            SB_RGBA_DRV:     1/    1   100%
    Info:         ICESTORM_SPRAM:     3/    4    75%
    Info: Max frequency for clock 'clk': 25.19 MHz (PASS at 12.00 MHz)

### Counting Loops Use R-stack Directly

    Info: Device utilisation:
    Info:            ICESTORM_LC:  1137/ 5280    21%
    Info:           ICESTORM_RAM:    16/   30    53%
    Info:                  SB_IO:     8/   96     8%
    Info:                  SB_GB:     8/    8   100%
    Info:           ICESTORM_PLL:     0/    1     0%
    Info:            SB_WARMBOOT:     0/    1     0%
    Info:           ICESTORM_DSP:     1/    8    12%
    Info:         ICESTORM_HFOSC:     0/    1     0%
    Info:         ICESTORM_LFOSC:     0/    1     0%
    Info:                 SB_I2C:     0/    2     0%
    Info:                 SB_SPI:     0/    2     0%
    Info:                 IO_I3C:     0/    2     0%
    Info:            SB_LEDDA_IP:     0/    1     0%
    Info:            SB_RGBA_DRV:     1/    1   100%
    Info:         ICESTORM_SPRAM:     3/    4    75%
    Info: Max frequency for clock 'clk': 26.65 MHz (PASS at 12.00 MHz)

### 16-deep FIFOs for UART RX/TX

    Info: Device utilisation:
    Info:            ICESTORM_LC:  1627/ 5280    30%
    Info:           ICESTORM_RAM:    16/   30    53%
    Info:                  SB_IO:     8/   96     8%
    Info:                  SB_GB:     8/    8   100%
    Info:           ICESTORM_PLL:     0/    1     0%
    Info:            SB_WARMBOOT:     0/    1     0%
    Info:           ICESTORM_DSP:     1/    8    12%
    Info:         ICESTORM_HFOSC:     0/    1     0%
    Info:         ICESTORM_LFOSC:     0/    1     0%
    Info:                 SB_I2C:     0/    2     0%
    Info:                 SB_SPI:     0/    2     0%
    Info:                 IO_I3C:     0/    2     0%
    Info:            SB_LEDDA_IP:     0/    1     0%
    Info:            SB_RGBA_DRV:     1/    1   100%
    Info:         ICESTORM_SPRAM:     3/    4    75%
    Info: Max frequency for clock 'clk': 25.76 MHz (PASS at 12.00 MHz)

### 256-deep BRAM FIFOs for UART

    Info: Device utilisation:
    Info:            ICESTORM_LC:  1216/ 5280    23%
    Info:           ICESTORM_RAM:    18/   30    60%
    Info:                  SB_IO:     8/   96     8%
    Info:                  SB_GB:     8/    8   100%
    Info:           ICESTORM_PLL:     0/    1     0%
    Info:            SB_WARMBOOT:     0/    1     0%
    Info:           ICESTORM_DSP:     1/    8    12%
    Info:         ICESTORM_HFOSC:     0/    1     0%
    Info:         ICESTORM_LFOSC:     0/    1     0%
    Info:                 SB_I2C:     0/    2     0%
    Info:                 SB_SPI:     0/    2     0%
    Info:                 IO_I3C:     0/    2     0%
    Info:            SB_LEDDA_IP:     0/    1     0%
    Info:            SB_RGBA_DRV:     1/    1   100%
    Info:         ICESTORM_SPRAM:     3/    4    75%
    Info: Max frequency for clock 'clk': 26.33 MHz (PASS at 12.00 MHz)
