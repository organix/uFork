# μFork/FPGA soft-core processor

![μFork logo](../ufork_logo.svg)

[**uFork**](../README.md) is a novel microprocessor architecture featuring:
  * memory safety
  * capability security
  * automatic memory-management
  * fine-grained resource limits
  * instruction-level concurrency

Processes are strongly-isolated,
with mutable state held privately.
They share information via
immutable asynchronous message-passing.
Dynamic memory-management and garbage-collection
are implemented at the machine-level.
Quotas for all resources are enforced
by the hardware.
Instruction execution is interleaved among processes,
so progress is made on all programs concurrently.
The blog post
"[Memory Safety Simplifies Microprocessor Design](http://www.dalnefre.com/wp/2022/08/memory-safety-simplifies-microprocessor-design/)"
describes the high-level design,
and the rationale behind it.

A software virtual-machine implementation
was previously funded by NLnet,
and demonstrated the viability of this design.
The current project implements the design using FPGA hardware,
fully supported by open-source tooling.
We plan to produce a soft-core processor
that can be integrated with the LiteX framework.

The initial target hardware is the [Fomu](fomu/README.md),
which features a Lattice iCE40 UP5K FPGA.
The uFork processor is implemented in [uCode](ucode/README.md),
a Forth-based microcode language,
which is itself executed directly by [the CPU](cpu.md).

## Project Support

<img src="../NLnet_banner.png" alt="Logo NLnet: abstract logo of four people seen from above" width="128" height="48" style="padding: 1ex 1em; background: #FFF;" />
<img src="../NGI0Core_tag.svg" alt="Logo NGI Zero: letterlogo shaped like a tag" width="128" height="48" style="padding: 1ex 1em; background: inherit;" />

[This project](https://nlnet.nl/project/uFork-FPGA/)
was funded through the [NGI0 Core](https://nlnet.nl/core) Fund,
a fund established by [NLnet](https://nlnet.nl/) with financial support from
the European Commission's [Next Generation Internet](https://ngi.eu/) programme,
under the aegis of DG Communications Networks,
Content and Technology under grant agreement N<sup>o</sup> 101069594.
