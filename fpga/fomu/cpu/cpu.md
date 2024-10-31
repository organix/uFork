# uCode CPU Design

The uCode micro-code processor is designed to implement
the uFork actor-oriented processor.
It is not intended to be a stand-alone general-purpose CPU.
This design allows the uFork processor to be expressed
in a higher-level language (Forth),
rather than directly in gateware.

## Highlights

  * 16-bit data words
  * 12-bit addresses
  * 2 clock-cycles per instruction
  * Dedicated hardware data/return stacks

## Operational Description

The current FPGA design implements
a 2-phase instruction execution machine.
Each uCode instruction executes
in 2 clock-cycles.
The phases are ALU/MEM and STACK.

    :       ALU/MEM phase                               :       STACK phase
    :                                                   :
    Instruction ----------+------+------------+-------> Instruction     +---------->
    :                     |      |            |         :         |     |
    :                     |      V            |         :         |     |
    :         +---> %-----|--> Memory --+     |         :         |   Memory
    :         |     ^     |             |     |         :         |     ^
    :         |     |     |             |     V         :         |     |
    PC+1 -----|-----+-----|-------------|---> %-------> PC -------|-----+--> +1 --->
    :         |     |     |             |     %         :         |
    :         |     +-----|---> +1 -----|---> %         :         |
    :         |     |     |             |     ^         :         |
    :         |     +-----|-------------|-----|----+    :         +-------------+
    :         |           |             |     |    |    :         |             V
    R-stack --|-----+-----|-------------|-----+    +--> R-stack --|---> %--> R-stack
    :         |     |     |             |               :         |     ^
    :         |     |     |             |               :         +-----|-------+
    :         |     V     V             V               :               |       V
    D-stack --+---> %--> ALU ---------> %-------------> Result ---------+--> D-stack
    :                                                   :

### ALU/MEM phase

At the beginning of the ALU/MEM phase
the instruction has been fetched from uCode memory
and the program-counter (`PC`) incremented by `1`,
pointing to the default next-instruction location.
Registered inputs include:

  * The current instruction
  * The incremented program-counter (`PC+1`)
  * The top 2 elements of the D(ata)-Stack (`TOS` and `NOS`)
  * The top element of the R(eturn)-Stack (`TORS`)

For ALU instructions,
fields of the instruction select
the inputs to the ALU
and the operation to perform.
If the `RPC` bit is set,
the `PC` is loaded from `TORS`,
otherwise it remains just `PC+1`.

For MEM instructions,
fields of the instruction select
the type of memory accessed
and the operation to perform (read or write).
If the `RPC` bit is set,
the `PC` is loaded from `TORS`,
otherwise it remains just `PC+1`,
or `PC+2` if the memory read is from `PC+1`.
A memory write consumes both `TOS` (the address)
and `NOS` (the data), so an extra DROP
is performed on the D-stack in this phase.

For control-transfer instructions,
most of the bits are an immediate address
that may be loaded into the `PC`.
If the `PRC` bit is set,
`PC+1` is pushed onto the R-stack
as a return-address (a CALL versus a JUMP).
If the branch is conditional,
the immediate address is only used
If `TOS` is zero,
otherwise it remains just `PC+1`.
If auto-increment/decrement are selected,
the ALU performs the operation on `TORS`.

### STACK phase

At the beginning of the STACK phase
the address of the next instruction has been selected
and the results of either the ALU operation or MEM access are available.
Registered inputs include:

  * The current instruction (carried over from the ALU/MEM phase)
  * The selected program-counter (`PC`) from the ALU/MEM phase
  * The result of the ALU operation, for ALU instructions
  * The result of the memory cycle, for MEM instructions

For ALU instructions,
fields of the instruction select
effects on the D-stack and R-stack.
The ALU result is available
to be PUSHed or RPLCed on either stack.

For MEM instructions,
fields of the instruction select
effects on the D-stack and R-stack.
If the memory operation was a read,
the result data is available
to be PUSHed or RPLCed on either stack.

For control-transfer instructions,
the stack operations (if any)
are implied by the branch-type.
If the branch is conditional,
the test value (`TOS`) is DROPed from the D-stack.
If auto-increment/decrement are selected;
if `TORS` was zero it is DROPed,
otherwise it is RPLCed by the ALU result.

