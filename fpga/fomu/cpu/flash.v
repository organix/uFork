/*

SPI Flash Memory Interface

    +---------------+
    | flash         |
    |               |
--->|i_en     o_data|=8=>
--->|i_wr           |
=4=>|i_addr     o_cs|--->
=8=>|i_data   o_copi|--->
    |         i_cipo|<---
 +->|i_clk    o_sclk|--->
 |  +---------------+

This component manages the SPI interface to Flash Memory,
providing a "memory-mapped" register interface. When
`i_en` is asserted, the register selected on `i_addr`
is written/read based on `i_wr`. `i_data` provides the
data to be written. `o_data` provides the data read
on the previous clock-cycle.

*/

`default_nettype none

`include "spi_phy.v"

module flash #(
    parameter WIDTH         = 8                         // data bus width (in bits)
) (
    input                   i_clk,                      // system clock
    output                  o_cs,                       // SPI chip select
    output                  o_copi,                     // SPI controller output
    input                   i_cipo,                     // SPI controller input
    output                  o_sclk,                     // SPI controller clock
    input                   i_en,                       // device enable
    input                   i_wr,                       // {0:read, 1:write}
    input             [3:0] i_addr,                     // {0:SO_RDY, 1:SO_DAT, 2:SI_RDY, 3:SI_DAT}
    input       [WIDTH-1:0] i_data,                     // data to write
    output reg  [WIDTH-1:0] o_data                      // last data read
);

    // instantiate SPI transceiver
    spi_phy #(
        .WIDTH(WIDTH)
    ) SPI (
        .i_clk(i_clk),

        .s_cs(o_cs),
        .s_clk(o_sclk),
        .s_copi(o_copi),
        .s_cipo(i_cipo),

        .o_rdata(rdata),
        .o_rdy(rdy),
        .i_rd(rd),

        .o_bsy(bsy),
        .i_wr(wr),
        .i_wdata(wdata)
    );

    wire [WIDTH-1:0] rdata;
    wire rdy;
    reg rd = 1'b0;

    wire bsy;
    wire wr = i_en && i_wr && (i_addr == SO_DAT);
    wire [WIDTH-1:0] wdata = i_data;

    // device "registers"
    localparam SO_RDY       = 4'h0;                     // ready to transmit
    localparam SO_DAT       = 4'h1;                     // data to transmit
    localparam SI_RDY       = 4'h2;                     // receive complete
    localparam SI_DAT       = 4'h3;                     // data received

    always @(posedge i_clk) begin
        rd <= 1'b0;
        if (i_en && !i_wr) begin
            if (i_addr == SO_RDY) begin
                o_data <= {WIDTH{rdy}};
            end else if (i_addr == SI_RDY) begin
                o_data <= {WIDTH{!bsy}};
            end else if (i_addr == SI_DAT) begin
                o_data <= rdata;
                rd <= 1'b1;
            end
        end
    end

endmodule
