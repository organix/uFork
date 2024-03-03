/*

Serial Transmitter

    +------------+
    | serial_tx  |
    |            |
=8=>|i_data  o_tx|--->
--->|i_wr        |
<---|o_busy      |
    |            |
 +->|i_clk       |
 |  +------------+

*/

`default_nettype none

module serial_tx #(
    parameter CLK_FREQ      = 48_000_000,               // clock frequency (Hz)
    parameter BAUD_RATE     = 115_200                   // baud rate (bits per second)
) (
    input                   i_clk,                      // system clock
    input                   i_wr,                       // write-request strobe
    input             [7:0] i_data,                     // octet to transmit
    output reg              o_busy,                     // transmitter busy signal
    output                  o_tx                        // transmit line
);
    localparam BAUD_CLKS    = CLK_FREQ / BAUD_RATE;     // clock-cycles per serial bit
    localparam CNT_BITS     = $clog2(BAUD_CLKS);        // bit-width of baud counter

    // transmission start signal
    wire start = (i_wr && !o_busy);

    // clock divider for baud_stb
    reg [CNT_BITS-1:0] baud_cnt = 0;
    always @(posedge i_clk) begin
        if (start) begin
            baud_cnt <= BAUD_CLKS - 1'b1;
        end else if (baud_cnt > 0) begin
            baud_cnt <= baud_cnt - 1'b1;
        end else if (state != STOP) begin
            baud_cnt <= BAUD_CLKS - 1'b1;
        end
    end
    wire baud_stb = (baud_cnt == 0);

    // enumerated values for state
    localparam START        = 4'hF;
    /* 0..7 are bit transmit positions */
    localparam STOP         = 4'h8;

    // bit transmission state-machine
    reg [3:0] state;
    initial { o_busy, state } = { 1'b0, STOP };         // begin in idle/stop state
    always @(posedge i_clk) begin
        if (start) begin
            { o_busy, state } <= { 1'b1, START };       // start transmitting
        end else if (baud_stb) begin
            if (state == STOP) begin                    // stop transmitting (idle)
                o_busy <= 1'b0;                         // clear busy flag
            end else begin
                { o_busy, state } <= { 1'b1, (state + 1'b1) };  // transmit next bit
            end
        end
    end

    // bit transmission shift-register
    reg [8:0] data_sr = 9'h1FF;
    always @(posedge i_clk) begin
        if (start) begin
            data_sr <= { i_data, 1'b0 };                // capture data and send start-bit
        end else if (baud_stb && (state != STOP)) begin
            data_sr <= { 1'b1, data_sr[8:1] };          // shift 1-bits in from MSB
        end
    end

    assign o_tx = data_sr[0];                           // output LSB of shift-register

endmodule