Finally, the `PC` selected in the ALU/MEM phase
is used to fetch the next instruction to execute,
and the `PC` is incremented by `1`.

## Memory Models

The uCode memory is organized as 16-bit words
with a 12-bit (4k) maximum address range.
All uCode memory is writeable,
with code and data sharing the same address-space.
The uFork memory is organized into 4-word quads
with 16-bits per word (called "quad-space").
Type-tagging bits are used to distinguish
uFork ROM (where most code resides) and
uFork RAM (for actors and working storage).

### uFork Quad-Space

16-bit uFork type-tagged data values are structured as follows:

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    |fix|mut|cap| ? |                      uFork quad-memory offset |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
      ^   ^   ^   ^
      |   |   |   |
      |   |   |  ignored
      |   |  {0:transparent, 1:opaque}
      |  {0:immutable, 1:mutable}
     {0:pointer, 1:fixnum}

The 4 most-significant bits are the type-tag. However, the bits must be
considered sequentially starting with the MSB, indicating a 15-bit _fixnum_.

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 1 |   15-bit signed integer in 2's-complement representation  |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*

Next we consider references to ROM, with 14-bit quad-memory addresses.

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 0 | 0 |                    14-bit offset to quad-cell in ROM  |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*

Next we consider references to RAM, with 12-bit quad-memory addresses.

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 0 | 1 |cap| ? |            12-bit offset to quad-cell in RAM  |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*

The `cap` bit indicates a capability reference to an opaque actor.

### uCode Access to Quad-Space

uCode has separate memory-access instructions
for each field of a uFork quad-cell.
This keeps the uCode data-path to a manageable 16-bits wide.
uFork quad-space is mapped into SPRAMs on the UP5K FPGA.
Each SPRAM is organized as 16-bit words with a 14-bit (16k) address range.
We designate the least-significant 2 bits as the quad-field selector,
giving us a 12-bit quad-cell offset into each SPRAM.

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    |  bank |                       12-bit quad-cell offset | field |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
     \_____/                                                 \_____/
      00:UC                                                   00:T
      01:RAM                                                  01:X
      10:ROM0                                                 10:Y
      11:ROM1                                                 11:Z

One SPRAM is used to hold mutable uFork user-memory (RAM).
Two SPRAMs are used to hold "immutable" uFork code and data (ROM).

**NOTE:** uCode must be able to write to uFork "ROM" to implement a boot-loader.

## Device Hardware

All hardware device interfaces are implemented
via pseudo-memory-mapped control registers.
These "registers" can be read/written
in a single CPU-instruction cycle.

### Device Registers

      7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*
    |    device ID  |  register ID  |
    *---+---+---+---*---+---+---+---*

  * `0x`: Serial UART
    * `00`: TX?
    * `01`: TX!
    * `02`: RX?
    * `03`: RX@

  * `1x`: SPI Flash Memory (planned)
    * `16`: ISR
    * `17`: ICR
    * `18`: CR0
    * `19`: CR1
    * `1A`: CR2
    * `1B`: BR
    * `1C`: SR
    * `1D`: TXDR
    * `1E`: RXDR
    * `1F`: CSR

## Instruction Encoding

There are two primary instruction encoding patterns. One for control
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
field if the value at the top of the data stack (TOS) is zero, otherwise
the program counter is loaded with the address of the next instruction,
which is the default behavior of all instructions. If the instruction
is auto-increment/decrement, the top of the return stack (TORS) is tested
instead of TOS, and if TORS _not_ zero, it is incremented/decremented by 1.

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 1 |PCR|tst/inc|                          uCode memory address |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
      ^   ^  \_____/
      |   |  00: addr->PC
      |   |  01: TOS==0 ? addr->PC,DROP : PC+1->PC,DROP
      |   |  10: TORS==0 ? PC+1->PC,RDROP : addr->PC,TORS+1->TORS
      |   |  11: TORS==0 ? PC+1->PC,RDROP : addr->PC,TORS-1->TORS
      | PC+1->R {0:JUMP, 1:CALL}
    control

### Evaluation Instructions

