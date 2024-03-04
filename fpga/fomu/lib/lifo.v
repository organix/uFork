/*

LIFO (stack)

    +---------------+
    | lifo          |
    |               |
=W=>|i_data     o_s0|=W=>
--->|i_push     o_s1|=W=>
--->|i_pop          |
    |               |
 +->|i_clk          |
 |  +---------------+

This component manages a last-in/first-out (LIFO) stack.
A "push" request adds `i_data` to the top of stack (s0),
moving previous elements down (e.g.: s0 -> s1).
A "pop" request removes the top element (s0) from the stack,
moving previous elements up (e.g.: s1 -> s0).
If both "push" and "pop" are requested together,
the top of stack (s0) is replaced by `i_data`.

*/

`default_nettype none

module lifo #(
    parameter WIDTH         = 8,                        // bits per element
//    parameter DEPTH         = 8                         // number of elements (hard-coded at 8)
    parameter DEPTH         = 12                        // number of elements (hard-coded at 12)
) (
    input                   i_clk,                      // system clock
    input       [WIDTH-1:0] i_data,                     // new data value
    input                   i_push,                     // "push" request
    input                   i_pop,                      // "pop" request
    output reg  [WIDTH-1:0] o_s0,                       // top-of-stack value
    output reg  [WIDTH-1:0] o_s1                        // next-on-stack value
);

    // deeper stack elements
    reg [WIDTH-1:0] o_s2;
    reg [WIDTH-1:0] o_s3;
    reg [WIDTH-1:0] o_s4;
    reg [WIDTH-1:0] o_s5;
    reg [WIDTH-1:0] o_s6;
    reg [WIDTH-1:0] o_s7;
    /*
    */
    reg [WIDTH-1:0] o_s8;
    reg [WIDTH-1:0] o_s9;
    reg [WIDTH-1:0] o_s10;
    reg [WIDTH-1:0] o_s11;

    // stack operations
    always @(posedge i_clk) begin
        case ({i_push, i_pop})
            {1'b1, 1'b1}: begin                         // replace data at top-of-stack
                o_s0 <= i_data;
            end
            {1'b1, 1'b0}: begin                         // add data to top-of-stack
                o_s0 <= i_data;
                o_s1 <= o_s0;
                o_s2 <= o_s1;
                o_s3 <= o_s2;
                o_s4 <= o_s3;
                o_s5 <= o_s4;
                o_s6 <= o_s5;
                o_s7 <= o_s6;
                /*
                */
                o_s8 <= o_s7;
                o_s9 <= o_s8;
                o_s10 <= o_s9;
                o_s11 <= o_s10;
            end
            {1'b0, 1'b1}: begin                         // remove top-of-stack
                o_s0 <= o_s1;
                o_s1 <= o_s2;
                o_s2 <= o_s3;
                o_s3 <= o_s4;
                o_s4 <= o_s5;
                o_s5 <= o_s6;
                o_s6 <= o_s7;
                /*
                */
                o_s7 <= o_s8;
                o_s8 <= o_s9;
                o_s9 <= o_s10;
                o_s10 <= o_s11;
            end
            default: begin                              // no operation
                // nothing changes
            end
        endcase
    end

endmodule
