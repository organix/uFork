/*

uFork quad-cell memory interface
implemented with SPRAM hard-blocks

    +-------------------+
    | quad_mem          |
    |                   |
--->|i_wr       i_cs_ram|<---
=A=>|i_addr    i_cs_rom0|<---
=2=>|i_field   i_cs_rom1|<---
=D=>|i_data             |
    |             o_data|=D=>
 +->|i_clk              |
 |  +-------------------+

*/

`default_nettype none

module quad_mem #(
    parameter DATA_SZ       = 16,                       // number of bits per memory word
    parameter ADDR_SZ       = 12,                       // number of bits in each address
    parameter MEM_MAX       = (1<<ADDR_SZ)              // maximum memory memory address
) (
    input                   i_clk,                      // system clock

    input                   i_cs_ram,                   // select RAM
    input                   i_cs_rom0,                  // select ROM bank 0
    input                   i_cs_rom1,                  // select ROM bank 1

    input                   i_wr,                       // {0:read, 1:write}
    input     [ADDR_SZ-1:0] i_addr,                     // read/write address
    input             [1:0] i_field,                    // quad field selector {0:T, 1:X, 2:Y, 3:Z}
    input     [DATA_SZ-1:0] i_data,                     // data to write

    output    [DATA_SZ-1:0] o_data                      // data read
);

    // composite address
    wire [ADDR_SZ+1:0] addr = { i_addr, i_field };

    wire [DATA_SZ-1:0] ram_data;
    SB_SPRAM256KA sp_ram (
        .ADDRESS(addr),
        .DATAIN(i_data),
        .MASKWREN(4'b1111),
        .WREN(i_wr && i_cs_ram),
        .CHIPSELECT(1'b1),
        .CLOCK(i_clk),
        .STANDBY(1'b0),
        .SLEEP(1'b0),
        .POWEROFF(1'b1),
        .DATAOUT(ram_data)
    );

    wire [DATA_SZ-1:0] rom0_data;
    SB_SPRAM256KA sp_rom0 (
        .ADDRESS(addr),
        .DATAIN(i_data),
        .MASKWREN(4'b1111),
        .WREN(i_wr && i_cs_rom0),
        .CHIPSELECT(1'b1),
        .CLOCK(i_clk),
        .STANDBY(1'b0),
        .SLEEP(1'b0),
        .POWEROFF(1'b1),
        .DATAOUT(rom0_data)
    );

    wire [DATA_SZ-1:0] rom1_data;
    SB_SPRAM256KA sp_rom1 (
        .ADDRESS(addr),
        .DATAIN(i_data),
        .MASKWREN(4'b1111),
        .WREN(i_wr && i_cs_rom1),
        .CHIPSELECT(1'b1),
        .CLOCK(i_clk),
        .STANDBY(1'b0),
        .SLEEP(1'b0),
        .POWEROFF(1'b1),
        .DATAOUT(rom1_data)
    );

    // output multiplexor
    reg r_cs_ram = 1'b0;
    reg r_cs_rom0 = 1'b0;
    reg r_cs_rom1 = 1'b0;
    always @(posedge i_clk) begin
        r_cs_ram <= i_cs_ram;
        r_cs_rom0 <= i_cs_rom0;
        r_cs_rom1 <= i_cs_rom1;
    end
    assign o_data =
        ( r_cs_rom0 ? rom0_data
        : r_cs_rom1 ? rom1_data
        : ram_data );

endmodule
