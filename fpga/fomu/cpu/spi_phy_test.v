/*

Test fixture for SPI physical layer

    +-------------------+
    | spi_phy_test      |
    |                   |
--->|i_run     o_running|--->
    |           o_passed|--->
    |                   |
 +->|i_clk              |
 |  +-------------------+

This component runs some tests on `spi_phy.v`, producing a pass or fail result.
The test starts when `i_run` is asserted. `o_running` is asserted while the test is running.
Once `o_running` is de-asserted, the value of `o_passed` indicates success or failure.

*/

`default_nettype none

`include "spi_phy.v"

module spi_phy_test (
    input                   i_clk,                      // system clock
    input                   i_run,                      // start the test
    output                  o_running,                  // test in progress
    output reg              o_passed                    // final test result
);
    localparam WIDTH = 8;

    //
    // unit under test
    //

    spi_phy #(
        .WIDTH(WIDTH)
    ) SPI (
        .i_clk(i_clk),

//        .s_cs(cs),
        .s_clk(sclk),
        .s_copi(copi),
        .s_cipo(cipo),

        .i_wr(wr),
        .i_wdata(wdata),
        .o_bsy(bsy),
        .o_rdata(rdata)
    );

    reg cs = 1'b1;
    wire sclk;
    wire copi;
    wire cipo = !cs && !copi;

    reg wr = 1'b0;
    reg [WIDTH-1:0] wdata = 0;
    wire bsy;
    wire [WIDTH-1:0] rdata;

    //
    // test sequencer
    //

    localparam DONE = 8'hFF;

    initial o_passed = 1'b1;                            // assume success
    assign o_running = i_run && o_passed && (step != DONE);

    reg [7:0] step = 0;
    always @(posedge i_clk) begin
        if (o_running) begin
            step <= step + 1'b1;
        end
    end

    //
    // test script
    //

    always @(posedge i_clk) begin
        if (o_running) begin
            if (step == 8'hFF) begin
                o_passed <= 1'b0;                       // register failure
            end else if (step == 8'h03) begin
                cs <= 1'b0;
            end else if (step == 8'h05) begin
                wdata <= 8'b10011011;
                wr <= 1'b1;
            end else if (step == 8'h06) begin
                wr <= 1'b0;
            end else if (step == 8'h07) begin
                /*
                */
                if (!bsy) begin
                    o_passed <= 1'b0;                   // register failure
                end
            end else if (step == 8'h17) begin
                /*
                */
                if (bsy) begin
                    o_passed <= 1'b0;                   // register failure
                end
            end else if (step == 8'h1C) begin
                /*
                */
                if (rdata != 8'b01100100) begin
                    o_passed <= 1'b0;                   // register failure
                end
            end else if (step == 8'h20) begin
                wdata <= 8'b01010011;
                wr <= 1'b1;
            end else if (step == 8'h21) begin
                wr <= 1'b0;
            end else if (step == 8'h33) begin
                /*
                */
                if (bsy || rdata != 8'b10101100) begin
                    o_passed <= 1'b0;                   // register failure
                end
            end else if (step == 8'h36) begin
                cs <= 1'b1;
            end
        end
    end

endmodule
