/*

UART (Univeral Asynchronous Receiver/Transmitter)

    +---------------+
    | uart          |
    |               |
--->|i_en           |
--->|i_wr           |
=4=>|i_addr         |
=8=>|i_data   o_data|=8=>
    |               |
 +->|i_clk          |
 |  +---------------+

This component manages a serial tranmitter and receiver,
providing a "memory-mapped" register interface. When
`i_en` is asserted, the register selected on `i_addr`
is written/read based on `i_wr`. `i_data` provides the
data to be written. `o_data` provides the data read
on the previous clock-cycle.

*/

`default_nettype none

`include "../lib/serial_tx.v"
`include "../lib/serial_rx.v"

module uart #(
    parameter CLK_FREQ      = 48_000_000,               // clock frequency (Hz)
    parameter BAUD_RATE     = 115_200                   // baud rate (bits per second)
) (
    input                   i_clk,                      // system clock
    input                   i_rx,                       // serial port transmit
    output                  o_tx,                       // serial port receive
    input                   i_en,                       // device enable
    input                   i_wr,                       // {0:read, 1:write}
    input             [3:0] i_addr,                     // {0:TX_RDY, 1:TX_DAT, 2:RX_RDY, 3:RX_DAT}
    input             [7:0] i_data,                     // data to write
    output reg        [7:0] o_data                      // last data read
);

    // instantiate serial transmitter
    reg tx_wr = 1'b1;//1'b0;
    reg [7:0] tx_data = "k"; // FIXME: continuous stream of 'k' characters...
    wire tx_busy;
    serial_tx #(
        .CLK_FREQ(CLK_FREQ),
        .BAUD_RATE(BAUD_RATE)
    ) SER_TX (
        .i_clk(i_clk),
        .i_wr(tx_wr),
        .i_data(tx_data),
        .o_busy(tx_busy),
        .o_tx(o_tx)
    );

    // instantiate serial receiver
    wire rx_wr;
    wire [7:0] rx_data;
    serial_rx #(
        .CLK_FREQ(CLK_FREQ),
        .BAUD_RATE(BAUD_RATE)
    ) SER_RX (
        .i_clk(i_clk),
        .i_rx(i_rx),
        .o_wr(rx_wr),
        .o_data(rx_data)
    );

    reg rx_ready = 1'b0;                                // character in buffer
    reg [7:0] rx_buffer;                                // character received
    /*
    reg rx_ready = 1'b1;                                // character in buffer (prefilled)
    reg [7:0] rx_buffer = 8'h7E;                        // character received (prefilled)
    */

    // device "registers"
    localparam TX_RDY       = 4'h0;                     // ready to transmit
    localparam TX_DAT       = 4'h1;                     // data to transmit
    localparam RX_RDY       = 4'h2;                     // receive complete
    localparam RX_DAT       = 4'h3;                     // data received

    always @(posedge i_clk) begin
        if (rx_wr) begin
            rx_ready <= 1'b1;
            rx_buffer <= rx_data;
        end
        if (i_en) begin
            if (i_wr) begin
                if (i_addr == TX_DAT) begin
                    ;
                end
            end else begin
                if (i_addr == TX_RDY) begin
                    o_data <= {8{!tx_busy}};
                end else if (i_addr == RX_RDY) begin
                    o_data <= {8{rx_ready}};
                end else if (i_addr == RX_DAT) begin
                    o_data <= rx_wr ? rx_data : rx_buffer;
                    rx_ready <= 1'b0;
                end
            end
        end
    end

endmodule
