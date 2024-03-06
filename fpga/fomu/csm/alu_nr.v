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
    output reg  [WIDTH-1:0] o_data                      // result value (no FF!)
);

    // perform selected operation
    always @(*) begin                                   // combinational logic!
        case (i_op)
            `NO_OP: begin
                o_data = i_arg0;                        // pass-thru
            end
            `ADD_OP: begin
                o_data = i_arg0 + i_arg1;
            end
            `SUB_OP: begin
                o_data = i_arg0 - i_arg1;
            end
            /*
            `MUL_OP: begin
                o_data = i_arg0 * i_arg1;
            end
            */
            `AND_OP: begin
                o_data = i_arg0 & i_arg1;
            end
            `OR_OP: begin
                o_data = i_arg0 | i_arg1;
            end
            `XOR_OP: begin
                o_data = i_arg0 ^ i_arg1;
            end
            `ROL_OP: begin
                o_data = { i_arg0[WIDTH-2:0], i_arg0[WIDTH-1] };
            end
            default: begin                              // no operation
                o_data = 0;
            end
        endcase
    end

endmodule
