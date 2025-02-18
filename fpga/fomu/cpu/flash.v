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
    output reg              o_cs,                       // SPI chip select
    output                  o_copi,                     // SPI controller output
    input                   i_cipo,                     // SPI controller input
    output                  o_sclk,                     // SPI controller clock
    input                   i_en,                       // device enable
    input                   i_wr,                       // {0:read, 1:write}
    input             [3:0] i_addr,                     // {0:CS!, 1:DO!, 2:DR?, 3:DI@}
    input       [WIDTH-1:0] i_data,                     // data to write
    output reg  [WIDTH-1:0] o_data                      // last data read
);

    // instantiate SPI transceiver
    spi_phy #(
        .WIDTH(WIDTH)
    ) SPI (
        .i_clk(i_clk),

        .s_clk(o_sclk),
        .s_copi(o_copi),
        .s_cipo(i_cipo),

        .i_wr(wr),
        .i_wdata(wdata),
        .o_bsy(bsy),
        .o_rdata(rdata)
    );

    wire [WIDTH-1:0] wdata = i_data;
    wire bsy;
    wire [WIDTH-1:0] rdata;

    wire wr = i_en && i_wr && (i_addr == SPI_OUT);

    // device "registers"
    localparam SPI_CS       = 4'h0;                     // chip select
    localparam SPI_OUT      = 4'h1;                     // data to transmit
    localparam SPI_RDY      = 4'h2;                     // ready to transmit / receive complete
    localparam SPI_IN       = 4'h3;                     // data received

    initial o_cs = 1'b1;                                // default CS _not_ asserted
    always @(posedge i_clk) begin
        if (i_en && i_wr && i_addr == SPI_CS) begin
            o_cs <= (i_data == 0);                      // set CS (active low)
        end
    end

    always @(posedge i_clk) begin
        if (i_en && !i_wr) begin
            if (i_addr == SPI_RDY) begin
                o_data <= {WIDTH{!bsy}};
            end else if (i_addr == SPI_IN) begin
                o_data <= rdata;
            end
        end
    end

endmodule
