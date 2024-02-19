/*

46.875 kHz Clock Divider (Fomu)

    +------------+
    | clk_div    |
    |            |
--->|i_clk  o_clk|--->
    |       o_stb|--->
    |            |
    +------------+

This module produces a 46.875 kHz divided clock signal
from a the 48 MHz system clock on the Fomu (iCE40up5k).
Two registered output signals are provided.
A 46.875 kHz 50% duty-cycle pseudo-clock,
and a 46.875 kHz strobe (1 clock high out of each 1024).

*/

`default_nettype none

module clk_div (
  input             i_clk,              // system clock
  output reg        o_clk,              // 46.875 kHz divided clock
  output reg        o_stb               // 46.875 kHz clock strobe
);
  parameter CLK_FREQ = 48_000_000;      // Fomu clock frequency (Hz)

  // 46.875 kHz clock divider
  reg [9:0] divider;  // 1024-cycle divider
  initial divider = 0;
  always @(posedge i_clk)
    divider <= divider + 1'b1;

  // register divided clock
  initial o_clk = 1'b0;
  always @(posedge i_clk)
    o_clk <= ~divider[9];  // 46.875 kHz divided clock

  // register clock strobe
  initial o_stb = 1'b0;
  always @(posedge i_clk)
    o_stb <= (divider == 0);  // one pulse every 1024 clocks

endmodule
