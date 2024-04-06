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
    wire [ADDR_SZ-1:0] addr = i_addr;

    wire [DATA_SZ-1:0] ram_T;
    SB_RAM40_4K /*SB_RAM256x16*/ sp_ram_T (
        .RDATA(ram_T),
        .RADDR(addr[7:0]),
        .RCLK(i_clk),
        .RCLKE(1'b1),
        .RE(!i_wr && i_cs_ram && i_field==2'b00),
        .WADDR(addr[7:0]),
        .WCLK(i_clk),
        .WCLKE(1'b1),
        .WDATA(i_data),
        .WE(i_wr && i_cs_ram && i_field==2'b00),
        .MASK(16'h0000)
    );
    wire [DATA_SZ-1:0] ram_X;
    SB_RAM40_4K /*SB_RAM256x16*/ sp_ram_X (
        .RDATA(ram_X),
        .RADDR(addr[7:0]),
        .RCLK(i_clk),
        .RCLKE(1'b1),
        .RE(!i_wr && i_cs_ram && i_field==2'b01),
        .WADDR(addr[7:0]),
        .WCLK(i_clk),
        .WCLKE(1'b1),
        .WDATA(i_data),
        .WE(i_wr && i_cs_ram && i_field==2'b01),
        .MASK(16'h0000)
    );
    wire [DATA_SZ-1:0] ram_Y;
    SB_RAM40_4K /*SB_RAM256x16*/ sp_ram_Y (
        .RDATA(ram_Y),
        .RADDR(addr[7:0]),
        .RCLK(i_clk),
        .RCLKE(1'b1),
        .RE(!i_wr && i_cs_ram && i_field==2'b10),
        .WADDR(addr[7:0]),
        .WCLK(i_clk),
        .WCLKE(1'b1),
        .WDATA(i_data),
        .WE(i_wr && i_cs_ram && i_field==2'b10),
        .MASK(16'h0000)
    );
    wire [DATA_SZ-1:0] ram_Z;
    SB_RAM40_4K /*SB_RAM256x16*/ sp_ram_Z (
        .RDATA(ram_Z),
        .RADDR(addr[7:0]),
        .RCLK(i_clk),
        .RCLKE(1'b1),
        .RE(!i_wr && i_cs_ram && i_field==2'b11),
        .WADDR(addr[7:0]),
        .WCLK(i_clk),
        .WCLKE(1'b1),
        .WDATA(i_data),
        .WE(i_wr && i_cs_ram && i_field==2'b11),
        .MASK(16'h0000)
    );

    wire [DATA_SZ-1:0] rom0_T;
    SB_RAM40_4K /*SB_RAM256x16*/ sp_rom0_T (
        .RDATA(rom0_T),
        .RADDR(addr[7:0]),
        .RCLK(i_clk),
        .RCLKE(1'b1),
        .RE(!i_wr && i_cs_rom0 && i_field==2'b00),
        .WADDR(addr[7:0]),
        .WCLK(i_clk),
        .WCLKE(1'b1),
        .WDATA(i_data),
        .WE(i_wr && i_cs_rom0 && i_field==2'b00),
        .MASK(16'h0000)
    );
    wire [DATA_SZ-1:0] rom0_X;
    SB_RAM40_4K /*SB_RAM256x16*/ sp_rom0_X (
        .RDATA(rom0_X),
        .RADDR(addr[7:0]),
        .RCLK(i_clk),
        .RCLKE(1'b1),
        .RE(!i_wr && i_cs_rom0 && i_field==2'b01),
        .WADDR(addr[7:0]),
        .WCLK(i_clk),
        .WCLKE(1'b1),
        .WDATA(i_data),
        .WE(i_wr && i_cs_rom0 && i_field==2'b01),
        .MASK(16'h0000)
    );
    wire [DATA_SZ-1:0] rom0_Y;
    SB_RAM40_4K /*SB_RAM256x16*/ sp_rom0_Y (
        .RDATA(rom0_Y),
        .RADDR(addr[7:0]),
        .RCLK(i_clk),
        .RCLKE(1'b1),
        .RE(!i_wr && i_cs_rom0 && i_field==2'b10),
        .WADDR(addr[7:0]),
        .WCLK(i_clk),
        .WCLKE(1'b1),
        .WDATA(i_data),
        .WE(i_wr && i_cs_rom0 && i_field==2'b10),
        .MASK(16'h0000)
    );
    wire [DATA_SZ-1:0] rom0_Z;
    SB_RAM40_4K /*SB_RAM256x16*/ sp_rom0_Z (
        .RDATA(rom0_Z),
        .RADDR(addr[7:0]),
        .RCLK(i_clk),
        .RCLKE(1'b1),
        .RE(!i_wr && i_cs_rom0 && i_field==2'b11),
        .WADDR(addr[7:0]),
        .WCLK(i_clk),
        .WCLKE(1'b1),
        .WDATA(i_data),
        .WE(i_wr && i_cs_rom0 && i_field==2'b11),
        .MASK(16'h0000)
    );

    wire [DATA_SZ-1:0] rom1_T;
    SB_RAM40_4K /*SB_RAM256x16*/ sp_rom1_T (
        .RDATA(rom1_T),
        .RADDR(addr[7:0]),
        .RCLK(i_clk),
        .RCLKE(1'b1),
        .RE(!i_wr && i_cs_rom1 && i_field==2'b00),
        .WADDR(addr[7:0]),
        .WCLK(i_clk),
        .WCLKE(1'b1),
        .WDATA(i_data),
        .WE(i_wr && i_cs_rom1 && i_field==2'b00),
        .MASK(16'h0000)
    );
    wire [DATA_SZ-1:0] rom1_X;
    SB_RAM40_4K /*SB_RAM256x16*/ sp_rom1_X (
        .RDATA(rom1_X),
        .RADDR(addr[7:0]),
        .RCLK(i_clk),
        .RCLKE(1'b1),
        .RE(!i_wr && i_cs_rom1 && i_field==2'b01),
        .WADDR(addr[7:0]),
        .WCLK(i_clk),
        .WCLKE(1'b1),
        .WDATA(i_data),
        .WE(i_wr && i_cs_rom1 && i_field==2'b01),
        .MASK(16'h0000)
    );
    wire [DATA_SZ-1:0] rom1_Y;
    SB_RAM40_4K /*SB_RAM256x16*/ sp_rom1_Y (
        .RDATA(rom1_Y),
        .RADDR(addr[7:0]),
        .RCLK(i_clk),
        .RCLKE(1'b1),
        .RE(!i_wr && i_cs_rom1 && i_field==2'b10),
        .WADDR(addr[7:0]),
        .WCLK(i_clk),
        .WCLKE(1'b1),
        .WDATA(i_data),
        .WE(i_wr && i_cs_rom1 && i_field==2'b10),
        .MASK(16'h0000)
    );
    wire [DATA_SZ-1:0] rom1_Z;
    SB_RAM40_4K /*SB_RAM256x16*/ sp_rom1_Z (
        .RDATA(rom1_Z),
        .RADDR(addr[7:0]),
        .RCLK(i_clk),
        .RCLKE(1'b1),
        .RE(!i_wr && i_cs_rom1 && i_field==2'b11),
        .WADDR(addr[7:0]),
        .WCLK(i_clk),
        .WCLKE(1'b1),
        .WDATA(i_data),
        .WE(i_wr && i_cs_rom1 && i_field==2'b11),
        .MASK(16'h0000)
    );

    // output multiplexor
    reg r_cs_ram = 1'b0;
    reg r_cs_rom0 = 1'b0;
    reg r_cs_rom1 = 1'b0;
    reg r_field = 2'b00;
    always @(posedge i_clk) begin
        r_cs_ram <= i_cs_ram;
        r_cs_rom0 <= i_cs_rom0;
        r_cs_rom1 <= i_cs_rom1;
        r_field <= i_field;
    end
    assign o_data =
        ( r_cs_rom0 ?
            ( r_field==2'b01 ? rom0_X
            : r_field==2'b10 ? rom0_Y
            : r_field==2'b11 ? rom0_Z
            : rom0_T )
        : r_cs_rom1 ?
            ( r_field==2'b01 ? rom1_X
            : r_field==2'b10 ? rom1_Y
            : r_field==2'b11 ? rom1_Z
            : rom1_T )
        :
            ( r_field==2'b01 ? ram_X
            : r_field==2'b10 ? ram_Y
            : r_field==2'b11 ? ram_Z
            : ram_T ) );

endmodule
