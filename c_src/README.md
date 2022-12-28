# uFork Simulator in C

This implementation of the [**uFork** virtual machine](../ufork.md)
is written in C and compilable for 16, 32, or 64-bits words.
It features a gdb-style debugger capable of single-stepping virtual machine instructions.
Implemented on this platform are a PEG-parser toolkit
and a concurrent Scheme dialect with actor extensions.
An assembler for virtual-machine instructions is also available from Scheme.
The following commands build and run the simulator.

```
$ make clean all
$ ./ufork
```

NOTE: This is a simulator implementation of a prototype for proof-of-concept.
It produces significant amounts of debugging/tracing output.
The [Rust/WASM version](../ufork-wasm/README.md) is intended to be a more-robust implementation.

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
### Debugger Commands

This table summarizes the commands available at the debugger prompt.

 Command                | Description
------------------------|-----------------------------------------------
`h[elp]` _command_      | get help on _command_
`b[reak]` _inst_        | set breakpoint at _inst_ (0=none, default: IP)
`w[atch]` _addr_        | set watchpoint on _addr_ (0=none)
`c[ontinue]`            | continue running freely
`s[tep]` _n_            | step _n_ instructions (default: 1)
`n[ext]` _n_            | next _n_ instructions in thread (default: 1)
`d[isasm]` _n_ _inst_   | disassemble _n_ instructions (defaults: 1 IP)
`p[rint]` _addr_        | print value at _addr_
`t[race]`               | toggle instruction tracing (default: on)
`i[nfo]`                | list information topics
`i[nfo]` `r[egs]`       | get information on registers (IP, SP, EP, ...)
`i[nfo]` `t[hreads]`    | get information on threads (continuations)
`i[nfo]` `e[vents]`     | get information on pending events
`q[uit]`                | quit runtime

Commands can be abbreviated to their first letter.
If a command is not recognized (including a blank line),
a one-line command menu is displayed.

```
b[reak] w[atch] c[ontinue] s[tep] n[ext] d[isasm] p[rint] t[race] i[nfo] q[uit]
```

If instruction tracing is on,
a one-line context summary is displayed
before each instruction is executed.
Here is an annotated example:

```
(@3237 +32 . @3233) 61: ^3234 @65 ^16 VM_pick{n:+2,k:19}
------ ------------ --  ------------- ------- ---- ----
^      ^            ^   ^             ^       ^    ^
|      |            |   |             |       |    |
|      |            |   |             |       |    next IP
|      |            |   |             |       immediate arg
|      |            |   |             assembly instruction
|      |            |   stack values (bottom to top)
|      |            current IP
|      actor message
target actor
```

## Scheme Read-Eval-Print Loop (REPL)

The demonstration application implemented by this simulator prototype
is a Real-Eval-Print loop for a dialect of Scheme with actor extensions.
The REPL is fed by a PEG parser that reads from the console
and generates S-expressions for evaluation.
Lines beginning with `[+888]` display the parsed S-expression.
Lines beginning with `[+999]` display the result of evaluation.
Once the built-in definitions have been parsed and evaluated,
the REPL displays `>`, the interactive Scheme prompt.
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
