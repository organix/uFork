# uFork Project Summary

**uFork** is a virtual-machine specification
for a novel actor-oriented processor architecture
featuring:

  * Machine-Level Memory Safety
  * Object-Capability Security
  * Instruction-Level Concurrency
  * Automatic Memory-Management
  * Fine-Grained Resource Limits

The VM specification is designed to be suitable
for efficient implementation in an FPGA or ASIC.
The result is a secure independent computational element
that can be integrated into larger designs.

A working prototype, written in C,
has been developed as a proof-of-concept.
A `gdb`-style debugger allows single-stepping
of the virtual processor.
A REPL for a dialect of Scheme (with actor extensions)
has been implemented on this platform.

Based on lessons learned from the prototype,
a new implementation is underway,
written in Rust and targeting WASM.
This will allow easy experimentation
with sandboxed instances of the virtual processor.
A browser-based debugger will be the first host-application.
The JavaScript host can provide
controlled access to virtual devices,
including network connectivity if desired.
This would allow a distributed mesh of nodes to collaborate.

The bare-metal Rust implementation
can be compiled for various existing processors.
This provides the basis for
running the secure virtual processor
on a variety of MCUs, SoCs, and single-board computers
such as the [Raspberry Pi](https://www.raspberrypi.com/).
On the [Betrusted Precursor](https://www.crowdsupply.com/sutajio-kosagi/precursor) platform,
uFork processor core(s) could be implemented in the FPGA!

## Key Implementation Mechanisms

Traditional processors make pervasive use of mutable shared state,
which leads to a wide variety of security and privacy vulnerabilities.
Instead, uFork shares _immutable_ data among actors
via asynchronous message-events.
And each actor manages their own _private_ mutable state.
A configuration of actors,
their pending messages,
and all executing instruction-streams,
are captured in a self-contained coherent memory image.

Data elements are tagged to distinguish raw bits,
from dereferencable pointers,
from opaque object-capabilities (ocaps),
with no way to convert between them.
There are no general load/store instructions.
Allocation and garbage-collection
of pointer-referenced objects
is implemented in hardware.
Actor references are ocaps
which give the bearer the authority
to send asynchronous messages
to the actor,
but do not expose the actor's private state.

## License

[Apache License](LICENSE), Version 2.0
