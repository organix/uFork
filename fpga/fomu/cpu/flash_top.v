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
    reg led_r = 0;
    reg led_g = 0;
    reg led_b = 0;
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
        .o_ack(flash_ack),
        .i_addr(flash_addr),
        .i_data(flash_wdata),

        .o_data(flash_rdata)
    );
    reg flash_en;
    reg flash_wr;
    wire flash_ack;
    reg [3:0] flash_addr;
    reg [7:0] flash_wdata;
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
    reg uart_en = 1'b0;
    reg uart_wr = 1'b0;
    reg [3:0] uart_addr;
    reg [7:0] uart_wdata;
    wire [7:0] uart_rdata;

    // flash dump FSM
    reg [7:0] delay = 0;
    reg [7:0] state = 0;
    reg [7:0] accum = 0;
    reg [7:0] linkr = 0;
    reg [7:0] temp0 = 0;
    reg [7:0] temp1 = 0;
    wire [7:0] hex0 = {4'b000, accum[3:0]} + (accum[3:0] < 4'h0A ? "0" : ("A" - 10));
    wire [7:0] hex1 = {4'b000, accum[7:4]} + (accum[7:4] < 4'h0A ? "0" : ("A" - 10));
    always @(posedge clk) begin
        if (delay > 0) begin
            delay <= delay - 1'b1;
        end else if (state == 8'h00) begin              // wait for init
            state <= run ? 8'h01 : 8'h00;
        end else if (state == 8'h01) begin
            delay <= 8'hFF;
            state <= 8'h02;
        end else if (state == 8'h02) begin
            {led_r, led_g, led_b} <= 3'b001;
            state <= 8'h03;
        end else if (state == 8'h03) begin              // wait for key
            //linkr <= 8'h04;
            linkr <= 8'h08;
            state <= 8'h88;
        end else if (state == 8'h04) begin
            accum <= `SPI_CR0;
            linkr <= 8'h05;
            state <= 8'h20;
        end else if (state == 8'h05) begin
            accum <= `SPI_CR1;
            linkr <= 8'h06;
            state <= 8'h20;
        end else if (state == 8'h06) begin
            accum <= `SPI_CR2;
            linkr <= 8'h07;
            state <= 8'h20;
        end else if (state == 8'h07) begin
            state <= 8'h10;
        end else if (state == 8'h08) begin              // set and check control register 1
            accum <= `SPI_CR1;
            linkr <= 8'h09;
            state <= 8'h20;
        end else if (state == 8'h09) begin
            flash_wdata <= 8'b1000_0000;
            accum <= `SPI_CR1;
            linkr <= 8'h0A;
            state <= 8'h29;
        end else if (state == 8'h0A) begin
            accum <= `SPI_CR1;
            linkr <= 8'h0B;
            state <= 8'h20;
        end else if (state == 8'h0B) begin
            flash_wdata <= 8'b0000_0000;
            accum <= `SPI_CR1;
            linkr <= 8'h0C;
            state <= 8'h29;
        end else if (state == 8'h0C) begin
            accum <= `SPI_CR1;
            linkr <= 8'h10;
            state <= 8'h20;
        end else if (state == 8'h10) begin              // echo loop
            linkr <= 8'h11;
            state <= 8'h88;
        end else if (state == 8'h11) begin
            state <= (accum == 8'h1B ? 8'h7F : 8'h12);
        end else if (state == 8'h12) begin
            state <= (accum == 8'h03 ? 8'hFF : 8'h13);
        end else if (state == 8'h13) begin              // emit hex
            temp0 <= {4'b000, accum[7:4]};
            temp1 <= {4'b000, accum[3:0]};
            state <= 8'h14;
        end else if (state == 8'h14) begin
            uart_wdata <= hex1;//temp0 + (temp0 < 8'h0A ? "0" : ("A" - 10));
            uart_wr <= 1'b1;
            uart_addr <= TX_DAT;
            uart_en <= 1'b1;
            state <= 8'h15;
            /*
            accum <= temp0 + (temp0 < 8'h0A ? "0" : ("A" - 10));
            linkr <= 8'h15;
            state <= 8'h80;
            */
        end else if (state == 8'h15) begin
            uart_wdata <= hex0;//temp1 + (temp1 < 8'h0A ? "0" : ("A" - 10));
            //uart_wr <= 1'b1;
            //uart_addr <= TX_DAT;
            //uart_en <= 1'b1;
            state <= 8'h16;
            /*
            accum <= temp1 + (temp1 < 8'h0A ? "0" : ("A" - 10));
            linkr <= 8'h16;
            state <= 8'h80;
            */
        end else if (state == 8'h16) begin
            uart_wr <= 1'b0;
            uart_en <= 1'b0;
            /*
            */
            accum <= 8'h0D;
            state <= 8'h18;
        end else if (state == 8'h18) begin              // emit char
            linkr <= 8'h19;
            state <= 8'h80;
        end else if (state == 8'h19) begin
            state <= (accum == 8'h0D ? 8'h1A : 8'h1F);
        end else if (state == 8'h1A) begin
            accum <= 8'h0A;
            linkr <= 8'h1F;
            state <= 8'h80;
        end else if (state == 8'h1F) begin
            state <= 8'h10;
        end else if (state == 8'h20) begin              // dump SPI register
            flash_addr <= accum;
            flash_en <= 1'b1;
            state <= 8'h21;
        end else if (state == 8'h21) begin
            //accum <= flash_rdata;
            //flash_en <= 1'b0;
            temp0 <= (flash_ack ? "+" : "-");
            state <= 8'h22;
        end else if (state == 8'h22) begin
            accum <= flash_rdata;
            flash_en <= 1'b0;
            temp1 <= (flash_ack ? "+" : "-");
            state <= 8'h23;
        end else if (state == 8'h23) begin
            uart_wdata <= hex1;
            uart_wr <= 1'b1;
            uart_addr <= TX_DAT;
            uart_en <= 1'b1;
            state <= 8'h24;
        end else if (state == 8'h24) begin
            uart_wdata <= hex0;
            state <= 8'h25;
        end else if (state == 8'h25) begin
            uart_wdata <= temp0;
            state <= 8'h26;
        end else if (state == 8'h26) begin
            uart_wdata <= temp1;
            state <= 8'h27;
        end else if (state == 8'h27) begin
            uart_wdata <= 8'h0D;
            state <= 8'h28;
        end else if (state == 8'h28) begin
            uart_wdata <= 8'h0A;
            state <= 8'h2F;
        end else if (state == 8'h29) begin              // write SPI register
            // asssume flash_wdata is already loaded
            flash_addr <= accum;
            flash_wr <= 1'b1;
            flash_en <= 1'b1;
            uart_wdata <= "*";
            uart_wr <= 1'b1;
            uart_addr <= TX_DAT;
            uart_en <= 1'b1;
            state <= 8'h2A;
        end else if (state == 8'h2A) begin
            //flash_en <= 1'b0;
            temp0 <= (flash_ack ? "+" : "-");
            uart_wdata <= hex1;
            state <= 8'h2B;
        end else if (state == 8'h2B) begin
            flash_en <= 1'b0;
            temp1 <= (flash_ack ? "+" : "-");
            uart_wdata <= hex0;
            state <= 8'h25;
        end else if (state == 8'h2F) begin
            uart_wr <= 1'b0;
            uart_en <= 1'b0;
            state <= linkr;
        end else if (state == 8'h7F) begin
            state <= 8'hFE;
        end else if (state == 8'h80) begin              // putchar
            uart_addr <= TX_RDY;
            uart_en <= 1'b1;
            state <= 8'h81;
        end else if (state == 8'h81) begin
            uart_en <= 1'b0;
            state <= 8'h82;
        end else if (state == 8'h82) begin
            state <= (uart_rdata ? 8'h84 : 8'h80);
        end else if (state == 8'h84) begin
            uart_wdata <= accum;
            uart_wr <= 1'b1;
            uart_addr <= TX_DAT;
            uart_en <= 1'b1;
            state <= 8'h85;
        end else if (state == 8'h85) begin
            uart_wr <= 1'b0;
            uart_en <= 1'b0;
            state <= 8'h86;
        end else if (state == 8'h86) begin
            state <= linkr;
        end else if (state == 8'h88) begin              // getchar
            uart_addr <= RX_RDY;
            uart_en <= 1'b1;
            state <= 8'h89;
        end else if (state == 8'h89) begin
            uart_en <= 1'b0;
            state <= 8'h8A;
        end else if (state == 8'h8A) begin
            state <= (uart_rdata ? 8'h8C : 8'h88);
        end else if (state == 8'h8C) begin
            uart_addr <= RX_DAT;
            uart_en <= 1'b1;
            state <= 8'h8D;
        end else if (state == 8'h8D) begin
            uart_en <= 1'b0;
            state <= 8'h8E;
        end else if (state == 8'h8E) begin
            accum <= uart_rdata;
            state <= linkr;
        end else if (state == 8'hFE) begin              // Success!
            {led_r, led_g, led_b} <= 3'b010;
            state <= 8'hFE;
        end else begin                                  // FAILURE!
            {led_r, led_g, led_b} <= 3'b100;
            state <= 8'hFF;
        end
    end

endmodule
