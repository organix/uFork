/*

Operation Encoding for ALU

*/

`ifndef _alu_ops_
`define _alu_ops_

`define NO_OP       (4'h0)  // a
`define ADD_OP      (4'h1)  // a+b
`define SUB_OP      (4'h2)  // a-b
`define MUL_OP      (4'h3)  // a*b
`define AND_OP      (4'h4)  // a&b
`define XOR_OP      (4'h5)  // a^b
`define OR_OP       (4'h6)  // a|b
`define ROL_OP      (4'h7)  // {a[14:0],a[15]}
`define FETCH_OP    (4'hE)  // @
`define STORE_OP    (4'hF)  // !

`endif
