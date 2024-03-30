/*

uFork quad-cell memory interface

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

    output reg [DATA_SZ-1:0] o_data                     // data read
);

    wire [ADDR_SZ+1:0] addr = { i_addr, i_field };

`ifdef __ICARUS__
    reg [DATA_SZ-1:0] ram [0:4*MEM_MAX-1];
    reg [DATA_SZ-1:0] rom0 [0:4*MEM_MAX-1];
    reg [DATA_SZ-1:0] rom1 [0:4*MEM_MAX-1];
    always @(posedge i_clk) begin
        if (i_cs_ram) begin
            if (i_wr) begin
                ram[addr] <= i_data;
            end else begin
                o_data <= ram[addr];
            end
        end else if (i_cs_rom0) begin
            if (i_wr) begin
                rom0[addr] <= i_data;
            end else begin
                o_data <= rom0[addr];
            end
        end else if (i_cs_rom1) begin
            if (i_wr) begin
                rom1[addr] <= i_data;
            end else begin
                o_data <= rom1[addr];
            end
        end
    end
`else
    // explictly instantiated SPRAMs
    wire [DATA_SZ-1:0] ram_data;
    SB_SPRAM256KA sp_ram (
        .ADDRESS(addr),
        .DATAIN(i_data),
        .MASKWREN(4'b1111),
        .WREN(i_wr),
        .CHIPSELECT(i_cs_ram),
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
        .WREN(i_wr),
        .CHIPSELECT(i_cs_rom0),
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
        .WREN(i_wr),
        .CHIPSELECT(i_cs_rom1),
        .CLOCK(i_clk),
        .STANDBY(1'b0),
        .SLEEP(1'b0),
        .POWEROFF(1'b1),
        .DATAOUT(rom1_data)
    );
    always @(posedge i_clk) begin
        if (i_cs_ram) begin
            o_data <= ram_data;
        end else if (i_cs_rom0) begin
            o_data <= rom0_data;
        end else if (i_cs_rom1) begin
            o_data <= rom1_data;
        end
    end
`endif

endmodule
