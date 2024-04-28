/*

Test Bench for fifo.v

*/

`default_nettype none

`include "fifo.v"

`timescale 10ns/1ns

module test_bench;

    // dump simulation signals
    initial begin
        $dumpfile("fifo.vcd");
        $dumpvars(0, test_bench);
        #1200;
        $finish;
    end

    // generate chip clock (50MHz simulation time)
    reg clk = 0;
    always begin
        #1 clk = !clk;
    end

    // instantiate fifo
    fifo #(
        .ADDR_SZ(3)
    ) FIFO (
        .i_clk(clk),
        .i_wr(wr),
        .i_data(c_in),
        .o_full(full),
        .i_rd(rd),
        .o_data(out),
        .o_empty(empty)
    );

    // fifo signals
    wire wr;
    wire full;
    wire rd;
    wire [7:0] out;
    wire empty;

//  assign wr = 1'b1;  // write anytime the fifo has room
    assign wr = phase[0];  // write more slowly
//  assign rd = 1'b1;  // read anytime the fifo has data
    assign rd = phase==2;  // read more slowly

    // 4-phase counter to pace read/write
    reg [1:0] phase;
    initial phase = 0;
    always @(posedge clk) begin
        phase <= phase + 1'b1;
    end

    // input writer
    reg [7:0] c_in;
    initial c_in = 8'h40;  // start with '@' character
    always @(posedge clk) begin
        if (wr) begin
            c_in <= c_in + 1'b1;
        end
    end

    // output reader
    reg [7:0] c_out;
    initial c_out = -1;
    always @(posedge clk) begin
        if (rd) begin
            c_out <= out;
        end
    end

endmodule
