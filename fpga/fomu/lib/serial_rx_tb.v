/*

Test Bench for serial_rx.v

*/

`default_nettype none

`include "serial_rx.v"

`timescale 1us/10ns

module test_bench;

    // dump simulation signals
    initial begin
        $dumpfile("serial_rx.vcd");
        $dumpvars(0, test_bench);
        #1600;
        $finish;
    end

    // generate chip clock (500KHz simulation time)
    reg clk = 0;
    always begin
        #1 clk = !clk;
    end

    parameter CLK_FREQ      = 500_000;                  // clock frequency (Hz)
    parameter BAUD_RATE     = 115_200;                  // baud rate (bits per second)

    // uart signals
    wire uart_rx;
    wire rx_wr;
    wire [7:0] rx_data;

    // instantiate serial receiver
    serial_rx #(
        .CLK_FREQ(CLK_FREQ),
        .BAUD_RATE(BAUD_RATE)
    ) SER_RX (
        .i_clk(clk),
        .i_rx(uart_rx),
        .o_wr(rx_wr),
        .o_data(rx_data)
    );

    // baud counter to stretch simulated input
    localparam BAUD_CLKS = CLK_FREQ / BAUD_RATE;
    localparam CNT_BITS = $clog2(BAUD_CLKS);
    reg [CNT_BITS-1:0] baud_cnt = BAUD_CLKS - 1;
    always @(posedge clk) begin
        if (baud_cnt > 0) begin
            baud_cnt <= baud_cnt - 1'b1;
        end else begin
            baud_cnt <= BAUD_CLKS - 1;
        end
    end

    // produce test signal
    /*
    _____       ___________       _____             _____       __________
         \_____/           \_____/     \___________/     \_____/         
    IDLE |START|  1  |  1  |  0  |  1  |  0  |  0  |  1  |  0  |STOP |IDLE
    */
    reg [11:0] signal = 12'b101101001011;               // ASCII "K"
    reg [3:0] sample = 0;                               // signal sample counter
    always @(posedge clk) begin
        if (baud_cnt == 0) begin
            if (sample == 0) begin
                sample <= 11;
            end else begin
                sample <= sample - 1'b1;
            end
        end
    end
    assign uart_rx = signal[sample];

endmodule