These instructions evaluate expressions using the D-stack and R-stack.
The ALU performs operations of the _A_ and _B_ values, routed from
various sources and constants. The result is available as input to
both the D-stack and R-stack. The stack-effects are independently
specified. Normally, the program counter is loaded with the address of
the next instruction, but may be loaded from the R-stack instead.

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 0 |RPC|  R se | ? |    D se   | ALU A | ALU B |    ALU op     |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
      ^   ^  \_____/     \_________/ \_____/ \_____/ \______________/
      |   |  00:NONE       000:NONE  00:TOS   00:TOS    0000:NONE
      |   |  01:DROP       001:DROP  01:NOS   01:+1     0001:ADD
      |   |  10:PUSH       010:PUSH  10:TORS  10:msb    0010:SUB
      |   |  11:RPLC       011:RPLC  11:0     11:-1     0011:MUL
      | R->PC              100:SWAP                     0100:AND
    evaluate               101:ROT3                     0101:XOR
                           110:RROT                     0110:OR 
                           111:ALU2                     0111:ROL
                                                        1000:2ROL
                                                        1001:4ROL
                                                        1010:8ROL
                                                        1011:ASR
                                                        1100:2ASR
                                                        1101:4ASR
                                                        1110:DSP?
                                                        1111:MEM*

\* If `ALU op` is `MEM`, then it's a _memory instruction_ instead.

#### ALU Operations

Operation   | Encoding  | Result
------------|-----------|--------------------------------------
NO_OP       | `(4'h0)`  | a
ADD_OP      | `(4'h1)`  | a+b
SUB_OP      | `(4'h2)`  | a-b
MUL_OP      | `(4'h3)`  | a\*b
AND_OP      | `(4'h4)`  | a&b
XOR_OP      | `(4'h5)`  | a^b
OR_OP       | `(4'h6)`  | a\|b
ROL_OP      | `(4'h7)`  | {a[14:0],a[15]}
ROL2_OP     | `(4'h8)`  | {a[13:0],a[15:14]}
ROL4_OP     | `(4'h9)`  | {a[11:0],a[15:12]}
ROL8_OP     | `(4'hA)`  | {a[7:0],a[15:8]}
ASR_OP      | `(4'hB)`  | {a[15],a[15:1]}
ASR2_OP     | `(4'hC)`  | {a[15],a[15],a[15:2]}
ASR4_OP     | `(4'hD)`  | {a[15],a[15],a[15],a[15],a[15:4]}
_reserved_  | `(4'hE)`  | DSP/co-processor hook?
MEM_OP      | `(4'hF)`  | memory operation

#### Memory Instructions

These instructions bypass the normal evaluation ALU module.
Instead they perform operations involving a memory cycle.
The result is available as input to both the D-stack and R-stack.
The top 8 bits are the same as other evaluation instructions.
`TOS` is routed to the address lines, and `NOS` to the data lines.

     15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
    | 0 |RPC|  R se | ? |    D se   |W/R| MEM range | 1 | 1 | 1 | 1 |
    *---+---+---+---*---+---+---+---*---+---+---+---*---+---+---+---*
      ^   ^  \_____/     \_________/ \_/ \_________/
      |   |  00:NONE       000:NONE  0:R   000:UC
      |   |  01:DROP       001:DROP  1:W   001:[PC+1]*
      |   |  10:PUSH       010:PUSH        010:??
      |   |  11:RPLC       011:RPLC        011:DEV
      | R->PC              100:SWAP        100:Q_T
    evaluate               101:ROT3        101:Q_X
                           110:RROT        110:Q_Y
                           111:ALU2        111:Q_Z

\* If `MEM range` is `[PC+1]`, then read from `PC+1` and increment again (write is ignored).

NOTE: The unused memory range `3'b010` is currently used to implement `FAIL`,
which halts the processor as an illegal instruction.

#### Stack Operations

Operation   | Encoding  | Description           | Stack Effect
------------|-----------|-----------------------|--------------
NO_SE       | `(3'h0)`  | no operation          | ( -- )
DROP_SE     | `(3'h1)`  | remove top            | ( a -- )
PUSH_SE     | `(3'h2)`  | push onto top         | ( -- a )
RPLC_SE     | `(3'h3)`  | replace top           | ( a -- b )
SWAP_SE     | `(3'h4)`  | swap top and next     | ( a b -- b a )
ROT3_SE     | `(3'h5)`  | rotate top 3 elements | ( a b c -- b c a )
RROT_SE     | `(3'h6)`  | reverse rotate top 3  | ( a b c -- c a b )
ALU2_SE     | `(3'h7)`  | drop 2, push 1        | ( a b -- c )

