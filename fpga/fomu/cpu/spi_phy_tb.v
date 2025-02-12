/*

Test Bench for spi_phy.v

*/

`default_nettype none

`include "spi_phy_test.v"

`timescale 100ns/10ns

module test_bench;

    // dump simulation signals
    initial begin
        $dumpfile("spi_phy.vcd");
        $dumpvars(0, test_bench);
        #520;
        $finish;
    end

    // generate chip clock (50MHz simulation time)
    reg clk = 0;
    always begin
        #1 clk = !clk;
    end

    // start-up delay
    reg [5:0] waiting;
    initial waiting = 3;                                // wait for device initialization
    always @(posedge clk) begin
        if (waiting) begin
            waiting <= waiting - 1'b1;
        end
    end

    // instantiate test fixture
    wire running;
    wire passed;
    spi_phy_test TEST (
        .i_clk(clk),
        .i_run(!waiting),
        .o_running(running),
        .o_passed(passed)
    );

endmodule
