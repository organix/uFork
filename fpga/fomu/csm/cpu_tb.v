/*

Test Bench for cpu.v

*/

`default_nettype none

`include "cpu.v"

`timescale 10ns/1ns

module test_bench;

    // dump simulation signals
    initial begin
        $dumpfile("cpu.vcd");
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

    // instantiate CPU
    wire running;
    wire passed;
//    wire rx = 1'b1;                                     // serial idle-state is high
    wire rx = tx;                                       // loop-back from transmitter
    wire tx;
    cpu CPU (
        .i_clk(clk),
        .i_run(!waiting),
        .i_rx(rx),
        .o_tx(tx),
        .o_running(running),
        .o_status(passed)
    );

endmodule
