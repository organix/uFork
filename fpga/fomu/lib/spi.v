/*
  Serial Peripheral Interface master virtual component

       +-----------------+
       | spi master      |
C      |                 |      S
P  --->|i_en       o_SCLK|--->  P
U  --->|i_wr       o_MOSI|--->  I
   =4=>|i_addr     i_MISO|<---   
S  =8=>|i_data   o_SS_bar|--->  S
I  <=8=|o_data           |      I
D      |                 |      D
E  <---|o_int            |      E
    +->|i_clk            |      
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
      bits 0-1: spi mode  (bit 0 clock phase, bit 1 clock polarity)
      bit    2: slave select, spi enable
      bits 3-7: cpu clock to spi clock division
*/

`default_nettype none

module spi_master #(
    parameter CLK_FREQ      = 48_000_000,               // cpu clock frequency (Hz)
) (
    input                   i_clk,                      // system clock
    output                  o_SCLK,                     // Spi CLocK
    output                  o_MOSI,                     // spi Mistress Out Sub In
    input                   i_MISO,                     // spi Mistress In Sub Out
    output                  o_SS,                       // spi Slave Select
    input                   i_en,                       // device enable
    input                   i_wr,                       // {0:read, 1:write}
    input             [3:0] i_addr,                     // {0:STATUS, 1:DATA_OUT, 2:DATA_IN, 3:CTRL}
    input             [7:0] i_data,                     // data to write
    output reg        [7:0] o_data,                     // last data read
    output                  o_int,                      // interupt when byte transfer is done
  );

  // device registers
  localparam STATUS   = 4'h0;
  localparam DATA_OUT = 4'h1;
  localparam DATA_IN  = 4'h2;
  localparam CTRL     = 4'h3;

  reg [7:0] CTRL_reg;
  wire CPOL = CTRL_reg[1]; // spi clock polarity
  wire CPHA = CTRL_reg[0]; // spi clock phase
  wire [4:0] CLK_DIV = CTRL_reg[7:3];

  localparam IDLE  = 4'h0;
  localparam START = 4'h1;
  // 4'h2-4'h9 are the bits of the bytes
  localparam STOP  = 4'hA;
  reg [3:0] state;

  reg [4:0] clkdiv_reg;
  reg SCLK;
  always @(posedge i_clk) begin
    if (state != IDLE) begin
      if (clkdiv_reg == CLK_DIV) begin
        SCLK <= !SCLK;
        clkdiv_reg <= 5'b00000;
      end else begin
        clkdiv_reg <= clkdiv_reg + 1;
      end
    end
  end
  always @(posedge SCLK or negedge SCLK) begin
    
  end

  always @(posedge i_clk) begin
    if (i_en) begin
      if (i_addr == STATUS) begin
      end else if (i_addr == DATA_OUT) begin
      end else if (i_addr == DATA_IN) begin
      end else if (i_addr == CTRL) begin
        if (i_wr) begin
          CTRL_reg <= i_data;
        end else begin
          o_data <= CTRL_reg;
        end
      end else begin
        if (i_wr) begin
          o_data <= 8'h00;
        end
      end
    end
    assign o_SS = !CTRL_reg[2];
  end
endmodule