### Primitive Encodings

Word    | Stack Effect              | Hex    | Binary
--------|---------------------------|--------|-----------------------
NOP     | ( -- )                    | `0000` | `0000_0000_0000_0000`
INVERT  | ( a -- ~a )               | `0335` | `0000_0011_0011_0101`
NEGATE  | ( a -- -a )               | `03C2` | `0000_0011_1100_0010`
\+      | ( a b -- a+b )            | `0741` | `0000_0111_0100_0001`
\-      | ( a b -- a-b )            | `0742` | `0000_0111_0100_0010`
\*      | ( a b -- a\*b )           | `0743` | `0000_0111_0100_0011`
AND     | ( a b -- a&b )            | `0744` | `0000_0111_0100_0100`
XOR     | ( a b -- a^b )            | `0745` | `0000_0111_0100_0101`
OR      | ( a b -- a\|b )           | `0746` | `0000_0111_0100_0110`
ROL     | ( a -- {a[14:0],a[15]} )  | `0307` | `0000_0011_0000_0111`
2ROL    | ( a -- {a[13:0],a[15:14]} ) | `0308` | `0000_0011_0000_1000`
4ROL    | ( a -- {a[11:0],a[15:12]} ) | `0309` | `0000_0011_0000_1001`
8ROL    | ( a -- {a[7:0],a[15:8]} ) | `030A` | `0000_0011_0000_1010`
ASR     | ( a -- {a[15],a[15:1]} ) | `030B` | `0000_0011_0000_1011`
2ASR    | ( a -- {a[15],a[15],a[15:2]} ) | `030C` | `0000_0011_0000_1100`
4ASR    | ( a -- {a[15],a[15],a[15],a[15],a[15:4]} ) | `030D` | `0000_0011_0000_1101`
FALSE   | ( -- 0 )                  | `02C0` | `0000_0010_1100_0000`
TRUE    | ( -- -1 )                 | `02F6` | `0000_0010_1111_0110`
LSB     | ( -- 1 )                  | `02D6` | `0000_0010_1101_0110`
MSB     | ( -- 0x8000 )             | `02E6` | `0000_0010_1110_0110`
LSB&    | ( a -- a&1 )              | `0314` | `0000_0011_0001_0100`
MSB&    | ( a -- a&0x8000 )         | `0324` | `0000_0011_0010_0100`
LSB\|   | ( a -- a\|1 )             | `0316` | `0000_0011_0001_0110`
MSB\|   | ( a -- a\|0x8000 )        | `0326` | `0000_0011_0010_0110`
1+      | ( a -- a+1 )              | `0311` | `0000_0011_0001_0001`
1-      | ( a -- a-1 )              | `0312` | `0000_0011_0001_0010`
2*      | ( a -- a*2 )              | `0301` | `0000_0011_0000_0001`
2/      | ( a -- a/2 )              | `030B` | `0000_0011_0000_1011`
(LIT) w | ( -- [PC+1] ) PC+2->PC    | `021F` | `0000_0010_0001_1111`
@       | ( addr -- cell )          | `030F` | `0000_0011_0000_1111`
!       | ( cell addr -- )          | `098F` | `0000_1001_1000_1111`
DUP     | ( a -- a a )              | `0200` | `0000_0010_0000_0000`
DROP    | ( a -- )                  | `0100` | `0000_0001_0000_0000`
SWAP    | ( a b -- b a )            | `0400` | `0000_0100_0000_0000`
SKZ w   | ( cond -- )               | `9`(PC+2) | `1001_xxxx_xxxx_xxxx`
\>R     | ( a -- ) ( R: -- a )      | `2100` | `0010_0001_0000_0000`
R>      | ( -- a ) ( R: a -- )      | `1280` | `0001_0010_1000_0000`
R@      | ( -- a ) ( R: a -- a )    | `0280` | `0000_0010_1000_0000`
RDROP   | ( -- ) ( R: a -- )        | `1000` | `0001_0000_0000_0000`
OVER    | ( a b -- a b a )          | `0240` | `0000_0010_0000_0000`
ROT     | ( a b c -- b c a )        | `0500` | `0000_0101_0000_0000`
-ROT    | ( a b c -- c a b )        | `0600` | `0000_0110_0000_0000`
IO@     | ( io_reg -- data )        | `033F` | `0000_0011_0011_1111`
IO!     | ( data io_reg -- )        | `09BF` | `0000_1001_1011_1111`
QT@     | ( qref -- data )          | `034F` | `0000_0011_0100_1111`
QT!     | ( data qref -- )          | `09CF` | `0000_1001_1100_1111`
QX@     | ( qref -- data )          | `035F` | `0000_0011_0101_1111`
QX!     | ( data qref -- )          | `09DF` | `0000_1001_1101_1111`
QY@     | ( qref -- data )          | `036F` | `0000_0011_0110_1111`
QY!     | ( data qref -- )          | `09EF` | `0000_1001_1110_1111`
QZ@     | ( qref -- data )          | `037F` | `0000_0011_0111_1111`
QZ!     | ( data qref -- )          | `09FF` | `0000_1001_1111_1111`
FAIL    | _illegal instruction_     | `002F` | `0000_0000_0010_1111`
EXIT    | ( R: addr -- ) addr->PC   | `5000` | `0101_0000_0000_0000`

