/*

Physical Test Bench for cpu.v

*/

`default_nettype none

`include "cpu.v"

module top (
    input                   clki,                       // 48MHz oscillator input on Fomu-PVT
    output                  rgb0,                       // RGB LED pin 0 (**DO NOT** drive directly)
    output                  rgb1,                       // RGB LED pin 1 (**DO NOT** drive directly)
    output                  rgb2,                       // RGB LED pin 2 (**DO NOT** drive directly)
    output                  user_1,                     // User I/O Pad #1 (nearest to notch)
    output                  user_2,                     // User I/O Pad #2
    input                   user_3,                     // User I/O Pad #3
    output                  user_4,                     // User I/O Pad #4
    output                  spi_cs,                     // SPI chip select
    output                  spi_mosi,                   // SPI controller output
    input                   spi_miso,                   // SPI controller input
    output                  spi_clk,                    // SPI controller clock
    output                  usb_dp,                     // USB D+
    output                  usb_dn,                     // USB D-
    output                  usb_dp_pu                   // USB D+ pull-up
);
//    parameter CLK_FREQ      = 48_000_000;               // clock frequency (Hz)
    parameter CLK_FREQ      = 12_000_000;               // clock frequency (Hz)

    // disable Fomu USB
    assign usb_dp = 1'b0;
    assign usb_dn = 1'b0;
    assign usb_dp_pu = 1'b0;

    // connect system clock (with buffering)
    reg [1:0] clk_div = 2'b00;
    always @(posedge clki) begin
        clk_div <= clk_div + 1'b1;
    end
    wire clk;
    SB_GB clk_gb (
//        .USER_SIGNAL_TO_GLOBAL_BUFFER(clki),
        .USER_SIGNAL_TO_GLOBAL_BUFFER(clk_div[1]),      // divide 48MHz clock down to 12MHz
        .GLOBAL_BUFFER_OUTPUT(clk)
    );

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

    // designate user i/o pins
    localparam SB_IO_TYPE_SIMPLE_OUTPUT = 6'b011000;
    localparam SB_IO_TYPE_SIMPLE_INPUT = 6'b000001;

    assign user_1 = 1'b0;                               // GND
//    assign user_2 = 1'b1;                               // TX (configured below)
//    assign user_3 = 1'b0;                               // RX (configured below)
    assign user_4 = 1'b1;                               // 3v3 (weak)

    wire serial_tx;                                     // TX
    SB_IO #(
        .PIN_TYPE(SB_IO_TYPE_SIMPLE_OUTPUT)
    ) user_2_io (
        .PACKAGE_PIN(user_2),
        .OUTPUT_ENABLE(1'b1),
        .OUTPUT_CLK(clk),
        .D_OUT_0(serial_tx)
    );

    wire serial_rx;                                     // RX
    SB_IO #(
        .PIN_TYPE(SB_IO_TYPE_SIMPLE_INPUT),
        .PULLUP(1'b1)
    ) user_3_io (
        .PACKAGE_PIN(user_3),
        .OUTPUT_ENABLE(1'b0),
        .INPUT_CLK(clk),
        .D_IN_0(serial_rx)
    );

    // configure SPI Flash pins (master mode)
    wire cs = spi_cs;
    /*
    wire cs;
    SB_IO #(
        .PIN_TYPE(SB_IO_TYPE_SIMPLE_OUTPUT),
        .PULLUP(1'b1)
    ) spi_cs_io (
        .PACKAGE_PIN(spi_cs),
        .OUTPUT_ENABLE(1'b1),
        .OUTPUT_CLK(clk),
        .D_OUT_0(cs)
    );
    */

    wire copi = spi_mosi;
    /*
    wire copi;
    SB_IO #(
        .PIN_TYPE(6'b101001)
//        .PIN_TYPE(SB_IO_TYPE_SIMPLE_OUTPUT)
    ) spi_mosi_io (
        .PACKAGE_PIN(spi_mosi),
        .OUTPUT_ENABLE(1'b1),
        .OUTPUT_CLK(clk),
        .D_OUT_0(copi)
    );
    */

    wire cipo = spi_miso;
    /*
    wire cipo;
    SB_IO #(
        .PIN_TYPE(6'b101001)
//        .PIN_TYPE(SB_IO_TYPE_SIMPLE_INPUT)
    ) spi_miso_io (
        .PACKAGE_PIN(spi_miso),
        .OUTPUT_ENABLE(1'b0),
        .INPUT_CLK(clk),
        .D_IN_0(cipo)
    );
    */

    wire sclk = spi_clk;
    /*
    wire sclk;
    SB_IO #(
        .PIN_TYPE(SB_IO_TYPE_SIMPLE_OUTPUT)
    ) spi_clk_io (
        .PACKAGE_PIN(spi_clk),
        .OUTPUT_ENABLE(1'b1),
        .OUTPUT_CLK(clk),
        .D_OUT_0(sclk)
    );
    */

    // start-up delay
    reg run = 1'b0;
    reg [5:0] waiting = 0;
    always @(posedge clk) begin
        if (!run) begin                                 // wait for overflow
            {run, waiting} <= {1'b0, waiting} + 1'b1;
        end
    end

    // instantiate CPU
    wire running;
    wire passed;
    cpu #(
        .CLK_FREQ(CLK_FREQ)
    ) CPU (
        .i_clk(clk),
        .i_run(run),
        .i_rx(serial_rx),
        .o_tx(serial_tx),
        .o_cs(cs),
        .o_copi(copi),
        .i_cipo(cipo),
        .o_sclk(sclk),
        .o_running(running),
        .o_status(passed)
    );

    // drive LEDs
    assign led_r = !running && !passed;
    assign led_g = !running && passed;
    assign led_b = running;

endmodule
