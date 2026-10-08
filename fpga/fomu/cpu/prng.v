/*

Pseudo-Random Number Generator

    +---------------+
    | prng          |
    |               |
--->|i_en           |
--->|i_wr           |
=4=>|i_addr         |
16=>|i_data   o_data|16=>
    |               |
 +->|i_clk          |
 |  +---------------+

This component maintains a pseudo-random number generator,
providing a "memory-mapped" register interface. When
`i_en` is asserted, the register selected on `i_addr`
is written/read based on `i_wr`. `i_data` provides the
data to be written. `o_data` provides the data read
on the previous clock-cycle.

*/

`default_nettype none

module prng #(
    parameter SEED          = 32'hCA187A0C              // starting seed
) (
    input                   i_clk,                      // system clock
    input                   i_en,                       // device enable
    input                   i_wr,                       // {0:read, 1:write}
    input             [3:0] i_addr,                     // {0:prng_16}
    input            [15:0] i_data,                     // data to write
    output reg       [15:0] o_data                      // last data read
);
    // PRNG state
    reg [31:0] prng_w = SEED;
    reg [31:0] prng_x = SEED;
    reg [31:0] prng_y = SEED;
    reg [31:0] prng_z = SEED;

    wire [31:0] prng_t = prng_w ^ (prng_w << 11);       // calculate intermediate value

    // device "registers"
    localparam PRNG_16      = 4'h0;                     // 16-bit pseudo-random number

    always @(posedge i_clk) begin
        if (i_en && !i_wr) begin
            if (i_addr == PRNG_16) begin
                o_data <= prng_z[15:0];
                prng_w <= prng_x;
                prng_x <= prng_y;
                prng_y <= prng_z;
                prng_z <= prng_z ^ (prng_z >> 19) ^ prng_t ^ (prng_t >> 8);
            end
        end else if (i_en && i_wr) begin
            if (i_addr == PRNG_16) begin
                prng_w <= prng_x;
                prng_x <= prng_y;
                prng_y <= prng_z;
                prng_z <= i_data ^ SEED;
            end
        end
    end

endmodule
