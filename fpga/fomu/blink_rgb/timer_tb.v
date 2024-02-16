/*

Test Bench for timer.v

*/

`default_nettype none

`include "timer.v"

`timescale 10ns/1ns

module test_bench;

  // dump simulation signals
  initial
    begin
      $dumpfile("timer.vcd");
      $dumpvars(0, test_bench);
      #1200;
      $finish;
    end

  // generate chip clock (50MHz simulation time)
  reg clk = 0;
  always
    #1 clk = !clk;

  // instantiate timer component
  localparam DATA_BITS = 3;             // number of timer output bits
  wire [DATA_BITS-1:0] bits;
  timer #(
    .WIDTH(5),
    .BITS(DATA_BITS)
  ) TIMER (
    .i_clk(clk),
    .o_data(bits)
  );

  // drive LEDs from timer bits
  wire led_r;
  wire led_g;
  wire led_b;
  assign led_r = bits[2];
  assign led_g = bits[1];
  assign led_b = bits[0];

endmodule
