/*

Real-time Clock Device

    +---------------+
    | rtc           |
    |               |
--->|i_en           |
--->|i_wr           |
=4=>|i_addr         |
 X=>|i_data   o_data|=10=>
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
    input             [3:0] i_addr,                     // {0:ms, 1:us, E:ks, F:s}
//    input             [9:0] i_data,                     // data to write
    output reg        [9:0] o_data                      // last data read
);
    localparam MS_CLKS      = CLK_FREQ / 1_000;         // clock-cycles per millisecond (ms)
    localparam US_CLKS      = CLK_FREQ / 1_000_000;     // clock-cycles per microsecond (us)
    localparam US_BITS      = $clog2(US_CLKS);          // bit-width of us counter

    // count-down timer to generate 1Mhz strobe
    reg [US_BITS-1:0] us_cnt = US_CLKS - 1'b1;
    wire us_stb = (us_cnt == 0);
    always @(posedge i_clk) begin
        if (us_stb) begin
            us_cnt <= US_CLKS - 1'b1;
        end else begin
            us_cnt <= us_cnt - 1'b1;
        end
    end

    // count-up timer to report microseconds (us)
    reg [9:0] us_ticks = 0;
    wire ms_stb = (us_ticks == 999)
    always @(posedge i_clk) begin
        if (us_stb) begin
            if (ms_stb) begin
                us_ticks <= 0;
            end else begin
                us_ticks <= us_ticks + 1'b1;
            end
        end
    end

    // count-up timer to report milliseconds (ms)
    reg [9:0] ms_ticks = 0;
    wire s_stb = (ms_ticks == 999)
    always @(posedge i_clk) begin
        if (ms_stb) begin
            if (s_stb) begin
                ms_ticks <= 0;
            end else begin
                ms_ticks <= ms_ticks + 1'b1;
            end
        end
    end

    // count-up timer to report seconds (s)
    reg [9:0] s_ticks = 0;
    wire ks_stb = (s_ticks == 999)
    always @(posedge i_clk) begin
        if (s_stb) begin
            if (ks_stb) begin
                s_ticks <= 0;
            end else begin
                s_ticks <= s_ticks + 1'b1;
            end
        end
    end

    // count-up timer to report kiloseconds (ks)
    reg [9:0] ks_ticks = 0;
    always @(posedge i_clk) begin
        if (ks_ticks == 999) begin
            ks_ticks <= 0;
        end else begin
            ks_ticks <= ks_ticks + 1'b1;
        end
    end

    // device "registers"
    localparam RTC_MS       = 4'h0;                     // RTC milliseconds (10^-3)
    localparam RTC_US       = 4'h1;                     // RTC microseconds (10^-6)
    localparam RTC_KS       = 4'hE;                     // RTC kiloseconds (10^3)
    localparam RTC_S        = 4'hF;                     // RTC seconds

    always @(posedge i_clk) begin
        if (i_en && !i_wr) begin
            if (i_addr == RTC_MS) begin
                o_data <= ms_ticks;
            end else if (i_addr == RTC_US) begin
                o_data <= us_ticks;
            end else if (i_addr == RTC_KS) begin
                o_data <= ks_ticks;
            end else if (i_addr == RTC_S) begin
                o_data <= s_ticks;
            end
        end
    end

endmodule