## Resource Usage

This section tracks usage of FPGA resources
as the design and implementation evolves.

###  Baseline (1k uCode, no devices)

    Info: Device utilisation:
    Info: 	         ICESTORM_LC:   928/ 5280    17%
    Info: 	        ICESTORM_RAM:     4/   30    13%
    Info: 	               SB_IO:     8/   96     8%
    Info: 	               SB_GB:     7/    8    87%
    Info: 	        ICESTORM_PLL:     0/    1     0%
    Info: 	         SB_WARMBOOT:     0/    1     0%
    Info: 	        ICESTORM_DSP:     0/    8     0%
    Info: 	      ICESTORM_HFOSC:     0/    1     0%
    Info: 	      ICESTORM_LFOSC:     0/    1     0%
    Info: 	              SB_I2C:     0/    2     0%
    Info: 	              SB_SPI:     0/    2     0%
    Info: 	              IO_I3C:     0/    2     0%
    Info: 	         SB_LEDDA_IP:     0/    1     0%
    Info: 	         SB_RGBA_DRV:     1/    1   100%
    Info: 	      ICESTORM_SPRAM:     0/    4     0%
    Info: Max frequency for clock 'clk': 30.75 MHz (PASS at 12.00 MHz)

### Expand uCode Memory (2k uCode, no devices)

    Info: Device utilisation:
    Info: 	         ICESTORM_LC:   931/ 5280    17%
    Info: 	        ICESTORM_RAM:     8/   30    26%
    Info: 	               SB_IO:     8/   96     8%
    Info: 	               SB_GB:     7/    8    87%
    Info: 	        ICESTORM_PLL:     0/    1     0%
    Info: 	         SB_WARMBOOT:     0/    1     0%
    Info: 	        ICESTORM_DSP:     0/    8     0%
    Info: 	      ICESTORM_HFOSC:     0/    1     0%
    Info: 	      ICESTORM_LFOSC:     0/    1     0%
    Info: 	              SB_I2C:     0/    2     0%
    Info: 	              SB_SPI:     0/    2     0%
    Info: 	              IO_I3C:     0/    2     0%
    Info: 	         SB_LEDDA_IP:     0/    1     0%
    Info: 	         SB_RGBA_DRV:     1/    1   100%
    Info: 	      ICESTORM_SPRAM:     0/    4     0%
    Info: Max frequency for clock 'clk': 29.83 MHz (PASS at 12.00 MHz)

### Expand uCode Memory (4k uCode, no devices)

    Info: Device utilisation:
    Info: 	         ICESTORM_LC:   939/ 5280    17%
    Info: 	        ICESTORM_RAM:    16/   30    53%
    Info: 	               SB_IO:     8/   96     8%
    Info: 	               SB_GB:     7/    8    87%
    Info: 	        ICESTORM_PLL:     0/    1     0%
    Info: 	         SB_WARMBOOT:     0/    1     0%
    Info: 	        ICESTORM_DSP:     0/    8     0%
    Info: 	      ICESTORM_HFOSC:     0/    1     0%
    Info: 	      ICESTORM_LFOSC:     0/    1     0%
    Info: 	              SB_I2C:     0/    2     0%
    Info: 	              SB_SPI:     0/    2     0%
    Info: 	              IO_I3C:     0/    2     0%
    Info: 	         SB_LEDDA_IP:     0/    1     0%
    Info: 	         SB_RGBA_DRV:     1/    1   100%
    Info: 	      ICESTORM_SPRAM:     0/    4     0%
    Info: Max frequency for clock 'clk': 24.60 MHz (PASS at 12.00 MHz)

