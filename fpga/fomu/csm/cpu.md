# uCode CPU Design

## Highlights

  * 16-bit data words
  * 12-bit addresses

## Address Space

Start  | End    | Description
-------|--------|-------------------------------
`0000` | `0FFF` | uCode program and data
`1000` | `3EFF` | (reserved)
`3F00` | `3FFF` | memory-mapped device registers
`4000` | `7FFF` | uFork quad-cell RAM
`8000` | `FFFF` | uFork quad-cell ROM

### uCode Memory

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 0 | 0 | 0 | 0 |                          uCode memory address |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*

### Device Registers

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 0 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |     device ID |  register ID  |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*

  * `3F0x`: Serial UART
    * `3F00`: TX?
    * `3F01`: TX!
    * `3F02`: RX?
    * `3F03`: RX@

### uFork RAM

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 0 | 1 |cap|                   uFork quad-cell address | field |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
             \_/                                             \_____/
              0=Read/Write Cell                               00:T
              1=Opaque Capability                             00:X
                                                              00:Y
                                                              00:Z

### uFork ROM

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 1 |                           uFork quad-cell address | field |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
                                                             \_____/
                                                              00:T
                                                              00:X
                                                              00:Y
                                                              00:Z

## Instruction Encoding

There are two different instruction encoding patterns. One for control
transfer instructions (which carry an immediate address field), and one
for evaluation instructions, which affect the ALU, D-stack, and R-stack.

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
     \_/
      0=Evaluate
      1=Control

### Control Transfer Instructions

These instructions carry a memory address in an immediate field that
that may be used to load the program counter. In addition, the current
program counter may be pushed onto the R-stack. If the instruction is
conditional, the program counter is only loaded from the immediate
field if the value at the top of the data stack (D0) is zero, otherwise
the program counter is loaded with the address of the next instruction,
which is the default behavior of all instructions. If D0 is _not_ zero,
it may be incremented or decremented by one.

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 1 |PCR|tst/inc|                          uCode memory address |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
      ^   ^  \_____/
      |   |  00: addr->PC
      |   |  01: D0==0?addr->PC,DROP:PC+1->PC,D0+1->D0
      |   |  10: D0==0?addr->PC,DROP:PC+1->PC,DROP
      |   |  11: D0==0?addr->PC,DROP:PC+1->PC,D0-1->D0
      | PC+1->R {0:JUMP, 1:CALL}
    control

### Evaluation Instructions

These instructions evaluate expressions using the D-stack and R-stack.
The ALU performs operations of the _A_ and _B_ values, routed from
various sources and constants. The result is available as input to
both the D-stack and R-stack. The stack-effects are independently
specified, including an extra "drop" for the D-stack to consume two
values. Normally, the program counter is loaded with the address of
the next instruction, but may be loaded from the R-stack instead.

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 0 |RPC|  R se |2:1|    D se   | ALU A | ALU B |    ALU op     |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
      ^   ^  \_____/  ^  \_________/ \_____/ \_____/ \______________/
      |   |  00:NONE  |    000:NONE   00:D0   00:D0     0000:NONE
      |   |  01:DROP  |    001:DROP   01:D1   01:+1     0001:ADD
      |   |  10:PUSH  |    010:PUSH   10:R0   10:msb    0010:SUB
      |   |  11:RPLC  |    011:RPLC   11:0    11:-1     0011:MUL
      | R->PC       2DROP  100:SWAP                     0100:AND
    evaluate               101:OVER                     0101:XOR
                           110:ZDUP                     0110:OR 
                           111:ROT3                     0111:ROL
                                                        1000:2ROL
                                                        1001:4ROL
                                                        1010:8ROL
                                                        1011:ASR
                                                        1100:2ASR
                                                        1101:4ASR
                                                        1110:DSP?
                                                        1111:MEM*

\* If `ALU op` is `MEM`, then it's a _memory instruction_ instead.

#### Memory Instructions

These instructions bypass the normal evaluation ALU module.
Instead they perform operations involving a memory cycle.
The result is available as input to both the D-stack and R-stack.
The top 8 bits are the same as other evaluation instructions.
`D0` is routed to the address lines, and `D1` to the data lines.

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 0 |RPC|  R se |2:1|    D se   |W/R| MEM range | 1 | 1 | 1 | 1 |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
      ^   ^  \_____/  ^  \_________/ \_/ \_________/
      |   |  00:NONE  |    000:NONE  0:R   000:UC
      |   |  01:DROP  |    001:DROP  1:W   001:[PC]*
      |   |  10:PUSH  |    010:PUSH        010:??
      |   |  11:RPLC  |    011:RPLC        011:DEV
      | R->PC       2DROP  100:SWAP        100:Q_T
    evaluate               101:OVER        101:Q_X
                           110:ZDUP        110:Q_Y
                           111:ROT3        111:Q_Z

