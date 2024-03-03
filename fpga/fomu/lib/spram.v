/*

iCE40 Single-Ported On-Chip RAM
(based on FPGA-TN-02022-1-3-iCE40-SPRAM-Usage-Guide.pdf)

    +-----------------+
    | spram (256kb)   |
    |                 |
--->|i_rd_en   i_wr_en|<---
=A=>|i_raddr   i_waddr|<=A=
<=D=|o_rdata   i_wdata|<=D=
    |                 |
 +->|i_clk            |
 |  +-----------------+

*/

`default_nettype none

module spram #(
    // DATA_SZ x MEM_MAX = 256k bits
    parameter DATA_SZ       = 16,                       // number of bits per memory word
    parameter ADDR_SZ       = 14,                       // number of bits in each address
    parameter MEM_MAX       = (1<<ADDR_SZ)              // maximum memory memory address
) (
    input                   i_clk,                      // system clock

    input                   i_wr_en,                    // write request
    input     [ADDR_SZ-1:0] i_waddr,                    // write address
    input     [DATA_SZ-1:0] i_wdata,                    // data written

    input                   i_rd_en,                    // read request
    input     [ADDR_SZ-1:0] i_raddr,                    // read address
    output reg [DATA_SZ-1:0] o_rdata                    // data read
);

    wire [ADDR_SZ-1:0] addr = (i_wr_en ? i_waddr : i_raddr);

`ifdef __ICARUS__
    reg [DATA_SZ-1:0] mem [0:MEM_MAX-1];
    always @(posedge i_clk) begin
        if (i_wr_en) begin
            mem[addr] <= i_wdata;
        end else begin
            o_rdata <= mem[addr];
        end
    end
`else
    // explictly instantiated spram
    SB_SPRAM256KA spram_inst (
        .ADDRESS(addr),
        .DATAIN(i_wdata),
        .MASKWREN(4'b1111),
        .WREN(i_wr_en),
        .CHIPSELECT(1'b1),
        .CLOCK(i_clk),
        .STANDBY(1'b0),
        .SLEEP(1'b0),
        .POWEROFF(1'b1),
        .DATAOUT(o_rdata)
    );
`endif

endmodule
