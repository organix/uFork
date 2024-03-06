/*

Test fixture for ALU

    +-------------------+
    | alu_test          |
    |                   |
--->|i_run     o_running|--->
    |           o_passed|--->
    |                   |
 +->|i_clk              |
 |  +-------------------+

This component runs some tests on `alu.v`, producing a pass or fail result.
The test starts when `i_run` is asserted. `o_running` is asserted while the test is running.
Once `o_running` is de-asserted, the value of `o_passed` indicates success or failure.

*/

`default_nettype none

`include "alu.v"
//`include "../lib/bram.v"                              // FIXME: move test script into BRAM...

module alu_test (
    input                   i_clk,                      // system clock
    input                   i_run,                      // start the test
    output                  o_running,                  // test in progress
    output reg              o_passed                    // final test result
);

    //
    // unit under test
    //

    alu #(
        .WIDTH(16)
    ) ALU (
        .i_clk(i_clk),

        .i_op(r_op),
        .i_arg0(r_arg0),
        .i_arg1(r_arg1),

        .o_data(data)
    );

    //
    // test script
    //

    wire [15:0] data;

    wire [3:0] op       = script[state][56:53];
    wire [15:0] arg0    = script[state][52:37];
    wire [15:0] arg1    = script[state][36:21];
    wire cmp            = script[state][20];
    wire [15:0] xpct    = script[state][19:4];
    wire [3:0] next     = script[state][3:0];

    reg [3:0] state = START;                            // 4-bit state-machine
    localparam START = 4'h0;
    localparam DONE = 4'hE;
    localparam STOP = 4'hF;
    reg [56:0] script [0:15];                           // script indexed by state
    initial begin
        //     op,     arg0,     arg1,    cmp,     xpct,  next
        script[START] =     // start state
        {  `NO_OP,    16'd0,    16'd0,   1'b0,    16'd0,  4'h1   };
        script[4'h1] =      // no-op
        {  `NO_OP,    16'd0,    16'd0,   1'b0,    16'd0,  4'h2  };
        script[4'h2] =      // add(5, 8) == 13
        { `ADD_OP,    16'd5,    16'd8,   1'b1,   16'd13,  4'h3  };
        script[4'h3] =      // sub(8, 13) == -5
        { `SUB_OP,    16'd8,   16'd13,   1'b1,   -16'd5,  4'h5  };  // skip MUL test
        script[4'h4] =      // mul(8, 13) == 104
        { `MUL_OP,   16'd13,    16'd8,   1'b1,  16'd104,  4'h5  };
        script[4'h5] =      // and(2#1100, 2#1010) == 2#1000
        { `AND_OP, 16'hCCAA, 16'hAACC,   1'b1, 16'h8888,  4'h6  };
        script[4'h6] =      // xor(2#1100, 2#1010) == 2#0110
        { `XOR_OP, 16'hCACA, 16'hACAC,   1'b1, 16'h6666,  4'h7  };
        script[4'h7] =      // rol(2#1001_1010) == 2#0011_0101)
        {  `OR_OP, 16'hAACC, 16'hCCAA,   1'b1, 16'hEEEE,  4'h8  };
        script[4'h8] =      // xor(2#1100, 2#1010) == 2#0110
        { `ROL_OP, 16'h9A9A, 16'hDEAD,   1'b1, 16'h3535,  DONE  };
        script[4'h9] =      // no-op
        {  `NO_OP,    16'd0,    16'd0,   1'b0,    16'd0,  4'hA  };
        script[4'hA] =      // no-op
        {  `NO_OP,    16'd0,    16'd0,   1'b0,    16'd0,  4'hB  };
        script[4'hB] =      // no-op
        {  `NO_OP,    16'd0,    16'd0,   1'b0,    16'd0,  4'hC   };
        script[4'hC] =      // no-op
        {  `NO_OP,    16'd0,    16'd0,   1'b0,    16'd0,  4'hD  };
        script[4'hD] =      // done
        {  `NO_OP,    16'd0,    16'd0,   1'b0,    16'd0,  DONE   };
        script[DONE] =      // done state (success)
        {  `NO_OP,    16'd0,    16'd0,   1'b0,    16'd0,  STOP   };
        script[STOP] =      // stop state (looping)
        {  `NO_OP,    16'd0,    16'd0,   1'b0,    16'd0,  STOP   };
    end

    reg [3:0] r_op = `NO_OP;
    reg [15:0] r_arg0;
    reg [15:0] r_arg1;
    reg r_cmp = 0;
    reg [15:0] r_xpct;
    reg [3:0] r_next;

    assign o_running = i_run && (state != STOP);

    reg [1:0] phase = 0;
    always @(posedge i_clk) begin
        if (o_running) begin
            phase <= phase + 1'b1;
        end
    end

    always @(posedge i_clk) begin
        if (phase == 1) begin
            // register test-case values
            r_op <= op;
            r_arg0 <= arg0;
            r_arg1 <= arg1;
            r_cmp <= cmp;
            r_xpct <= xpct;
            r_next <= next;
        end else if (phase == 2) begin
            // wait for result value
        end else if (phase == 3) begin
            if (r_cmp) begin
                if (data != r_xpct) begin
                    o_passed <= 1'b0;                   // register failure
                end
            end
            state <= r_next;
        end
    end

    initial o_passed = 1'b1;                            // default to success

endmodule
