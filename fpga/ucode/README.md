# μCode — a simple stack-machine language for microcode

The [uFork instruction set](../../docs/vm.md)
is complex enough to make direct implementation
on an FPGA challenging.
There are many instructions
that are likely to require multiple steps
to accomplish.
Several instructions include
a _count_ or _index_ operand,
which implies repetition.

Therefore, we have decided
to implement μFork instructions
using a microcode we call [uCode](instructionset.md).
We expect it will be possible
to execute uCode instructions
in a small fixed number of cycles.
The machine model and primitives
are based on [Forth](https://en.wikipedia.org/wiki/Forth_(programming_language)).

Our primary reference
for the implementation of stack-machines
is the excellent book
"[Stack Computers: the new wave](https://users.ece.cmu.edu/~koopman/stack_computers/)"
by Philip J. Koopman, Jr.
(especially the _Canonical Stack Machine_
described in Chapter 3).
In the Koopman taxonomy
uFork is a **SL1** stack-machine,
and uCode is an **ML0** stack-machine.
