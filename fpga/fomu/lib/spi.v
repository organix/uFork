/*
  Serial Peripheral Interface master virtual component

       +-----------------+
       | spi master      |
C      |                 |      S
P  --->|i_en       o_SCLK|--->  P
U  --->|i_wr       o_MOSI|--->  I
   =4=>|i_addr     i_MISO|<---   
S  =8=>|i_data       o_SS|--->  S
I  <=8=|o_data           |      I
D      |                 |      D
E   +->|i_clk            |      E
    |  +-----------------+

This component is an spi master that is meant to connect to an external spi slave.
Internal registers:
  0x0 status register, whose bits indicate:
      bit 0 (lsb): busy trancieving
      bit 1: tbd: clock being stretched by slave
      bits 2-7: reserved
  0x1 data out (what the cpu wants out to the slave)
  0x2 data in  (what the spi slave wants into the master)
  0x3 control, whose bits controls:
      bits 0-1: spi mode
      bit    2: slave select, spi enable
      bits 3-7: reserved
*/

`default_nettype none

module spi_master #(
    parameter CLK_FREQ      = 48_000_000,               // clock frequency (Hz)
) (
    input                   i_clk,                      // system clock
    output                  o_SCLK                      // Spi CLocK
    output                  o_MOSI                      // spi Master Out Slave In
    input                   i_MISO                      // spi Master In Slave Out
    output                  o_SS                        // spi Slave Select
    input                   i_en,                       // device enable
    input                   i_wr,                       // {0:read, 1:write}
    input             [3:0] i_addr,                     // {0:TX_RDY, 1:TX_DAT, 2:RX_RDY, 3:RX_DAT}
    input             [7:0] i_data,                     // data to write
    output reg        [7:0] o_data                      // last data read
  );
endmodule



