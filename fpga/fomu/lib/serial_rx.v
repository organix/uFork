/*

Serial Receiver

    +------------+
    | serial_rx  |
    |            |
--->|i_rx  o_data|=8=>
    |        o_wr|--->
    |            |
 +->|i_clk       |
 |  +------------+

*/

`default_nettype none

module serial_rx #(
    parameter CLK_FREQ      = 48_000_000,               // clock frequency (Hz)
    parameter BAUD_RATE     = 115_200                   // baud rate (bits per second)
) (
    input                   i_clk,                      // system clock
    input                   i_rx,                       // receive line
    output reg              o_wr,                       // write-request strobe
    output reg        [7:0] o_data                      // octet received
);
    localparam BAUD_CLKS    = CLK_FREQ / BAUD_RATE;
    localparam BAUD_BITS    = $clog2(BAUD_CLKS);
    localparam HALFBIT_TIME = BAUD_CLKS >> 1;
    localparam FULLBIT_TIME = BAUD_CLKS - 1;

    // baud-rate countdown timer
    reg [BAUD_BITS-1:0] baud_time = 0;
    wire baud_zero = (baud_time == 0);                  // timer stopped

    // sync external input with local clock
    reg r_rx, s_rx, rx;
    initial { rx, s_rx, r_rx } = -1;                    // line is high during IDLE
    always @(posedge i_clk) begin
        { rx, s_rx, r_rx } <= { s_rx, r_rx, i_rx };
    end

    // initialize output registers
    initial o_data = 0;
    initial o_wr = 1'b0;

    // enumerated values for state
    localparam START        = 4'hF;
    /* 0..7 are bit receive positions */
    localparam STOP         = 4'h8;
    localparam IDLE         = 4'hC;

    // state-machine
    reg [3:0] state = IDLE;                             // initial state
    always @(posedge i_clk) begin
        if (!baud_zero) begin
            baud_time <= baud_time - 1'b1;
        end else begin
            case (state)
                IDLE: begin
                    o_wr <= 1'b0;                       // clear write strobe
                    if (!rx) begin                      // possible start-bit
                        baud_time <= HALFBIT_TIME;
                        state <= START;
                    end
                end
                START: begin
                    if (rx) begin                       // not a start-bit!
                        state <= IDLE;
                    end else begin                      // start-bit confirmed
                        baud_time <= FULLBIT_TIME;
                        state <= 0;                     // look for bit 0
                    end
                end
                STOP: begin                             // stop-bit received
                    o_wr <= 1'b1;                       // set write strobe
                    state <= IDLE;                      // wait for next start-bit
                end
                default: begin                          // data-bit received
                    o_data <= { rx, o_data[7:1] };      // shift into MSB
                    baud_time <= FULLBIT_TIME;
                    state <= state + 1;                 // advance to next bit
                end
            endcase
        end
    end

endmodule
