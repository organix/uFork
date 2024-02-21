/*

Test Bench for serial_rx.v

*/

`default_nettype none

`include "serial_rx.v"

`timescale 1us/10ns

module test_bench;

  // dump simulation signals
  initial
    begin
      $dumpfile("serial_rx.vcd");
      $dumpvars(0, test_bench);
      #1600;
      $finish;
    end

  // generate chip clock (500KHz simulation time)
  reg clk = 0;
  always
    #1 clk = !clk;

  parameter CLK_FREQ = 500_000;         // clock frequency (Hz)
  parameter BAUD_RATE = 115_200;        // baud rate (bits per second)

  // uart signals
  wire uart_rx;
  wire rx_wr;
  wire [7:0] rx_data;

  // instantiate serial receiver
  serial_rx #(
    .CLK_FREQ(CLK_FREQ),
    .BAUD_RATE(BAUD_RATE)
  ) SER_RX (
    .i_clk(clk),
    .i_rx(uart_rx),
    .o_wr(rx_wr),
    .o_data(rx_data)
  );

  // baud counter to stretch simulated input
  localparam BAUD_CLKS = CLK_FREQ / BAUD_RATE;
  localparam CNT_BITS = $clog2(BAUD_CLKS);
  reg [CNT_BITS-1:0] baud_cnt;
  initial baud_cnt = BAUD_CLKS - 1;
  always @(posedge clk)
    if (baud_cnt > 0)
      baud_cnt <= baud_cnt - 1'b1;
    else
      baud_cnt <= BAUD_CLKS - 1;

  // produce test signal
  /*
    _____     _______     ___         ___     _________
         \___/       \___/   \_______/   \___/         
    IDLE | + | 1 | 1 | 0 | 1 | 0 | 0 | 1 | 0 | - | IDLE
         START                                STOP
  */
  reg [11:0] signal;
  initial signal = 12'b101101001011;  // ASCII "K"
  reg [3:0] sample;
  initial sample = 0;  // signal sample counter
  always @(posedge clk)
    if (baud_cnt == 0)
      begin
        if (sample == 0)
          sample <= 11;
        else
          sample <= sample - 1'b1;
      end
  assign uart_rx = signal[sample];

endmodule
