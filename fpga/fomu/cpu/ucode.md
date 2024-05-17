# uCode/Forth Language

Instructions in uFork are implemented
by a micro-coded machine-language we call _uCode_.
uCode is based on [Forth](https://en.wikipedia.org/wiki/Forth_(programming_language)).
However, uCode is not interactively extensible.
The uCode program is compiled as part of the build
of the uFork soft-core processor.

The uCode machine model
is a traditional zero-operand dual-stack machine.
A significant number of Forth words
are defined as primitive instructions.
Additional words are defined as procedures.
Procedure definitions are expressed
in terms of previously-defined words.

## Word Definitions

The following tables summarize the libarary of pre-defined words.
In these descriptions the following abbreviations are used:

  * **PC** -- program counter
  * **TOS** -- top of (data) stack
  * **NOS** -- next on (data) stack
  * **TORS** -- top of return stack

### Primitive Words

Word        | Stack Effect                              | Description
------------|-------------------------------------------|------------------------------------
`NOP`       | ( -- )                                    | No effect
`DROP`      | ( a -- )                                  | Discard TOS
`DUP`       | ( a -- a a )                              | Copy TOS
`SWAP`      | ( a b -- b a )                            | Swap TOS with NOS
`OVER`      | ( a b -- a b a )                          | Copy NOS to TOS
`ROT`       | ( a b c -- b c a )                        | Rotate top 3 stack items
`-ROT`      | ( a b c -- c a b )                        | Reverse rotate top 3 stack items
`TRUE`      | ( -- -1 )                                 | Boolean TRUE (numeric `-1`)
`FALSE`     | ( -- 0 )                                  | Boolean FALSE (numeric `0`)
`0`         | ( -- 0 )                                  | Numeric `0`
`1`         | ( -- 1 )                                  | Numeric `1`
`-1`        | ( -- -1 )                                 | Numeric `-1`
`LSB`       | ( -- 1 )                                  | Least-significant-bit
`MSB`       | ( -- 0x8000 )                             | Most-significant-bit
`LSB&`      | ( -- 1 )                                  | AND with (test) LSB
`MSB&`      | ( -- 0x8000 )                             | AND with (test) MSB
`LSB\|`     | ( -- 1 )                                  | OR with (set) LSB
`MSB\|`     | ( -- 0x8000 )                             | OR with (set) MSB
`INVERT`    | ( a -- ~a )                               | Bitwise invert
`NEGATE`    | ( a -- -a )                               | Numeric negation
`1+`        | ( a -- a+1 )                              | Increment
`1-`        | ( a -- a-1 )                              | Decrement
`2*`        | ( a -- a*2 )                              | Multiply by `2`
`2/`        | ( a -- a/2 )                              | Divide by `2`
`+`         | ( a b -- a+b )                            | Numeric addition
`-`         | ( a b -- a-b )                            | Numeric subtraction
`*`         | ( a b -- a*b )                            | Numeric multiplication
`AND`       | ( a b -- a&b )                            | Bitwise AND
`XOR`       | ( a b -- a^b )                            | Bitwise XOR
`OR`        | ( a b -- a\|b )                           | Bitwise OR
`ROL`       | ( a -- {a[14:0],a[15]} )                  | Bitwise rotate left
`2ROL`      | ( a -- {a[13:0],a[15:14]} )               | Bitwise rotate left by 2
`4ROL`      | ( a -- {a[11:0],a[15:12]} )               | Bitwise rotate left by 4
`8ROL`      | ( a -- {a[7:0],a[15:8]} )                 | Bitwise rotate left by 8
`ASR`       | ( a -- {a[15],a[15:1]} )                  | Arithmetic shift right
`2ASR`      | ( a -- {a[15],a[15],a[15:2]} )            | Arithmetic shift right by 2
`4ASR`      | ( a -- {a[15],a[15],a[15],a[15],a[15:4]} )| Arithmetic shift right by 4
`@`         | ( addr -- data )                          | Fetch contents of _addr_
`!`         | ( data addr -- )                          | Store _data_ into _addr_
`IO@`       | ( io_reg -- data )                        | Fetch contents of _io_reg_
`IO!`       | ( data io_reg -- )                        | Store _data_ into _io_reg_
`QT@`       | ( qref -- data )                          | Fetch contents of _qref_ field `T`
`QT!`       | ( data qref -- )                          | Store _data_ into _qref_ field `T`
`QX@`       | ( qref -- data )                          | Fetch contents of _qref_ field `X`
`QX!`       | ( data qref -- )                          | Store _data_ into _qref_ field `X`
`QY@`       | ( qref -- data )                          | Fetch contents of _qref_ field `Y`
`QY!`       | ( data qref -- )                          | Store _data_ into _qref_ field `Y`
`QZ@`       | ( qref -- data )                          | Fetch contents of _qref_ field `Z`
`QZ!`       | ( data qref -- )                          | Store _data_ into _qref_ field `Z`
`>R`        | ( a -- ) ( R: -- a )                      | Move TOS to TORS
`R>`        | ( -- a ) ( R: a -- )                      | Move TORS to TOS
`R@`        | ( -- a ) ( R: a -- a )                    | Copy TORS to TOS
`RDROP`     | ( -- a ) ( R: a -- a )                    | Discard TORS
`FAIL`      | ( -- )                                    | Signal processor failure (HALT!)
`EXIT`      | ( R: addr -- ) addr->PC                   | Move TORS to PC<sup>*</sup>

<sup>*</sup> `EXIT` is often encoded into the preceeding instruction by the `;` word.

### Procedure Words

Word        | Stack Effect                              | Description
------------|-------------------------------------------|------------------------------------
`?:`        | ( altn cnsq cond -- cnsq \| altn )        | If _cond_ is `0` then _altn_, else _cnsq_
`NIP`       | ( a b -- b )                              | Discard NOS
`TUCK`      | ( a b -- b a b )                          | Copy TOS before NOS and TOS
`2DUP`      | ( a b -- a b a b )                        | Copy NOS and TOS
`2DROP`     | ( a b -- )                                | Discard NOS and TOS
`ABS`       | ( n -- +n )                               | Numeric absolute (positive) value
`BOOL`      | ( n -- flag )                             | If _n_ is `0` then `FALSE`, else `TRUE`
`=`         | ( a b -- a==b )                           | If _a_==_b_ then `TRUE`, else `FALSE`
`0=`        | ( n -- n==0 )                             | If _n_ is `0` then `TRUE`, else `FALSE`
`NOT`       | ( flag -- !flag )                         | Boolean NOT (same as `0=`)
`<>`        | ( a b -- a!=b )                           | If _a_!=_b_ then `TRUE`, else `FALSE`
`0>`        | ( n -- n>0 )                              | If _n_>0 then `TRUE`, else `FALSE`
`0<`        | ( n -- n<0 )                              | If _n_<0 then `TRUE`, else `FALSE`
`>`         | ( a b -- a>b )                            | If _a_>_b_ then `TRUE`, else `FALSE`
`<`         | ( a b -- a<b )                            | If _a_<_b_ then `TRUE`, else `FALSE`
`>=`        | ( a b -- a>=b )                           | If _a_>=_b_ then `TRUE`, else `FALSE`
`<=`        | ( a b -- a<=b )                           | If _a_<=_b_ then `TRUE`, else `FALSE`
`MAX`       | ( a b -- a \| b )                         | If _a_>=_b_ then _a_, else _b_
`MIN`       | ( a b -- a \| b )                         | If _a_<=_b_ then _a_, else _b_
`@1+`       | ( addr -- )                               | Increment contents of _addr_
`@1-`       | ( addr -- )                               | Decrement contents of _addr_

### Comments

When the compiler encounters `(` surrounded by whitespace,
it begins a comment that continues until the matching `)`.
Comments may be nested.
Otherwise, all words within a comments are ignored.

### Literals, Constants, and Variables

Word                | Stack Effect                          | Description
--------------------|---------------------------------------|----------------------------------------
`(LIT)` _data_      | ( -- [PC+1] ) PC+2->PC                | Push literal _data_ onto stack
`(CONST)` _data_    | ( -- [PC+1] ) ( R: addr -- ) addr->PC | Push literal _data_ onto stack and `EXIT`

When the compiler encounters a literal number,
either in decimal (e.g.: `-420`)
or hexadecimal (e.g.: `0x7F`),
it is compiled as `(LIT)`
followed by the number as _data_.
At runtime, this causes the _data_
to be copied to the TOS.

> _number_ `CONSTANT` _name_

If a literal _number_ is followed by `CONSTANT` and a _name_,
then the compiled `(LIT)` is converted to `(CONST)`,
which is `(LIT)` plus `EXIT` (in a single instruction).
The address of the `(CONST)` is added to the dictionary
as the procedure _name_.
Calling the _name_ procedure copies the _number_ to the TOS.

> `VARIABLE` _name_

When the compiler encounters `VARIABLE` followed by a _name_,
a variable location is allocated and initialized to `0`.
The address of the variable is compiled as a `(CONST)`
and the _name_ is added to the dictionary
as a procedure that produces the address.

### Calls, Jumps, and Definitions

If a word designates a procedure,
it is compiled into a _call_ to that procedure.
A _call_ copies `PC+1` to TORS,
and loads the `PC` with address of the procedure.

> `:` _name_ ... _body_ ... `;`

A procedure definition usually begins with `:` and ends with `;`.
The `:` _name_ adds a procedure label to the dictionary,
but does not generate any code.
Multiple labels (aliases) may preceed the _body_.
The `;` compiles to an optimized `EXIT`.
If the preceeding word in the _body_ was a procedure call,
it is converted to a _jump_ instruction (tail-call optimization).
If the preceeding word in the _body_ was an instruction with no R-stack effect,
the `EXIT` is added to that instruction (exit compression).
Otherwise, a stand-alone `EXIT` is compiled (`NOP` + `EXIT`).
Ending a definition with `EXIT` instead of `;`
suppresses any optimizations and compiles a stand-alone `EXIT`.
Additional labels within the _body_ create callable entry-points
for tail-segments of the definition.

The uCode machine supports several kinds control transfer
with the target `PC` compiled into the instruction.
A _jump_ is a basic unconditional transfer of control.
A _call_ additionally copies `PC+1` to TORS.
Either can be made conditional on a TOS value of `0`.
Auto-increment/decrement variants maintain a _count_
in TORS, jumping and removing the _count_ on `0`.
The compiler generates the appropriate instructions
for a variety of control-structures described below.

### Conditional and Looping Control-Structures

The uCode compiler implements several standard Forth control-flow words.

> _test_ `IF` ... _true-body_ ... `THEN`

Remove the result of the _test_ from the stack. If it is 0, jump to the instruction after `THEN`. If it is not 0, continue with _true-body_.

> _test_ `IF` ... _true-body_ ... `ELSE` ... _false-body_ ... `THEN`

Remove the result of the _test_ from the stack. If it is 0, jump to the instruction after `ELSE` and execute _false-body_. If it is not 0, continue with _true-body_. When `ELSE` is encountered, jump to the instruction after `THEN`.
 
> `BEGIN` ... _body_ ... `AGAIN`

Execute the _body_. When `AGAIN` is encountered, jump to the instruction after `BEGIN`. Note that this infinite loop can also be constructed with a label for `BEGIN` and a tail-call to that label for `AGAIN`. Both compile to a single _jump_ instruction.

> `BEGIN` ... _body_ ... _test_ `UNTIL`

Execute _body_, including the _test_. Remove the result of the _test_ from the stack. If it is 0, jump to the instruction after `BEGIN`. If it is not 0, continue with the instruction after `UNTIL`. Note that this compiles to a single _jump-if-zero_ instruction from `UNTIL` to `BEGIN`.

> `BEGIN` ... _preamble_ ... _test_ `WHILE` ... _body_ ... `REPEAT`

Execute _preamble_, including the _test_. Remove the result of the _test_ from the stack. If it is 0, jump to the instruction after `REPEAT`. If it is not 0, continue with the _body_. When `REPEAT` is encountered, jump to the instruction after `BEGIN`.

The uCode compiler also implements several non-standard control-flow words (although `?LOOP-` is similar to the standard `?DO` loop).

> _count_ `?LOOP-` ... _loop-body_ ... `AGAIN`

Move _count_ from the D-stack to the R-stack. If it is 0, remove the _count_ from the R-stack and jump to the instruction after `AGAIN`. If it is not 0, decrement the _count_ and continue with the _loop-body_. Inside the _loop-body_, the _count_ may be copied from the R-stack to the D-stack by the word `I` (as in, "loop index"). When `AGAIN` is encountered, jump back to `?LOOP-`, repeating the test and decrement.

> _-count_ `?LOOP+` ... _loop-body_ ... `AGAIN`

Move _-count_ from the D-stack to the R-stack. If it is 0, remove the _count_ from the R-stack and jump to the instruction after `AGAIN`. If it is not 0, increment the _count_ and continue with the _loop-body_. Inside the _loop-body_, the _count_ may be copied from the R-stack to the D-stack by the word `I` (as in, "loop index"). When `AGAIN` is encountered, jump back to `?LOOP+`, repeating the test and increment.

> _test_ `SKZ` _word_

Remove the result of the _test_ from the stack. If it is 0, jump to the instruction after _word_. If it is not 0, continue with _word_. SKZ stands for "skip, if zero".
 
> _test_ `CALLZ` _word_

Remove the result of the _test_ from the stack. If it is 0, call _word_, which must be a procedure. If it is not 0, continue with the instruction after _word_. Note that this compiles to a single _call-if-zero_ instruction.
