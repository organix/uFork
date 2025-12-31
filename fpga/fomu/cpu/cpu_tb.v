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
        #2000;
        $finish;
    end

    // generate chip clock (50MHz simulation time)
    reg clki = 0;
    always begin
        #1 clki = !clki;
    end

    // connect system clock
    reg [1:0] clk_div = 2'b00;
    always @(posedge clki) begin
        clk_div <= clk_div + 1'b1;
    end
    wire clk = clk_div[1];

    // start-up delay
    reg [5:0] waiting;
    initial waiting = 3;                                // wait for device initialization
    always @(posedge clk) begin
        if (waiting) begin
            waiting <= waiting - 1'b1;
        end
    end

    // feed COPI back into CIPO (delayed & inverted)
    wire cs;
    wire copi;
    reg cipo = 1'b0;
    wire sclk;
    always @(posedge clk) begin
        cipo <= !cs && !copi;
    end

    // instantiate CPU
    wire running;
    wire passed;
//    wire rx = 1'b1;                                     // serial idle-state is high
    wire rx = tx;                                       // loop-back from transmitter
    wire tx;
    wire dp_rx = 1'b1;                                  // USB full-speed Idle (J)
    wire dn_rx = 1'b0;                                  // USB full-speed Idle (J)
    wire dp_pu;
    wire tx_en;
    wire dp_tx;
    wire dn_tx;
    cpu CPU (
        .i_clk_12(clk),
        .i_run(!waiting),
        .i_rx(rx),
        .o_tx(tx),
        .o_cs(cs),
        .o_copi(copi),
        .i_cipo(cipo),
        .o_sclk(sclk),
        .o_running(running),
        .o_status(passed),

        .i_clk_48(clki),
        .i_dp_rx(dp_rx),
        .i_dn_rx(dn_rx),
        .o_dp_pu(dp_pu),
        .o_tx_en(tx_en),
        .o_dp_tx(dp_tx),
        .o_dn_tx(dn_tx)
    );

endmodule
