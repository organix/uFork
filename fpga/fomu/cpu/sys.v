/*

System Device

    +---------------+
    | sys           |
    |               |
--->|i_en           |
--->|i_wr           |
=4=>|i_addr         |
16=>|i_data   o_data|16=>
    |               |
 +->|i_clk          |
 |  +---------------+

This component maintains various system counters,
providing a "memory-mapped" register interface. When
`i_en` is asserted, the register selected on `i_addr`
is written/read based on `i_wr`. `i_data` provides the
data to be written. `o_data` provides the data read
on the previous clock-cycle.

*/

`default_nettype none

module sys #(
    parameter CLK_FREQ      = 48_000_000,               // i_clk frequency (Hz)
    parameter SEED          = 32'hCA187A0C              // starting seed
) (
    input                   i_clk,                      // system clock
    input                   i_en,                       // device enable
    input                   i_wr,                       // {0:read, 1:write}
    input             [3:0] i_addr,                     // {0:prng, 8:ms, E:instr}
    input            [15:0] i_data,                     // data to write
    output reg       [15:0] o_data                      // last data read
);
    localparam MS_CLKS      = CLK_FREQ / 1_000;         // clock-cycles per millisecond (ms)
    localparam MS_BITS      = $clog2(MS_CLKS);          // bit-width of ms counter

    // count-down timer to generate 1Khz strobe
    reg [MS_BITS-1:0] ms_cnt = MS_CLKS - 1'b1;
    wire ms_stb = (ms_cnt == 0);
    always @(posedge i_clk) begin
        if (ms_stb) begin
            ms_cnt <= MS_CLKS - 1'b1;
        end else begin
            ms_cnt <= ms_cnt - 1'b1;
        end
    end

    // device "registers"
    localparam SYS_INSTR    = 4'h0;                     // instruction counter
    localparam SYS_MS       = 4'h8;                     // RTC milliseconds (10^-3)
    localparam SYS_PRNG     = 4'hF;                     // pseudo-random number

    // instruction counter (2 clks per instruction)
    reg [24:0] instr_cnt = 0;                           // instruction counter
    always @(posedge i_clk) begin
        instr_cnt <= instr_cnt + 1'b1;
    end

    // continuous (wrap-around) counter to report milliseconds (ms)
    reg [15:0] ms_ticks = 0;
    always @(posedge i_clk) begin
        if (i_en && i_wr && (i_addr == SYS_MS)) begin
            ms_ticks <= i_data;
        end else if (ms_stb) begin
            ms_ticks <= ms_ticks + 1'b1;
        end
    end

    // pseudo-random number generator
    reg [31:0] prng_x = SEED;
    reg [31:0] prng_y = SEED;
    wire [31:0] prng_t = prng_x ^ (prng_x << 11);       // calculate intermediate value
    always @(posedge i_clk) begin
        if (i_en && (i_addr == SYS_PRNG)) begin
            if (i_wr) begin
                prng_x <= prng_y ^ instr_cnt;
                prng_y <= i_data ^ SEED;
            end else begin
                prng_x <= prng_y ^ instr_cnt;
                prng_y <= prng_y ^ (prng_y >> 19) ^ prng_t ^ (prng_t >> 8);
            end
        end
    end

    always @(posedge i_clk) begin
        if (i_en && !i_wr) begin
            if (i_addr == SYS_INSTR) begin
                o_data <= instr_cnt[16:1];
            end else if (i_addr == SYS_MS) begin
                o_data <= ms_ticks;
            end else if (i_addr == SYS_PRNG) begin
                o_data <= prng_y[15:0];
            end
        end
    end

endmodule