\* If `MEM range` is `[PC]`, then read from `PC+1` and increment again.

### Primitive Encodings

Word    | Stack Effect              | Hex    | Binary
--------|---------------------------|--------|-----------------------
NOP     | ( -- )                    | `0000` | `0000_0000_0000_0000`
\+      | ( a b -- a+b )            | `0B41` | `0000_1011_0100_0001`
AND     | ( a b -- a&b )            | `0B44` | `0000_1011_0100_0100`
XOR     | ( a b -- a^b )            | `0B45` | `0000_1011_0100_0101`
ROL     | ( a -- {a[14:0],a[15]} )  | `0307` | `0000_0011_0000_0111`
1+      | ( a -- a+1 )              | `0311` | `0000_0011_0001_0001`
@       | ( addr -- cell )          | `030F` | `0000_0011_0000_1111`
!       | ( cell addr -- )          | `098F` | `0000_1001_1000_1111`
(LIT) w | ( -- [PC+1] ) PC+2->PC    | `021F` | `0000_0010_0001_1111`
DUP     | ( a -- a a )              | `0200` | `0000_0010_0000_0000`
DROP    | ( a -- )                  | `0100` | `0000_0001_0000_0000`
SWAP    | ( a b -- b a )            | `0400` | `0000_0100_0000_0000`
SKZ w   | ( cond -- )               | --     | _conditional jump macro_
\>R     | ( a -- ) R:( -- a )       | `2100` | `0010_0001_0000_0000`
R>      | ( -- a ) R:( a -- )       | `1280` | `0001_0010_1000_0000`
R@      | ( -- a ) R:( a -- a )     | `0280` | `0000_0010_1000_0000`
EXIT    | R:( addr -- ) addr->PC    | `5000` | `0101_0000_0000_0000`
\-      | ( a b -- a-b )            | `0B42` | `0000_1011_0100_0001`
OR      | ( a b -- a\|b )           | `0B46` | `0000_1011_0100_0100`
1-      | ( a -- a-1 )              | `0312` | `0000_0011_0001_0010`
INVERT  | ( a -- ~a )               | `0335` | `0000_0011_0011_0101`
NEGATE  | ( a -- -a )               | `03C2` | `0000_0011_1100_0010`
OVER    | ( a b -- a b a )          | `0500` | `0000_0101_0000_0000`
ROT     | ( a b c -- b c a )        | `0700` | `0000_0111_0000_0000`
2DROP   | ( a b -- )                | `0900` | `0000_1001_0000_0000`
FALSE   | ( -- 0 )                  | `02C0` | `0000_0010_1100_0000`
TRUE    | ( -- -1 )                 | `02F5` | `0000_0010_1111_0110`
2*      | ( a -- a+a )              | `0301` | `0000_0011_0000_0001`

## Component Block Diagrams

    .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
        +---------------+
        | ALU           |
        |               |
    -4->|i_op     o_data|=W=>
    =W=>|i_arg0         |
    =W=>|i_arg1         |
        |               |
        |>i_clk         |
        +---------------+

        +-------------------+
        | uCode memory      |
        |                   |
    --->|i_wr_en     i_rd_en|<---
    =A=>|i_waddr     i_raddr|<=A=
    <=D=|i_wdata     o_rdata|=D=>
        |                   |
        |>i_clk             |
        +-------------------+

        +---------------+
        | D-stack       |
        |               |
    -3->|i_se       o_s0|=W=>
    =W=>|i_data     o_s1|=W=>
        |               |
        |>i_clk         |
        +---------------+

        +---------------+
        | R-stack       |
        |               |
    --->|i_push     o_s0|=W=>
    --->|i_drop     o_s1|=W=>
    =W=>|i_data         |
        |               |
        |>i_clk         |
        +---------------+

        +---------------+
        | serial_rx     |
        |               |
    --->|i_rx     o_data|=8=>
        |           o_wr|--->
        |               |
        |>i_clk         |
        +---------------+

        +---------------+
        | serial_tx     |
        |               |
    =8=>|i_data     o_tx|--->
    --->|i_wr           |
    <---|o_busy         |
        |               |
        |>i_clk         |
        +---------------+
    .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
