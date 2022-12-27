# uFork Simulator in C

This implementation of the [**uFork** virtual machine](../ufork.md)
is written in C and compilable for 16, 32, or 64-bits words.
It features a gdb-style debugger capable of single-stepping virtual machine instructions.
Implemented on this platform are a PEG-parser toolkit
and a concurrent Scheme dialect with actor extensions.
An assembler for virtual-machine instructions is also available from Scheme.
The following commands should build and run the simulator.

```
$ make clean all
$ ./ufork
```

NOTE: This is a simulator implementation is a prototype for proof-of-concept.
It produces significant amounts of debugging/tracing output.
The [Rust/WASM version](../ufork-warm/README.md) is intended to be a more-robust implementation.

## Assembly-Language Debugger

On start-up, the simulator halts before executing the first instruction
and displays `@`, the debugger prompt.
To turn off instruction tracing
and continue free-running execution
of the Scheme REPL,
use the `t` and `c` debugger commands.

```
thread spawn: 3232{ip=105,sp=1,ep=16}
(@104) 105: VM_push{v:^66,k:106}
@ t
instruction tracing off
(@104) 105: VM_push{v:^66,k:106}
@ c
```

## Scheme Read-Eval-Print Loop (REPL)

The demonstration application implemented by this simulator prototype
is a Real-Eval-Print loop for a dialect of Scheme with actor extensions.
The REPL is fed by a PEG parser that reads from the console
and generates S-expressions for evaluation.
Lines beginning with `[+888]` display the parsed S-expression.
Lines beginning with `[+999]` display the result of evaluation.
Once the built-in definitions have been parsed and evaluated,
the REPL displays '>', the interactive Scheme prompt.
Enter complete S-expressions at the prompt to experiment with this actor-based Scheme.

```
> '(a . (b . (c . ())))
[+888] (quote (a b c))
[+999] (a b c)
> ((lambda (x) x) (list 1 2 3))
[+888] ((lambda (x) x) (list +1 +2 +3))
[+999] (+1 +2 +3)
> 
```
