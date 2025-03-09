/*

Garbage Collector Color Storage

     +---------------+
     | gcc           |
     |               |
---->|i_en     o_data|=2=>
---->|i_wr           |
=12=>|i_addr         |
==2=>|i_data         |
     |               |
  +->|i_clk          |
  |  +---------------+

This component maintains storage for GC color bits.
When `i_en` is asserted, the location on `i_addr`
is written/read based on `i_wr`. `i_data` provides the
data to be written. `o_data` provides the data read
on the previous clock-cycle.

*/

`default_nettype none

module gcc #(
    parameter WIDTH         = 12                        // address bus width (in bits)
) (
    input                   i_clk,                      // system clock
    input                   i_en,                       // device enable
    input                   i_wr,                       // {0:read, 1:write}
    input       [WIDTH-1:0] i_addr,                     // address to read/write
    input             [1:0] i_data,                     // data to write
    output reg        [1:0] o_data                      // last data read
);
    parameter MEM_MAX       = (1<<WIDTH);               // maximum memory address

    reg [1:0] color [0:MEM_MAX-1];                      // inferred block ram
    always @(posedge i_clk) begin
        if (i_en && i_wr) begin                         // write conditionally
            color[i_addr] <= i_data;
        end else begin
            o_data <= color[i_addr];                    // only read if not writing
        end
        /*
        uc_rdata <= color[i_addr];                      // read always
        */
    end

endmodule
