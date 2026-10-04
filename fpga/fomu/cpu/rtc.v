/*

Real-time Clock Device

    +---------------+
    | rtc           |
    |               |
--->|i_en           |
--->|i_wr           |
=4=>|i_addr         |
16=>|i_data   o_data|16=>
    |               |
 +->|i_clk          |
 |  +---------------+

This component maintains a "real-time" clock,
providing a "memory-mapped" register interface. When
`i_en` is asserted, the register selected on `i_addr`
is written/read based on `i_wr`. `i_data` provides the
data to be written. `o_data` provides the data read
on the previous clock-cycle.

*/

`default_nettype none

module rtc #(
    parameter CLK_FREQ      = 48_000_000                // i_clk frequency (Hz)
) (
    input                   i_clk,                      // system clock
    input                   i_en,                       // device enable
    input                   i_wr,                       // {0:read, 1:write}
    input             [3:0] i_addr,                     // {0:ms}
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
    localparam RTC_MS       = 4'h0;                     // RTC milliseconds (10^-3)

    // continuous (wrap-around) counter to report milliseconds (ms)
    reg [15:0] ms_ticks = 0;

    always @(posedge i_clk) begin
        if (i_en && !i_wr) begin
            if (i_addr == RTC_MS) begin
                o_data <= ms_ticks;
            end
        end else if (i_en && i_wr) begin
            if (i_addr == RTC_MS) begin
                ms_ticks <= i_data;
            end
        end else begin
            ms_ticks <= ms_ticks + 1'b1;
        end
    end

endmodule
