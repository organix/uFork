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

Inspiration for this module includes:
https://github.com/mmicko/mikrobus-upduino/blob/master/src/picosoc/ip_wrapper.v

*/

`default_nettype none

`include "spi_reg.vh"

module flash #(
    parameter CLK_FREQ      = 48_000_000,               // system clock frequency (Hz)
    parameter SCLK_FREQ     = 3_000_000                 // serial clock frequency (Hz)
) (
    input                   i_clk,                      // system clock
    output                  o_cs,                       // SPI chip select
    output                  o_copi,                     // SPI controller output
    input                   i_cipo,                     // SPI controller input
    output                  o_sclk,                     // SPI controller clock
    input                   i_en,                       // device enable
    input                   i_wr,                       // {0:read, 1:write}
    output                  o_ack,                      // acknowledgement
    input             [3:0] i_addr,                     // defined in "spi_reg.vh"
    input             [7:0] i_data,                     // data to write
    output reg        [7:0] o_data                      // last data read
);

    // instantiate SPI hard-block
    SB_SPI spi_flash (
        .SBCLKI(i_clk),
        .SBRWI(i_wr),
        .SBSTBI(i_en),
        //.SBADRI(i_addr),
        .SBADRI0(i_addr[0]),
        .SBADRI1(i_addr[1]),
        .SBADRI2(i_addr[2]),
        .SBADRI3(i_addr[3]),
        .SBADRI4(1'b0),  // select the SPI block connected to the onboard Flash
        .SBADRI5(1'b0),
        .SBADRI6(1'b0),
        .SBADRI7(1'b0),
        //.SBDATI(i_data),
        .SBDATI0(i_data[0]),
        .SBDATI1(i_data[1]),
        .SBDATI2(i_data[2]),
        .SBDATI3(i_data[3]),
        .SBDATI4(i_data[4]),
        .SBDATI5(i_data[5]),
        .SBDATI6(i_data[6]),
        .SBDATI7(i_data[7]),
        //.SBDATO(o_data),
        .SBDATO0(o_data[0]),
        .SBDATO1(o_data[1]),
        .SBDATO2(o_data[2]),
        .SBDATO3(o_data[3]),
        .SBDATO4(o_data[4]),
        .SBDATO5(o_data[5]),
        .SBDATO6(o_data[6]),
        .SBDATO7(o_data[7]),
        .SBACKO(o_ack),
        .MCSNO0(o_cs),
        .MO(o_copi),
        .MI(i_cipo),
        .SCKO(o_sclk)
    );

endmodule
