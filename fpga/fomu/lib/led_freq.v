/*

46.875 kHz LED Frequency Limiter (Fomu)

    +------------+
    | led_freq   |
    |            |
--->|i_led  o_led|--->
--->|i_stb       |
    |            |
 +->|i_clk       |
 |  +------------+

The specifications for the iCE40 FPGA used in the Fomu
say that the LED signal frequency should stay below 64 kHz.
This module restricts changes in the output
to a maximum frequency of 46.875 kHz, ensuring conformance.
It is designed to be driven by the `clk_div.v` module.

*/

`default_nettype none

module led_freq (
    input                       i_clk,                          // system clock
    input                       i_led,                          // requested LED level
    input                       i_stb,                          // 46.875 kHz clock strobe
    output reg                  o_led                           // actual LED level
);
    parameter CLK_FREQ          = 48_000_000;                   // Fomu clock frequency (Hz)

    // hold changes for 2 strobes
    wire x_led = (o_led != i_led);                              // LED level changed
    reg s1 = 1'b1;
    reg s2 = 1'b1;
    initial o_led = 1'b0;
    always @(posedge i_clk) begin
        if (s1 && s2 && x_led) begin
            s1 <= 1'b0;
            s2 <= 1'b0;
            o_led <= i_led;                                     // accept change after 2 strobes
        end else if (s1 && !s2 && i_stb) begin
            s2 <= 1'b1;                                         // count 2nd strobe
        end else if (!s1 && !s2 && i_stb) begin
            s1 <= 1'b1;                                         // count 1st strobe
        end
    end

endmodule
