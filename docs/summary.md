# uFork Project Summary

**uFork** is a virtual-machine specification
for a novel actor-oriented processor architecture
featuring:

  * Machine-Level Memory Safety
  * Object-Capability Security
  * Instruction-Level Concurrency
  * Automatic Memory-Management
  * Fine-Grained Resource Limits

These features allow easier creation of safe programs,
and easier proofs of correctness and security properties.

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

## Project Roadmap

Milestones:

  * Load/store VM images from browser
  * Sponsor configuration and control
  * Crash-proof exception handling
  * Concurrent garbage-collection
  * Clock/Timer device(s)
  * Blob-memory device(s)
  * Console i/o device(s)
  * Network device(s)

## Historical Context

Traditional processors make pervasive use of mutable shared state,
which leads to a wide variety of security and privacy vulnerabilities.
Instead, uFork shares _immutable_ data among actors
via asynchronous message-events.
And each actor manages their own _private_ mutable state.
A configuration of actors,
their pending messages,
and all executing instruction-streams,
are captured in a self-contained memory image.
Coherent restartable snapshots
may be taken between any two instructions.

Data elements are tagged to distinguish raw bits
from dereferencable pointers
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

Although capability-machines have been implemented in the past,
none have been actor-oriented ocap systems to the core.
The design of uFork
builds on ideas from many sources,
including secure message-passing microkernels
(such as [seL4](https://doi.org/10.1145/2893177))
and the [LISP processor](https://dspace.mit.edu/handle/1721.1/5731) architecture.

## Technical Challenges

Sponsors set strict limits on
the resources used by a computation,
including memory and processor time.
These limits are enforced
by the processor directly.
Proper implementation of this mechanism
is key to providing a safe environment
for executing untrusted code.
APIs and protocols must be established
to create and manage
sponsored configurations of actors.

Devices are the interface between
an actor configuration
and the outside world.
Although devices are represented by callable actors,
their implementation is part of the hosting "hardware".
Devices inject message-events
(representing interrupts)
into running configurations.
Devices react to messages
(representing control registers)
from other actors.
Several devices must be implemented
to demonstrate the techniques
used to construct these critical interfaces.

## Project Ecosystem

The VM specification is designed to be suitable
for efficient implementation in an FPGA or ASIC.
The result is a secure independent computational element
that can be integrated into larger designs.

The bare-metal Rust implementation
can be compiled for various existing processors.
This provides the basis for
running the secure virtual processor
on a variety of MCUs, SoCs, and single-board computers
such as the [Raspberry Pi](https://www.raspberrypi.com/).
On the [Betrusted Precursor](https://www.crowdsupply.com/sutajio-kosagi/precursor) platform,
uFork processor core(s) could be implemented in the FPGA!

This project collaborates
at the level of ocap patterns and network protocols
with technology leaders at
[Agoric](https://agoric.com/) and [The Spritely Institute](https://community.spritely.institute/).
It is an example of the "actors all the way down" approach
cited by Douglas Crockford in his **code::dive 2022** talk
[_The Next Programming Language_](https://youtu.be/R2idkNdKqpQ?t=2360).

## License

This technology is being shared freely
for the betterment of the planet.

[Apache License](LICENSE), Version 2.0
