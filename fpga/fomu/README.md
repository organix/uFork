# μFork/FPGA soft-core for Fomu-PVT

![Annotated Hardware](hw_pvt_annotated.png)

The [Fomu-PVT](https://tomu.im/fomu.html)
is a programmable FPGA device
that fits inside a USB Type-A port.
It has I/O contacts, an RGB LED,
and a [Lattice iCE40 UP5K](https://www.latticesemi.com/Products/FPGAandCPLD/iCE40UltraPlus) FPGA.
It is supported by a fully open-source toolchain.
This block-diagram describes the primary components of the Fomu platform.

![Functional Block Diagram](fomu_block_diagram.png)

We are developing the uFork processor soft-core incrementally.
A series and smaller/simpler designs
demonstrate and verify the behavior a various components,
leading to a fully-functioning processor.

  * [RGB Blinker Demo](blink_rgb/README.md)
  * [Reusable Module Library](lib/README.md)
    * Domain-Crossing Synchronizer
    * Clock Divider
    * LED Frequency Limiter
    * Unbuffered Serial UART
    * Fast LIFO (Stack)
  * [uCode/Forth CPU](cpu/README.md)