### UART Device Component (2k uCode)

    Info: Device utilisation:
    Info: 	         ICESTORM_LC:  1042/ 5280    19%
    Info: 	        ICESTORM_RAM:     8/   30    26%
    Info: 	               SB_IO:     8/   96     8%
    Info: 	               SB_GB:     7/    8    87%
    Info: 	        ICESTORM_PLL:     0/    1     0%
    Info: 	         SB_WARMBOOT:     0/    1     0%
    Info: 	        ICESTORM_DSP:     0/    8     0%
    Info: 	      ICESTORM_HFOSC:     0/    1     0%
    Info: 	      ICESTORM_LFOSC:     0/    1     0%
    Info: 	              SB_I2C:     0/    2     0%
    Info: 	              SB_SPI:     0/    2     0%
    Info: 	              IO_I3C:     0/    2     0%
    Info: 	         SB_LEDDA_IP:     0/    1     0%
    Info: 	         SB_RGBA_DRV:     1/    1   100%
    Info: 	      ICESTORM_SPRAM:     0/    4     0%
    Info: Max frequency for clock 'clk': 29.31 MHz (PASS at 12.00 MHz)

### uFork Quad-Memory Component (2k uCode)

    Info: Device utilisation:
    Info: 	         ICESTORM_LC:  1077/ 5280    20%
    Info: 	        ICESTORM_RAM:     8/   30    26%
    Info: 	               SB_IO:     8/   96     8%
    Info: 	               SB_GB:     8/    8   100%
    Info: 	        ICESTORM_PLL:     0/    1     0%
    Info: 	         SB_WARMBOOT:     0/    1     0%
    Info: 	        ICESTORM_DSP:     0/    8     0%
    Info: 	      ICESTORM_HFOSC:     0/    1     0%
    Info: 	      ICESTORM_LFOSC:     0/    1     0%
    Info: 	              SB_I2C:     0/    2     0%
    Info: 	              SB_SPI:     0/    2     0%
    Info: 	              IO_I3C:     0/    2     0%
    Info: 	         SB_LEDDA_IP:     0/    1     0%
    Info: 	         SB_RGBA_DRV:     1/    1   100%
    Info: 	      ICESTORM_SPRAM:     3/    4    75%
    Info: Max frequency for clock 'clk': 30.08 MHz (PASS at 12.00 MHz)

### uFork Quad-Memory Component (4k uCode)

    Info: Device utilisation:
    Info: 	         ICESTORM_LC:  1079/ 5280    20%
    Info: 	        ICESTORM_RAM:    16/   30    53%
    Info: 	               SB_IO:     8/   96     8%
    Info: 	               SB_GB:     8/    8   100%
    Info: 	        ICESTORM_PLL:     0/    1     0%
    Info: 	         SB_WARMBOOT:     0/    1     0%
    Info: 	        ICESTORM_DSP:     0/    8     0%
    Info: 	      ICESTORM_HFOSC:     0/    1     0%
    Info: 	      ICESTORM_LFOSC:     0/    1     0%
    Info: 	              SB_I2C:     0/    2     0%
    Info: 	              SB_SPI:     0/    2     0%
    Info: 	              IO_I3C:     0/    2     0%
    Info: 	         SB_LEDDA_IP:     0/    1     0%
    Info: 	         SB_RGBA_DRV:     1/    1   100%
    Info: 	      ICESTORM_SPRAM:     3/    4    75%
    Info: Max frequency for clock 'clk': 27.37 MHz (PASS at 12.00 MHz)

