# Canonical Stack Machine (CSM)

The sources in this directory
implement Koopman's _Canonical Stack Machine_
from Chapter 3 of
"[Stack Computers: the new wave](https://users.ece.cmu.edu/~koopman/stack_computers/)".
Programs for the machine
are written in [Forth](https://en.wikipedia.org/wiki/Forth_(programming_language)).
Considerable inspiration was taken from
the [`j1a`](https://github.com/jamesbowman/swapforth/tree/master/j1a).

**NOTE**: _The CPU design has drifted considerably from the original CSM!_

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

    $ ls /dev/tty.*

Then run the `screen` program to connect
to the serial port at your desired baud-rate.

    $ screen /dev/tty.usbserial-AD0JIXTZ 115200

Use the key sequence `Ctrl-a + k` to kill the terminal session.
