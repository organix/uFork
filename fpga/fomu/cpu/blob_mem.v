/*

Binary Large-OBject (BLOB) Device

    +---------------+
    | blob          |
    |               |
--->|i_en           |
--->|i_wr           |
=4=>|i_addr         |
16=>|i_data   o_data|16=>
    |               |
 +->|i_clk          |
 |  +---------------+

This component maintains BLOB storage,
providing a "memory-mapped" register interface. When
`i_en` is asserted, the register selected on `i_addr`
is written/read based on `i_wr`. `i_data` provides the
data to be written. `o_data` provides the data read
on the previous clock-cycle.

*/

`default_nettype none

module blob #(
    parameter DATA_SZ       = 16,                       // number of bits per memory word
    parameter ADDR_SZ       = 14,                       // number of bits in each address
    parameter MEM_MAX       = (1<<ADDR_SZ)              // maximum memory address
) (
    input                   i_clk,                      // system clock
    input                   i_en,                       // device enable
    input                   i_wr,                       // {0:read, 1:write}
    input             [3:0] i_addr,                     // {0:prng, 8:ms, E:instr}
    input            [15:0] i_data,                     // data to write
    output reg       [15:0] o_data                      // last data read
);
    reg [DATA_SZ-1:0] blob_ram [0:MEM_MAX-1];
    always @(posedge i_clk) begin
        if (blob_wr) begin                              // write conditionally
            blob_ram[blob_waddr] <= blob_wdata;
        end else begin
            blob_rdata <= blob_ram[blob_raddr];         // only read if not writing
        end
    end

    // device "registers"
    localparam BLOB_RADDR   = 4'h0;                     // blob address to read
    localparam BLOB_RDATA   = 4'h1;                     // blob last data read
    localparam BLOB_WADDR   = 4'h2;                     // blob address to write
    localparam BLOB_WDATA   = 4'h3;                     // blob data to write

    reg blob_wr = 1'b0;
    reg [ADDR_SZ-1:0] blob_raddr;
    reg [DATA_SZ-1:0] blob_rdata;
    reg [ADDR_SZ-1:0] blob_waddr;
    reg [DATA_SZ-1:0] blob_wdata;

    // delayed write
    always @(posedge i_clk) begin
        if (i_en && i_wr && i_addr == BLOB_WDATA) begin
            blob_wr <= 1'b1;
        end else begin
            blob_wr <= 1'b0;
        end
    end

    // read register
    always @(posedge i_clk) begin
        if (i_en && !i_wr) begin
            if (i_addr == BLOB_RDATA) begin
                o_data <= { {(16-DATA_SZ){1'b0}}, blob_rdata };
            end
        end
    end

    // write register
    always @(posedge i_clk) begin
        if (i_en && i_wr) begin
            if (i_addr == BLOB_WDATA) begin
                blob_wdata <= i_data[DATA_SZ-1:0];
            end else if (i_addr == BLOB_WADDR) begin
                blob_waddr <= i_data[ADDR_SZ-1:0];
            end else if (i_addr == BLOB_RADDR) begin
                blob_raddr <= i_data[ADDR_SZ-1:0];
            end
        end
    end

endmodule
