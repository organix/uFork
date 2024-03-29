/*

Test Bench for led_freq.v

*/

`default_nettype none

`include "clk_div.v"
`include "led_freq.v"

`timescale 10ns/1ns

module test_bench;

    // dump simulation signals
    initial begin
        $dumpfile("led_freq.vcd");
        $dumpvars(0, test_bench);
        #6400;
        $finish;
    end

    // generate chip clock (50MHz simulation time)
    reg clk = 0;
    always begin
        #1 clk = !clk;
    end

    // request changes every 13 clocks
    reg led_req = 1'b1;                                 // requested LED level
    reg [3:0] cnt = 13;
    always @(posedge clk) begin
        if (cnt == 0) begin
            cnt <= 13;                                  // reset counter
            led_req <= !led_req;                        // toggle request
        end else begin
            cnt <= cnt - 1'b1;                          // decrement counter
        end
    end

    // instantiate frequency limiter
    wire led_stb;
    clk_div CLK_DIV (
        .i_clk(clk),
//        .o_clk(led_clk),
        .o_stb(led_stb)
    );
    wire led_act;                                       // actual LED level
    led_freq LED_FREQ (
        .i_clk(clk),
        .i_led(led_req),
        .i_stb(led_stb),
        .o_led(led_act)
    );

endmodule
