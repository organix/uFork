Instruction set, subject to change.

TBD: use a similiar unencoded instructions to what excamer J1 and Harris RTX2010?

Machine word (cell) size is 16 bits.

| Opcode | Name  | Stack image            | Description  |
| ------ | ----- | ---------------------- | ------------ |
| 0x0000 | NOP   | ( -- )                 | No operation |
| 0x0001 | UM+   | ( a b -- sum carry )   | Add TOS and NOS together |
| 0x0002 | AND   | ( a b -- a&b )         | Bitwise AND TOS and NOS |
| 0x0003 | XOR   | ( a b -- a^b )         | Bitwise XOR TOS and NOS |
| 0x0004 | 1LBR  | ( a -- (a[14:0] or a[15] ) | 1 bit Left Bit Rotate TOS |
| 0x0005 | INCR  | ( a -- a+1 )           | Bump TOS up one |
| 0x0006 | FETCH | ( addr -- cell )       | Fetch from microcode program memory |
| 0x0007 | STORE | ( cell addr -- )       | Store to microcode program memory |
| 0x0008 | DUP   | ( a -- a a )           | Duplicate TOS |
| 0x0009 | DROP  | ( a -- )               | Drop TOS |
| 0x000A | SWAP  | ( a b -- b a )         | Swap TOS ans NOS |
| 0x000B | SKZ   | ( cond -- )            | SKip next instruction if Zero TOS is |
| 0x000C | TO_R  | ( a -- ) R:( -- a )    | TOS pushed onto Return Stack |
| 0x000D | R_FROM | ( -- a ) R:( a -- )   | TOS popped from Return Stack |
| 0x000E | ext   | ( ... extnr -- )       | reserved, not implemented |
| 0x000F | EXIT  | ( -- ) R:( raddr -- )  | PC=raddr  Exit subroutine |
| 0x0010 | qt@   | ( qaddr -- qcell )     | fetch T field of quad at qaddr |
| 0x0011 | qx@   | ( qaddr -- qcell )     | fetch X field of quad at qaddr |
| 0x0012 | qy@   | ( qaddr -- qcell )     | fetch Y field of quad at qaddr |
| 0x0013 | qz@   | ( qaddr -- qcell )     | fetch Z field of quad at qaddr |
| 0x0014 | qt!   | ( qcell qaddr -- )     | store into T field of quad at qaddr |
| 0x0015 | qx!   | ( qcell qaddr -- )     | store into X field of quad at qaddr |
| 0x0016 | qy!   | ( qcell qaddr -- )     | store into Y field of quad at qaddr |
| 0x0017 | qz!   | ( qcell qaddr -- )     | store into Z field of quad at qaddr |
| 0x0018 | qalloc | ( -- qaddr )          | get a quad from the hardware implemented allocator |
| 0x0019 | qfree  | ( qaddr -- )          | free up a quad and give it back to the hardware implemented allocator |
| 0x001A | qgcstep | ( -- )               | crank the garbage collector of the hardware implemented allocator one step |
| 0x001B-3C |     | reserved              | |
| 0x003D | debug_rx? | ( -- char T \| F ) | |
| 0x003E | debug_tx? | ( -- ready_flag )  | |
| 0x003F | debug_tx! | ( char -- )        | |
| 0x____ | call      | ( -- ) R:( -- pc ) | pc=INSTR  call subroutine |

If the first 10 bits of an instruction are zero then it is an primitive instruction otherwise it is a call to that address. That is the instruction is the new program counter value.

.
