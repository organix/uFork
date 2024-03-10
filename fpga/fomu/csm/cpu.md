# uCode CPU Design

Highlights:

  * 16-bit data words
  * 12-bit addresses

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
      |   |  01: D0==0?addr->PC:PC+1->PC,D0+1->D0
      |   |  10: D0==0?addr->PC:PC+1->PC
      |   |  11: D0==0?addr->PC:PC+1->PC,D0-1->D0
      | PC+1->R {0=JUMP, 1=CALL}
    control

### Evaluation Instructions

These instructions evaluate expressions using the D-stack and R-stack.
The ALU performs operations of the _A_ and _B_ values, routed from
various sources and constants. The result is available as input to
both the D-stack and R-stack. The stack-effects are independently
specified, including an extra "drop" for the D-stack to consume two
values. Normally, the program counter is loaded with the address of
the next instruction, but may loaded from the R-stack instead.

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 0 |RPC|  R se |2:1|    D se   | ALU A | ALU B |    ALU op     |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
      ^   ^  \_____/  ^  \_________/ \_____/ \_____/ \______________/
      |   |  00=NONE  |    000=NONE   00=D0   00=D1     0000=NONE
      |   |  01=DROP  |    001=DROP   01=D1   01=+1     0001=ADD
      |   |  10=PUSH  |    010=PUSH   10=R0   10=msb    0010=SUB
      |   |  11=RPLC  |    011=RPLC   11=0    11=-1     0011=MUL
      | R->PC       2DROP  100=SWAP                     0100=AND
    evaluate               101=OVER                     0101=XOR
                           110=ZDUP                     0110=OR 
                           111=ROT3                     0111=ROL
                                                        1000=2ROL
                                                        1001=4ROL
                                                        1010=8ROL
                                                        1011=ASR
                                                        1100=2ASR
                                                        1101=4ASR
                                                        1110=FETCH
                                                        1111=STORE

### Memory Access

  * `@ ( addr -- cell )` -- FETCH
  * `! ( cell addr -- )` -- STORE
  * `>R ( a -- ) R:( -- a )` -- PUSH_R
  * `R> ( -- a ) R:( a -- )` -- R_DROP
  * `R@ ( -- a ) R:( a -- a )` -- R_FETCH


```
`define NO_SE   (3'h0)      // no operation             ( -- )
`define DROP_SE (3'h1)      // remove top               ( a -- )
`define PUSH_SE (3'h2)      // push onto top            ( -- a )
`define RPLC_SE (3'h3)      // replace top              ( a -- b )
`define SWAP_SE (3'h4)      // swap top and next        ( a b -- b a )
`define OVER_SE (3'h5)      // copy next to top         ( a b -- a b a )
`define ZDUP_SE (3'h6)      // copy non-zero top        : ?DUP ( a -- 0 | a a ) DUP IF DUP THEN ;
`define ROT3_SE (3'h7)      // rotate top 3 elements    ( a b c -- b c a )

`define NO_OP   (4'h0)      // a
`define ADD_OP  (4'h1)      // a+b
`define SUB_OP  (4'h2)      // a-b
`define MUL_OP  (4'h3)      // a*b
`define AND_OP  (4'h4)      // a&b
`define XOR_OP  (4'h5)      // a^b
`define OR_OP   (4'h6)      // a|b
`define ROL_OP  (4'h7)      // {a[14:0],a[15]}
```

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
