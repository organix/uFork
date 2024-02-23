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
        script[5'h02] =  // ram[^50FF] <= $BE11
        {   8'hD5,  1'b1,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  5'h03   };
        script[5'h03] =  // ram[^5095] <= $C0DE
        {   8'h00,  1'b0,   1'b1,   1'b1,   8'hD5,  1'b0,   8'h00,  LOOP    };
        script[5'h04] =  // rdata <= ram[^50FF]
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h05] =  // assert(rdata == $BE11); rdata <= ram[^5095]
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h06] =  // assert(rdata == $C0DE)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h07] =  // rdata <= ram[^50FF]; ram[^5034] <= $D05E
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h08] =  // assert(rdata == $BE11)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h09] =  // rdata <= ram[^5034]; ram[^5034] <= $EA5E
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h0A] =  // assert(rdata == $EA5E) --- read before write
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h0B] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h0C] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h0D] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h0E] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[LOOP]  =  // no-op (loop forever...)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  LOOP    };
        script[5'h10] =  // aaddr <= alloc($FADE)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h11] =  // assert(aaddr == ^5000); aaddr <= alloc($AB1E)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h12] =  // assert(aaddr == ^5001); aaddr <= alloc($B055)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h13] =  // assert(aaddr == ^5002)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h14] =  // aaddr <= alloc($CE11); free(^5001)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h15] =  // assert(aaddr == ^5001); free(^5002)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h16] =  // free(^5001)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h17] =  // aaddr <= alloc($DEAF)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h18] =  // assert(aaddr == ^5001); aaddr <= alloc($E15E)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h19] =  // assert(aaddr == ^5002); aaddr <= alloc($F001)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h1A] =  // assert(aaddr == ^5003)
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h1B] =  // no-op
        {   8'h00,  1'b0,   1'b0,   1'b0,   8'h00,  1'b0,   8'h00,  STOP    };
        script[5'h1C] =  // assert(aaddr == ^5002)
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