### Single-cycle Multiply w/ DSP block

    Info: Device utilisation:
    Info: 	         ICESTORM_LC:  1114/ 5280    21%
    Info: 	        ICESTORM_RAM:    16/   30    53%
    Info: 	               SB_IO:     8/   96     8%
    Info: 	               SB_GB:     8/    8   100%
    Info: 	        ICESTORM_PLL:     0/    1     0%
    Info: 	         SB_WARMBOOT:     0/    1     0%
    Info: 	        ICESTORM_DSP:     1/    8    12%
    Info: 	      ICESTORM_HFOSC:     0/    1     0%
    Info: 	      ICESTORM_LFOSC:     0/    1     0%
    Info: 	              SB_I2C:     0/    2     0%
    Info: 	              SB_SPI:     0/    2     0%
    Info: 	              IO_I3C:     0/    2     0%
    Info: 	         SB_LEDDA_IP:     0/    1     0%
    Info: 	         SB_RGBA_DRV:     1/    1   100%
    Info: 	      ICESTORM_SPRAM:     3/    4    75%
    Info: Max frequency for clock 'clk': 25.19 MHz (PASS at 12.00 MHz)

### Counting Loops Use R-stack Directly

    Info: Device utilisation:
    Info: 	         ICESTORM_LC:  1137/ 5280    21%
    Info: 	        ICESTORM_RAM:    16/   30    53%
    Info: 	               SB_IO:     8/   96     8%
    Info: 	               SB_GB:     8/    8   100%
    Info: 	        ICESTORM_PLL:     0/    1     0%
    Info: 	         SB_WARMBOOT:     0/    1     0%
    Info: 	        ICESTORM_DSP:     1/    8    12%
    Info: 	      ICESTORM_HFOSC:     0/    1     0%
    Info: 	      ICESTORM_LFOSC:     0/    1     0%
    Info: 	              SB_I2C:     0/    2     0%
    Info: 	              SB_SPI:     0/    2     0%
    Info: 	              IO_I3C:     0/    2     0%
    Info: 	         SB_LEDDA_IP:     0/    1     0%
    Info: 	         SB_RGBA_DRV:     1/    1   100%
    Info: 	      ICESTORM_SPRAM:     3/    4    75%
    Info: Max frequency for clock 'clk': 26.65 MHz (PASS at 12.00 MHz)

### 16-deep FIFOs for UART RX/TX

    Info: Device utilisation:
    Info: 	         ICESTORM_LC:  1627/ 5280    30%
    Info: 	        ICESTORM_RAM:    16/   30    53%
    Info: 	               SB_IO:     8/   96     8%
    Info: 	               SB_GB:     8/    8   100%
    Info: 	        ICESTORM_PLL:     0/    1     0%
    Info: 	         SB_WARMBOOT:     0/    1     0%
    Info: 	        ICESTORM_DSP:     1/    8    12%
    Info: 	      ICESTORM_HFOSC:     0/    1     0%
    Info: 	      ICESTORM_LFOSC:     0/    1     0%
    Info: 	              SB_I2C:     0/    2     0%
    Info: 	              SB_SPI:     0/    2     0%
    Info: 	              IO_I3C:     0/    2     0%
    Info: 	         SB_LEDDA_IP:     0/    1     0%
    Info: 	         SB_RGBA_DRV:     1/    1   100%
    Info: 	      ICESTORM_SPRAM:     3/    4    75%
    Info: Max frequency for clock 'clk': 25.76 MHz (PASS at 12.00 MHz)

### 256-deep BRAM FIFOs for UART

    Info: Device utilisation:
    Info: 	         ICESTORM_LC:  1216/ 5280    23%
    Info: 	        ICESTORM_RAM:    18/   30    60%
    Info: 	               SB_IO:     8/   96     8%
    Info: 	               SB_GB:     8/    8   100%
    Info: 	        ICESTORM_PLL:     0/    1     0%
    Info: 	         SB_WARMBOOT:     0/    1     0%
    Info: 	        ICESTORM_DSP:     1/    8    12%
    Info: 	      ICESTORM_HFOSC:     0/    1     0%
    Info: 	      ICESTORM_LFOSC:     0/    1     0%
    Info: 	              SB_I2C:     0/    2     0%
    Info: 	              SB_SPI:     0/    2     0%
    Info: 	              IO_I3C:     0/    2     0%
    Info: 	         SB_LEDDA_IP:     0/    1     0%
    Info: 	         SB_RGBA_DRV:     1/    1   100%
    Info: 	      ICESTORM_SPRAM:     3/    4    75%
    Info: Max frequency for clock 'clk': 26.33 MHz (PASS at 12.00 MHz)
