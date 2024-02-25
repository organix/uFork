/*

Arithmetic/Logical Unit (ALU)

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

NOTE: `o_data` is _not_ registered.

*/

`default_nettype none

module alu #(
    parameter WIDTH             = 8                             // bits per element
) (
    input                       i_clk,                          // system clock
    input                 [3:0] i_op,                           // operation selector
    input           [WIDTH-1:0] i_arg0,                         // argument 0
    input           [WIDTH-1:0] i_arg1,                         // argument 1
    output reg      [WIDTH-1:0] o_data                          // result value
);

    initial o_data = 0;

    // enumerated values i_op
    localparam NO_OP            = 4'h0;                         // i_arg0 -> o_data
    localparam ADD              = 4'h1;                         // i_arg0 + i_arg1 -> o_data
    localparam SUB              = 4'h2;                         // i_arg0 - i_arg1 -> o_data
    localparam AND              = 4'h4;                         // i_arg0 & i_arg1 -> o_data
    localparam OR               = 4'h5;                         // i_arg0 | i_arg1 -> o_data
    localparam XOR              = 4'h6;                         // i_arg0 ^ i_arg1 -> o_data
    localparam ROL              = 4'h8;                         // i_arg0 <<> 1 -> o_data

    // perform selected operation
    always @(posedge i_clk) begin
        case (i_op)
            ADD: begin
                o_data <= i_arg0 + i_arg1;
            end
            SUB: begin
                o_data <= i_arg0 - i_arg1;
            end
            AND: begin
                o_data <= i_arg0 & i_arg1;
            end
            OR: begin
                o_data <= i_arg0 | i_arg1;
            end
            XOR: begin
                o_data <= i_arg0 ^ i_arg1;
            end
            ROL: begin
                o_data <= { i_arg0[WIDTH-2:0], i_arg0[WIDTH-1] };
            end
            default: begin
                o_data <= i_arg0;                               // no operation
            end
        endcase
    end

endmodule
