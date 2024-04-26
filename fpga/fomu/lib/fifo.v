/*

Synchronous FIFO Component

    +---------------+
    | fifo          |
    |               |
=D=>|i_data     i_rd|<---
--->|i_wr     o_data|=D=>
<---|o_full  o_empty|--->
    |               |
 +->|i_clk          |
 |  +---------------+

*/

`default_nettype none

module fifo #(
    parameter DATA_SZ       = 8,                        // data bus bit width
    parameter ADDR_SZ       = 4                         // address bit width
) (
    input                   i_clk,                      // system clock
    input                   i_wr,                       // write request
    input     [DATA_SZ-1:0] i_data,                     // write data
    output                  o_full,                     // buffer full condition
    input                   i_rd,                       // read request
    output    [DATA_SZ-1:0] o_data,                     // read data
    output                  o_empty                     // buffer empty condition
);
    parameter DEPTH         = 1 << ADDR_SZ;             // number of element in queue

    wire wr = i_wr && !o_full;                          // valid write request
    wire rd = i_rd && !o_empty;                         // valid read request

    // data buffer (memory)
    reg [DATA_SZ-1:0] buffer [0:DEPTH-1];

    // maintain write pointer
    reg [ADDR_SZ:0] wr_addr = 0;
    always @(posedge i_clk) begin
        if (wr) begin
            wr_addr <= wr_addr + 1'b1;
        end
    end
    always @(posedge i_clk) begin                       // NOTE: RAM access in its own block
        if (wr) begin
            buffer[wr_addr[ADDR_SZ-1:0]] <= i_data;
        end
    end

    // maintain read pointer
    reg [ADDR_SZ:0] rd_addr = 0;
    always @(posedge i_clk) begin
        if (rd) begin
            rd_addr <= rd_addr + 1'b1;
        end
    end
    assign o_data = buffer[rd_addr[ADDR_SZ-1:0]];

    // maintain queue length
    reg [ADDR_SZ:0] len = 0;
    always @(posedge i_clk) begin
        if (wr & !rd) begin
            len <= len + 1'b1;
        end else if (!wr && rd) begin
            len <= len - 1'b1;
        end
    end
    assign o_empty = (len == 0);
    assign o_full = len[ADDR_SZ];//(len == DEPTH);

/*
    // formal verification
    always @(*) begin
        assert(len == (wr_addr - rd_addr));
    end
    always @(*) begin
        assert(len <= DEPTH);
    end
*/

endmodule
