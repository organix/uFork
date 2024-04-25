/*

uFork quad-cell memory interface
implemented in Verilog (for simulation)

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

    reg [DATA_SZ-1:0] ram [0:4*MEM_MAX-1];
    reg [DATA_SZ-1:0] rom0 [0:4*MEM_MAX-1];
    reg [DATA_SZ-1:0] rom1 [0:4*MEM_MAX-1];
    always @(posedge i_clk) begin
        if (i_wr) begin
            if (i_cs_ram) begin
                ram[addr] <= i_data;
            end
            if (i_cs_rom0) begin
                rom0[addr] <= i_data;
            end
            if (i_cs_rom1) begin
                rom1[addr] <= i_data;
            end
        end else begin
            if (i_cs_ram) begin
                r_data <= ram[addr];
            end
            if (i_cs_rom0) begin
                r_data <= rom0[addr];
            end
            if (i_cs_rom1) begin
                r_data <= rom1[addr];
            end
        end
    end

    // registered data read
    reg [DATA_SZ-1:0] r_data;
    assign o_data = r_data;

endmodule
