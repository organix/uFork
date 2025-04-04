/*

Test Bench for lifo_se.v

*/

`default_nettype none

`include "lifo_se_test.v"

`timescale 10ns/1ns

module test_bench;

    // dump simulation signals
    initial begin
        $dumpfile("lifo_se.vcd");
        $dumpvars(0, test_bench);
        #200;
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
    lifo_se_test TEST (
        .i_clk(clk),
        .i_run(!waiting),
        .o_running(running),
        .o_passed(passed)
    );

endmodule
