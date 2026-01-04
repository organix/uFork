/*

USB UART (USB-CDC ACM serial bridge)

    +-------------------+
    | usb_uart          |
    |                   |
--->|i_en          dp_rx|<---
--->|i_wr          dn_rx|<---
=4=>|i_addr        dp_pu|--->
=8=>|i_data        tx_en|--->
<=8-|o_data        dp_tx|--->
    |              dn_tx|--->
--->|i_rstn             |
 +->|i_clk_12   i_clk_48|<-+
 |  +-------------------+  |

This component manages a serial transmitter and receiver,
providing a "memory-mapped" register interface. When
`i_en` is asserted, the register selected on `i_addr`
is written/read based on `i_wr`. `i_data` provides the
data to be written. `o_data` provides the data read
on the previous clock-cycle.

*/

`default_nettype none

`include "../../usb_cdc/lib/usb_lib.v"
//`include "../lib/fifo.v" -- included in `cpu.v`

module usb_uart #(
    parameter BAUD_RATE     = 115_200                   // baud rate (bits per second)
) (
    input                   i_clk_48,                   // 48MHz transceiver clock
    input                   dp_rx,                      // USB D+ receive
    input                   dn_rx,                      // USB D- receive
    output                  dp_pu,                      // USB D+ pull-up
    output                  tx_en,                      // USB transmit enable
    output                  dp_tx,                      // USB D+ transmit
    output                  dn_tx,                      // USB D- transmit

    input                   i_rstn,                     // reset (active low)
    input                   i_clk_12,                   // 12MHz system clock
    input                   i_en,                       // device enable
    input                   i_wr,                       // {0:read, 1:write}
    input             [3:0] i_addr,                     // {0:TX_RDY, 1:TX_DAT, 2:RX_RDY, 3:RX_DAT}
    input             [7:0] i_data,                     // data to write
    output reg        [7:0] o_data                      // last data read
);
    wire i_clk = i_clk_12;                              // system clock

    // instantiate USB-CDC module
   usb_cdc #(
        .VENDORID(16'h1209),
        .PRODUCTID(16'h5BF0),
        .IN_BULK_MAXPACKETSIZE('d8),
        .OUT_BULK_MAXPACKETSIZE('d8),
        .BIT_SAMPLES('d4),
        .USE_APP_CLK(1),
        .APP_CLK_FREQ(12)  // 12MHz
   ) usb_cdc (
        // transceiver interface (48MHz)
        .clk_i(i_clk_48),
        .dp_rx_i(dp_rx),
        .dn_rx_i(dn_rx),
        .dp_pu_o(dp_pu),
        .tx_en_o(tx_en),
        .dp_tx_o(dp_tx),
        .dn_tx_o(dn_tx),
        // application interface (12MHz)
        .rstn_i(i_rstn),
        .app_clk_i(i_clk_12),
        //.frame_o(),
        //.configured_o(),
        .in_data_i(in_data),
        .in_valid_i(in_valid),
        .in_ready_o(in_ready),
        .out_data_o(out_data),
        .out_valid_o(out_valid),
        .out_ready_i(out_ready)
    );
    wire [7:0] in_data;
    wire in_valid = !tx_empty;
    wire in_ready;
    wire [7:0] out_data;
    wire out_valid;
    wire out_ready = !rx_full;

    // instantiate receive fifo
    fifo #(
        .DATA_SZ(8),
        .ADDR_SZ(8)
    ) RX_FIFO (
        .i_clk(i_clk),
        // from USB
        .i_wr(out_valid),
        .i_data(out_data),
        .o_full(rx_full),
        // to CPU
        .i_rd(rx_rd),
        .o_data(rx_data),
        .o_empty(rx_empty)
    );
    wire rx_full;
    wire rx_rd = i_en && !i_wr && i_addr == RX_DAT;
    wire [7:0] rx_data;
    wire rx_empty;

    // instantiate transmit fifo
    fifo #(
        .DATA_SZ(8),
        .ADDR_SZ(8)
    ) TX_FIFO (
        .i_clk(i_clk),
        // from CPU
        .i_wr(tx_wr),
        .i_data(tx_data),
        .o_full(tx_full),
        // to USB
        .i_rd(in_ready),
        .o_data(in_data),
        .o_empty(tx_empty)
    );
    wire tx_wr = i_en && i_wr && i_addr == TX_DAT;
    wire [7:0] tx_data = i_data;
    wire tx_full;
    wire tx_empty;

    // device "registers"
    localparam TX_RDY       = 4'h0;                     // ready to transmit
    localparam TX_DAT       = 4'h1;                     // data to transmit
    localparam RX_RDY       = 4'h2;                     // receive complete
    localparam RX_DAT       = 4'h3;                     // data received

    always @(posedge i_clk) begin
        if (i_en && !i_wr) begin
            if (i_addr == TX_RDY) begin
                o_data <= {8{!tx_full}};
            end else if (i_addr == RX_RDY) begin
                o_data <= {8{!rx_empty}};
            end else if (i_addr == RX_DAT) begin
                o_data <= rx_data;
            end
        end
    end

endmodule
