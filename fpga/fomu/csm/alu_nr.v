/*

Arithmetic/Logical Unit (ALU) w/ non-registered output

    +---------------+
    | alu           |
    |               |
-4->|i_op     o_data|=W=>
=W=>|i_arg0         |
=W=>|i_arg1         |
    |               |
 +->|i_clk          |
 |  +---------------+

This component performs
an arithmetic or logical operation
on an ordered-pair of arguments.
The operation is selected by `i_op`,
and the result appears on `o_data`.

*/

`default_nettype none

`include "alu_ops.vh"

module alu #(
    parameter WIDTH         = 8                         // bits per element
) (
    input                   i_clk,                      // system clock
    input             [3:0] i_op,                       // operation selector
    input       [WIDTH-1:0] i_arg0,                     // argument 0
    input       [WIDTH-1:0] i_arg1,                     // argument 1
    output      [WIDTH-1:0] o_data                      // result value
);

    // perform selected operation
    assign o_data = (
        i_op == `NO_OP ? i_arg0                         // pass-thru
        : i_op == `ADD_OP ? i_arg0 + i_arg1
        : i_op == `SUB_OP ? i_arg0 - i_arg1
        // : i_op == `MUL_OP ? i_arg0 * i_arg1
        : i_op == `AND_OP ? i_arg0 & i_arg1
        : i_op == `OR_OP ? i_arg0 | i_arg1
        : i_op == `XOR_OP ? i_arg0 ^ i_arg1
        : i_op == `ROL_OP ? { i_arg0[WIDTH-2:0], i_arg0[WIDTH-1] }
        : 0                                             // no operation
    );

endmodule
