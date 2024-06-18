/*

Physical Test Bench for flash.v

*/

`default_nettype none

`include "flash.v"
`include "uart.v"

module top (
    input                   clki,                       // 48MHz oscillator input on Fomu-PVT
    output                  rgb0,                       // RGB LED pin 0 (**DO NOT** drive directly)
    output                  rgb1,                       // RGB LED pin 1 (**DO NOT** drive directly)
    output                  rgb2,                       // RGB LED pin 2 (**DO NOT** drive directly)
    output                  user_1,                     // User I/O Pad #1 (nearest to notch)
    output                  user_2,                     // User I/O Pad #2
    input                   user_3,                     // User I/O Pad #3
    output                  user_4,                     // User I/O Pad #4
    inout                   spi_mosi,                   // SPI controller output
    inout                   spi_miso,                   // SPI controller input
    inout                   spi_clk,                    // SPI controller clock
    output                  spi_cs,                     // SPI chip select
    output                  usb_dp,                     // USB D+
    output                  usb_dn,                     // USB D-
    output                  usb_dp_pu                   // USB D+ pull-up
);
    parameter CLK_48MHz     = 48_000_000;               // clock frequency (Hz)
    parameter CLK_24MHz     = 24_000_000;               // clock frequency (Hz)
    parameter CLK_12MHz     = 12_000_000;               // clock frequency (Hz)

    // disable Fomu USB
    assign usb_dp = 1'b0;
    assign usb_dn = 1'b0;
    assign usb_dp_pu = 1'b0;

    // connect system clock (with buffering)
    reg [1:0] clk_div = 2'b00;
    always @(posedge clki) begin
        clk_div <= clk_div + 1'b1;
    end
    wire clk48;
    SB_GB clk_gb48 (
        .USER_SIGNAL_TO_GLOBAL_BUFFER(clki),            // 48MHz system clock
        .GLOBAL_BUFFER_OUTPUT(clk48)
    );
    wire clk24;
    SB_GB clk_gb24 (
        .USER_SIGNAL_TO_GLOBAL_BUFFER(clk_div[0]),      // divide 48MHz clock down to 24MHz
        .GLOBAL_BUFFER_OUTPUT(clk24)
    );
    wire clk12;
    SB_GB clk_gb12 (
        .USER_SIGNAL_TO_GLOBAL_BUFFER(clk_div[1]),      // divide 48MHz clock down to 12MHz
        .GLOBAL_BUFFER_OUTPUT(clk12)
    );
//    wire clk = clk48;
    wire clk = clk12;

    // connect RGB LED driver (see: FPGA-TN-1288-ICE40LEDDriverUsageGuide.pdf)
    wire led_r;
    wire led_g;
    wire led_b;
    SB_RGBA_DRV #(
        .CURRENT_MODE("0b1"),                           // half current
        .RGB0_CURRENT("0b001111"),                      // 8 mA
        .RGB1_CURRENT("0b000011"),                      // 4 mA
        .RGB2_CURRENT("0b000011")                       // 4 mA
    ) RGBA_DRIVER (
        .CURREN(1'b1),
        .RGBLEDEN(1'b1),
        .RGB0PWM(led_g),                                // green
        .RGB1PWM(led_r),                                // red
        .RGB2PWM(led_b),                                // blue
        .RGB0(rgb0),
        .RGB1(rgb1),
        .RGB2(rgb2)
    );

    // configure SPI pins (master mode)

    wire mi;
    wire mo;
    wire sclk;
    SB_IO #(
        .PIN_TYPE(6'b101001),
    ) miso_io (
        .PACKAGE_PIN(spi_miso),
        .OUTPUT_ENABLE(1'b0),  // input
        .D_IN_0(mi)
    );
    SB_IO #(
        .PIN_TYPE(6'b101001),
    ) mosi_io (
        .PACKAGE_PIN(spi_mosi),
        .OUTPUT_ENABLE(1'b1),  // output
        .D_OUT_0(mo),
    );
    SB_IO #(
        .PIN_TYPE(6'b101001),
        .PULLUP(1'b1)
    ) sck_io (
        .PACKAGE_PIN(spi_clk),
        .OUTPUT_ENABLE(1'b1),  // output
        .D_OUT_0(sclk)
    );

    // instantiate SPI flash controller
    flash #(
//        .CLK_FREQ(CLK_48MHz)
        .CLK_FREQ(CLK_12MHz)
    ) FLASH (
        .i_clk(clk),

        .o_cs(spi_cs),
        .o_copi(mo),
        .i_cipo(mi),
        .o_sclk(sclk),

        .i_en(flash_en),
        .i_wr(flash_wr),
        .i_addr(flash_addr),
        .i_data(flash_wdata),

        .o_data(flash_rdata)
    );
    wire flash_en;
    wire flash_wr;
    wire [3:0] flash_addr;
    wire [7:0] flash_wdata;
    wire [7:0] flash_rdata;

    // designate user i/o pins
    assign user_1 = 1'b0;                               // GND
//    assign user_2 = 1'b1;                               // TX (configured below)
//    assign user_3 = 1'b0;                               // RX (configured below)
    assign user_4 = 1'b1;                               // 3v3 (weak)

    localparam SB_IO_TYPE_SIMPLE_OUTPUT = 6'b011000;
    wire serial_tx;                                     // TX
    SB_IO #(
        .PIN_TYPE(SB_IO_TYPE_SIMPLE_OUTPUT)
    ) user_2_io (
        .PACKAGE_PIN(user_2),
        .OUTPUT_ENABLE(1'b1), // FIXME: is this needed?
        .OUTPUT_CLK(clk),
        .D_OUT_0(serial_tx),
    );

    localparam SB_IO_TYPE_SIMPLE_INPUT = 6'b000001;
    wire serial_rx;                                     // RX
    SB_IO #(
        .PIN_TYPE(SB_IO_TYPE_SIMPLE_INPUT),
        .PULLUP(1'b1)
    ) user_3_io (
        .PACKAGE_PIN(user_3),
        .OUTPUT_ENABLE(1'b0), // FIXME: is this needed?
        .INPUT_CLK(clk),
        .D_IN_0(serial_rx),
    );

    // start-up delay
    reg run = 1'b0;
    reg [5:0] waiting = 0;
    always @(posedge clk) begin
        if (!run) begin                                 // wait for overflow
            {run, waiting} <= {1'b0, waiting} + 1'b1;
        end
    end

    // UART device "registers"
    localparam TX_RDY       = 4'h0;                     // ready to transmit
    localparam TX_DAT       = 4'h1;                     // data to transmit
    localparam RX_RDY       = 4'h2;                     // receive complete
    localparam RX_DAT       = 4'h3;                     // data received

    // instantiate UART
    uart #(
//        .CLK_FREQ(CLK_48MHz)
        .CLK_FREQ(CLK_12MHz)
    ) UART (
        .i_clk(clk),
        .i_rx(serial_rx),
        .o_tx(serial_tx),

        .i_en(uart_en),
        .i_wr(uart_wr),
        .i_addr(uart_addr),
        .i_data(uart_wdata),

        .o_data(uart_rdata)
    );
    wire uart_en = (state == 1)
                || (state == 3)
                || (state == 5)
                || (state == 7);
    wire uart_wr = (state == 7);
    wire [3:0] uart_addr =
        ( state == 1 ? RX_RDY
        : state == 3 ? RX_DAT
        : state == 5 ? TX_RDY
        : state == 7 ? TX_DAT
        : 4'h0 );
    wire [7:0] uart_wdata =
        ( state == 7 : buffer
        : 8'h00 );
    wire [7:0] uart_rdata;

    // console echo state-machine
    reg [7:0] buffer = 0;
    reg [2:0] state = 0;
    always @(posedge clk) begin
        if (state == 0) begin                           // wait for init
            state <= run ? 1 : 0;
        end else if (state == 1) begin                  // read rx status
            state <= 2;
        end else if (state == 2) begin                  // wait for rx ready
            state <= uart_rdata ? 3 : 1;
        end else if (state == 3) begin                  // read rx data
            state <= 4;
        end else if (state == 4) begin                  // copy to buffer
            buffer <= uart_rdata;
            state <= 5;
        end else if (state == 5) begin                  // read tx status
            state <= 6;
        end else if (state == 6) begin                  // wait for tx ready
            state <= uart_rdata ? 7 : 5;
        end else if (state == 7) begin                  // write tx data
            state <= 1;
        end
    end

    // drive LEDs
    assign led_r = !serial_tx;
    assign led_g = !serial_rx;
//    assign led_b = run;

endmodule
