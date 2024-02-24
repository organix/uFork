/*

Test fixture for LIFO (stack)

    +-------------------+
    | lifo8x8_test      |
    |                   |
--->|i_run     o_running|--->
    |           o_passed|--->
    |                   |
 +->|i_clk              |
 |  +-------------------+

This component runs some tests on `lifo8x8.v`, producing a pass or fail result.
The test starts when `i_run` is asserted. `o_running` is asserted while the test is running.
Once `o_running` is de-asserted, the value of `o_passed` indicates success or failure.

*/

`default_nettype none

`include "lifo8x8.v"

module lifo8x8_test (
    input                       i_clk,                          // system clock
    input                       i_run,                          // start the test
    output                      o_running,                      // test in progress
    output reg                  o_passed                        // final test result
);

    //
    // unit under test
    //

    lifo8x8 #(
        .WIDTH(8)
    ) LIFO (
        .i_clk(i_clk),

        .i_data(data),
        .i_push(push),
        .i_pop(pop),

        .o_s0(s0),
        .o_s1(s1)
    );

    //
    // test script
    //

    wire [7:0] s0;
    wire [7:0] s1;

    wire [7:0] data     = script[state][32:25];
    wire push           = script[state][24];
    wire pop            = script[state][23];
    wire s0cmp          = script[state][22];
    wire [7:0] s0xpct   = script[state][21:14];
    wire s1cmp          = script[state][13];
    wire [7:0] s1xpct   = script[state][12:5];
    wire [4:0] next     = script[state][4:0];

    reg [4:0] state = 5'h01;  // 5-bit state-machine
    localparam STOP = 5'h00;
    localparam LOOP = 5'h0F;
    localparam DONE = 5'h1F;
    reg [122:0] script [0:31];  // script indexed by state
    initial begin
        //  data,   push,    pop,  s0cmp,  s0xpct, s1cmp,  s1xpct,  next
        script[STOP]  =  // stop state (looping)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h01] =  // start state
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  5'h02   };
        script[5'h02] =  // push(13)
        {   8'd13,  1'b1,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  5'h03   };
        script[5'h03] =  // assert(tos == 13)
        {   8'h00,  1'b0,   1'b0,   1'b1,   8'd13,  1'b0,   8'h00,  5'h04   };
        script[5'h04] =  // push(21)
        {   8'd21,  1'b1,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  5'h05   };
        script[5'h05] =  // assert(tos == 21); assert(nos == 13)
        {   8'h00,  1'b0,   1'b0,   1'b1,   8'd21,  1'b1,   8'd13,  5'h06   };
        script[5'h06] =  // pop()
        {   8'h00,  1'b0,   1'b1,   1'b0,   8'h00,  1'b0,   8'h00,  5'h07   };
        script[5'h07] =  // assert(tos == 13)
        {   8'h00,  1'b0,   1'b0,   1'b1,   8'd13,  1'b0,   8'h00,  5'h08   };
        script[5'h08] =  // pop(); push(34)
        {   8'd34,  1'b1,   1'b1,   1'b0,   8'h00,  1'b0,   8'h00,  5'h09   };
        script[5'h09] =  // assert(tos == 34)
        {   8'h00,  1'b0,   1'b0,   1'b1,   8'd34,  1'b0,   8'h00,  5'h0A   };
        script[5'h0A] =  // push(55)
        {   8'd55,  1'b1,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  5'h0B   };
        script[5'h0B] =  // push(89); assert(tos == 55); assert(nos == 34)
        {   8'd89,  1'b1,   1'b0,   1'b1,   8'd55,  1'b1,   8'd34,  5'h0C   };
        script[5'h0C] =  // pop(); assert(tos == 89); assert(nos == 55)
        {   8'h00,  1'b0,   1'b1,   1'b1,   8'd89,  1'b1,   8'd55,  5'h0D   };
        script[5'h0D] =  // pop(); assert(tos == 55); assert(nos == 34)
        {   8'h00,  1'b0,   1'b1,   1'b1,   8'd55,  1'b1,   8'd34,  5'h0E   };
        script[5'h0E] =  // assert(tos == 34)
        {   8'h00,  1'b0,   1'b0,   1'b1,   8'd34,  1'b0,   8'd00,  DONE    };
        script[LOOP]  =  // no-op (loop forever...)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  LOOP    };
        script[5'h10] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h11] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h12] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h13] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h14] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h15] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h16] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h17] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h18] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h19] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h1A] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h1B] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h1C] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h1D] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h1E] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[DONE]  =  // done state (success)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
    end

    assign o_running = i_run && (state != STOP);
    initial o_passed = 1'b0;

    always @(posedge i_clk) begin
        if (o_running) begin
            if (state == DONE) begin
                o_passed <= 1'b1;                               // register success
            end
            state <= next;                                      // default transition
            if (s0cmp) begin
                if (s0 != s0xpct) begin
                    state <= STOP;                              // stop (s0 mismatch)
                end
            end
            if (s1cmp) begin
                if (s1 != s1xpct) begin
                    state <= STOP;                              // stop (s1 mismatch)
                end
            end
        end
    end

endmodule
