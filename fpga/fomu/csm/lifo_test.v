/*

Test fixture for LIFO (stack)

    +-------------------+
    | lifo_test         |
    |                   |
--->|i_run     o_running|--->
    |           o_passed|--->
    |                   |
 +->|i_clk              |
 |  +-------------------+

This component runs some tests on `lifo.v`, producing a pass or fail result.
The test starts when `i_run` is asserted. `o_running` is asserted while the test is running.
Once `o_running` is de-asserted, the value of `o_passed` indicates success or failure.

*/

`default_nettype none

`include "lifo.v"

module lifo_test (
    input                   i_clk,                      // system clock
    input                   i_run,                      // start the test
    output                  o_running,                  // test in progress
    output reg              o_passed                    // final test result
);

    //
    // unit under test
    //

    lifo #(
        .WIDTH(16)
    ) LIFO (
        .i_clk(i_clk),

        .i_data(data),
        .i_push(push),
        .i_pop(pop),
        .i_swap(swap),

        .o_s0(s0),
        .o_s1(s1)
    );

    //
    // test script
    //

    wire [15:0] s0;
    wire [15:0] s1;

    wire [15:0] data    = script[state][57:42];
    wire push           = script[state][41];
    wire pop            = script[state][40];
    wire swap           = script[state][39];
    wire s0cmp          = script[state][38];
    wire [15:0] s0xpct  = script[state][37:22];
    wire s1cmp          = script[state][21];
    wire [15:0] s1xpct  = script[state][20:5];
    wire [4:0] next     = script[state][4:0];

    reg [4:0] state = 5'h01;                            // 5-bit state-machine
    localparam STOP = 5'h00;
    localparam LOOP = 5'h0F;
    localparam DONE = 5'h1F;
    reg [57:0] script [0:31];                           // script indexed by state
    initial begin
        //  data,   push,    pop,   swap,  s0cmp,  s0xpct, s1cmp,  s1xpct,  next
        script[STOP]  =     // stop state (looping)
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  STOP    };
        script[5'h01] =     // start state
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  5'h02   };
        script[5'h02] =     // push(13)
        {  16'd13,  1'b1,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  5'h03   };
        script[5'h03] =     // assert(tos == 13)
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b1,  16'd13,  1'b0,   16'd0,  5'h04   };
        script[5'h04] =     // push(21)
        {  16'd21,  1'b1,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  5'h05   };
        script[5'h05] =     // assert(tos == 21); assert(nos == 13)
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b1,  16'd21,  1'b1,  16'd13,  5'h06   };
        script[5'h06] =     // pop()
        {   16'd0,  1'b0,   1'b1,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  5'h07   };
        script[5'h07] =     // assert(tos == 13)
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b1,  16'd13,  1'b0,   16'd0,  5'h08   };
        script[5'h08] =     // pop(); push(34)
        {  16'd34,  1'b1,   1'b1,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  5'h09   };
        script[5'h09] =     // assert(tos == 34)
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b1,  16'd34,  1'b0,   16'd0,  5'h10   };

        script[5'h0A] =     // push(55)
        {  16'd55,  1'b1,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  5'h0B   };
        script[5'h0B] =     // push(89); assert(tos == 55); assert(nos == 34)
        {  16'd89,  1'b1,   1'b0,   1'b0,   1'b1,  16'd55,  1'b1,  16'd34,  5'h0C   };
        script[5'h0C] =     // pop(); assert(tos == 89); assert(nos == 55)
        {   16'd0,  1'b0,   1'b1,   1'b0,   1'b1,  16'd89,  1'b1,  16'd55,  5'h0D   };
        script[5'h0D] =     // pop(); assert(tos == 55); assert(nos == 34)
        {   16'd0,  1'b0,   1'b1,   1'b0,   1'b1,  16'd55,  1'b1,  16'd34,  5'h0E   };
        script[5'h0E] =     // assert(tos == 34)
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b1,  16'd34,  1'b0,   16'd0,  DONE    };
        script[LOOP]  =     // no-op (loop forever...)
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  LOOP    };

        script[5'h10] =     // push(55)
        {  16'd55,  1'b1,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  5'h11   };
        script[5'h11] =     // push(89); assert(tos == 55); assert(nos == 34)
        {  16'd89,  1'b1,   1'b0,   1'b0,   1'b1,  16'd55,  1'b1,  16'd34,  5'h12   };
        script[5'h12] =     // swap(); assert(tos == 89); assert(nos == 55)
        {   16'd0,  1'b0,   1'b0,   1'b1,   1'b1,  16'd89,  1'b1,  16'd55,  5'h13   };
        script[5'h13] =     // pop(); assert(tos == 55); assert(nos == 89)
        {   16'd0,  1'b0,   1'b1,   1'b0,   1'b1,  16'd55,  1'b1,  16'd89,  5'h14   };
        script[5'h14] =     // pop(); assert(tos == 89); assert(nos == 34)
        {   16'd0,  1'b0,   1'b1,   1'b0,   1'b1,  16'd89,  1'b1,  16'd34,  5'h15   };
        script[5'h15] =     // assert(tos == 34)
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b1,  16'd34,  1'b0,   16'd0,  DONE    };

        script[5'h16] =     // no-op
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  STOP    };
        script[5'h17] =     // no-op
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  STOP    };
        script[5'h18] =     // no-op
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  STOP    };
        script[5'h19] =     // no-op
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  STOP    };
        script[5'h1A] =     // no-op
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  STOP    };
        script[5'h1B] =     // no-op
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  STOP    };
        script[5'h1C] =     // no-op
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  STOP    };
        script[5'h1D] =     // no-op
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  STOP    };
        script[5'h1E] =     // no-op
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  STOP    };
        script[DONE]  =     // done state (success)
        {   16'd0,  1'b0,   1'b0,   1'b0,   1'b0,   16'd0,  1'b0,   16'd0,  STOP    };
    end

    assign o_running = i_run && (state != STOP);
    initial o_passed = 1'b0;

    always @(posedge i_clk) begin
        if (o_running) begin
            if (state == DONE) begin
                o_passed <= 1'b1;                       // register success
            end
            state <= next;                              // default transition
            if (s0cmp) begin
                if (s0 != s0xpct) begin
                    state <= STOP;                      // stop (s0 mismatch)
                end
            end
            if (s1cmp) begin
                if (s1 != s1xpct) begin
                    state <= STOP;                      // stop (s1 mismatch)
                end
            end
        end
    end

endmodule
