/*

Test Bench for serial_rx.v driven by serial_tx.v

*/

`default_nettype none

`include "serial_rx.v"
`include "serial_tx.v"

`timescale 1us/10ns

module test_bench;

  // dump simulation signals
  initial
    begin
      $dumpfile("serial_rx+tx.vcd");
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
  wire tx_wr;
  wire [7:0] tx_data;
  wire tx_busy;  // busy signal ignored
  wire uart_tx;
  wire uart_rx;
  wire rx_wr;
  wire [7:0] rx_data;

  // instantiate serial transmitter
  serial_tx #(
    .CLK_FREQ(CLK_FREQ),
    .BAUD_RATE(BAUD_RATE)
  ) SER_TX (
    .i_clk(clk),
    .i_wr(tx_wr),
    .i_data(tx_data),
    .o_busy(tx_busy),
    .o_tx(uart_tx)
  );

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

  // connect serial_tx to serial_rx
  assign tx_wr = 1'b1;  // perpetual write-request
  assign tx_data = "K";
  assign uart_rx = uart_tx;

endmodule
