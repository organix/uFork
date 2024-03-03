/*

Test fixture for BRAM (fast on-chip block RAM)

    +-------------------+
    | bram_test         |
    |                   |
--->|i_run     o_running|--->
    |           o_passed|--->
    |                   |
 +->|i_clk              |
 |  +-------------------+

This component runs some tests on `bram.v`, producing a pass or fail result.
The test starts when `i_run` is asserted. `o_running` is asserted while the test is running.
Once `o_running` is de-asserted, the value of `o_passed` indicates success or failure.

*/

`default_nettype none

`include "bram.v"

module bram_test (
    input                   i_clk,                      // system clock
    input                   i_run,                      // start the test
    output                  o_running,                  // test in progress
    output reg              o_passed                    // final test result
);

    //
    // unit under test
    //

    bram BRAM (
        .i_clk(i_clk),

        .i_wr_en(wr),
        .i_waddr(waddr),
        .i_wdata(wdata),

        .i_rd_en(rd),
        .i_raddr(raddr),
        .o_rdata(actual)
    );

    //
    // test script
    //

    wire [15:0] actual;

    reg [3:0] state = 4'h1;                             // 4-bit state-machine
    localparam STOP = 4'h0;
    localparam DONE = 4'hF;

    reg [54:0] script [0:15];                           // script indexed by state
    initial begin    //    wr, waddr,    wdata,    rd, raddr,   expect,  cmp  next
        script[STOP] = { 1'b0, 8'h00, 16'h0000,  1'b0, 8'h00, 16'h0000, 1'b0, STOP };
        script[4'h1] = { 1'b0, 8'h00, 16'h0000,  1'b0, 8'h00, 16'h0000, 1'b0, 4'h2 };
        script[4'h2] = { 1'b1, 8'hFF, 16'hBE11,  1'b0, 8'h00, 16'h0000, 1'b0, 4'h3 };
        script[4'h3] = { 1'b1, 8'h95, 16'hC0DE,  1'b0, 8'h00, 16'h0000, 1'b0, 4'h4 };
        script[4'h4] = { 1'b0, 8'h00, 16'h0000,  1'b1, 8'hFF, 16'h0000, 1'b0, 4'h5 };
        script[4'h5] = { 1'b0, 8'h00, 16'h0000,  1'b1, 8'h95, 16'hBE11, 1'b1, 4'h6 };
        script[4'h6] = { 1'b0, 8'h00, 16'h0000,  1'b0, 8'h00, 16'hC0DE, 1'b1, 4'h7 };
        script[4'h7] = { 1'b1, 8'hFF, 16'hFADE,  1'b1, 8'h95, 16'h0000, 1'b0, 4'h8 };
        script[4'h8] = { 1'b0, 8'h00, 16'h0000,  1'b1, 8'hFF, 16'hC0DE, 1'b1, 4'h9 };
        script[4'h9] = { 1'b0, 8'h00, 16'h0000,  1'b0, 8'h00, 16'hFADE, 1'b1, 4'hA };
        script[4'hA] = { 1'b1, 8'hFF, 16'hDEAD,  1'b1, 8'hFF, 16'h0000, 1'b0, 4'hB };
        script[4'hB] = { 1'b0, 8'h00, 16'h0000,  1'b1, 8'hFF, 16'hFADE, 1'b1, 4'hC }; // read b4 write
//        script[4'hB] = { 1'b0, 8'h00, 16'h0000,  1'b1, 8'hFF, 16'hDEAD, 1'b1, 4'hC }; // write b4 read
        script[4'hC] = { 1'b0, 8'h00, 16'h0000,  1'b0, 8'h00, 16'hDEAD, 1'b1, 4'hD };
        script[4'hD] = { 1'b0, 8'h00, 16'h0000,  1'b0, 8'h00, 16'h0000, 1'b0, 4'hE };
        script[4'hE] = { 1'b0, 8'h00, 16'h0000,  1'b0, 8'h00, 16'h0000, 1'b0, 4'hF };
        script[DONE] = { 1'b0, 8'h00, 16'h0000,  1'b0, 8'h00, 16'h0000, 1'b0, STOP };
    end
    // inputs
    wire wr                 = script[state][54];
    wire [7:0] waddr        = script[state][53:46];
    wire [15:0] wdata       = script[state][45:30];
    wire rd                 = script[state][29];
    wire [7:0] raddr        = script[state][28:21];
    // outputs
    wire [15:0] expect      = script[state][20:5];
    wire cmp                = script[state][4];
    wire [3:0] next         = script[state][3:0];

    assign o_running = i_run && (state != STOP);
    initial o_passed = 1'b0;

    always @(posedge i_clk) begin
        if (o_running) begin
            if (state == DONE) begin
                // register success
                o_passed <= 1'b1;
            end
            state <= next;                              // default transition
            if (cmp) begin
                if (actual != expect) begin
                    state <= STOP;                      // stop (failed)
                end
            end
        end
    end

endmodule
