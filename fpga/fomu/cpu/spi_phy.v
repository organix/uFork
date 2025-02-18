/*

SPI (Serial Peripheral Interface) -- physical layer

    +-------------------+
    | spi_phy           |
    |                   |
  x-|s_cs           i_wr|<---
<---|s_clk       i_wdata|<=8=
<---|s_copi        o_bsy|--->
--->|s_cipo      o_rdata|=8=>
    |                   |
 +->|i_clk              |
 |  +-------------------+

 SPI Mode: 0 (CPOL=0, CPHA=0)
 https://www.analog.com/en/resources/analog-dialogue/articles/introduction-to-spi-interface.html
         _   _   _   _   _   _   _   _   _   _   _   _   _   _   _   _   _   _   _   _
 i_clk  | |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_| |_
        _____                                                                     ______
 s_cs        \___________________________________________________________________/
                  ___     ___     ___     ___     ___     ___     ___     ___
 s_clk  _________/   \___/   \___/   \___/   \___/   \___/   \___/   \___/   \__________
              _______ _______ _______ _______ _______ _______ _______ _______
 s_copi #####X__o7___X__o6___X__o5___X__o4___X__o3___X__o2___X__o1___X__o0___X##########
              _______ _______ _______ _______ _______ _______ _______ _______
 s_cipo #####X__i7___X__i6___X__i5___X__i4___X__i3___X__i2___X__i1___X__i0___X##########
        :   :   :   :   :   :   :   :   :   :   :   :   :   :   :   :   :   :   :   :

https://wavedrom.com/
{signal: [
  {name: 'clk',  wave: 'P...................'},
  {name: 'cs',   wave: '10................1.'},
  {name: 'sclk', wave: '0.1010101010101010..'},
  {name: 'copi', wave: 'x=.=.=.=.=.=.=.=.x..', data: ['o7', 'o6', 'o5', 'o4', 'o3', 'o2', 'o1', 'o0']},
  {name: 'cipo', wave: 'x=.=.=.=.=.=.=.=.x..', data: ['i7', 'i6', 'i5', 'i4', 'i3', 'i2', 'i1', 'i0']},
]}

*/

`default_nettype none

module spi_phy #(
    parameter CPOL          = 1'b0,                     // sclk polarity
    parameter CPHA          = 1'b0,                     // sclk phase
    parameter WIDTH         = 8                         // data bus width (in bits)
) (
    input                   i_clk,                      // system clock

//    output reg              s_cs,                       // serial chip select --- externally controlled
    output reg              s_clk,                      // serial clock
    output                  s_copi,                     // serial controller out / peripheral in
    input                   s_cipo,                     // serial controller in / peripheral out

    input                   i_wr,                       // write command
    input       [WIDTH-1:0] i_wdata,                    // data to be sent
    output                  o_bsy,                      // transmitter is busy
    output      [WIDTH-1:0] o_rdata                     // data received
);
    localparam COUNT_WIDTH  = $clog2(WIDTH-1);

    // bit countdown
    reg [COUNT_WIDTH-1:0] bit_count = 0;

    // initialize output registers
    initial s_clk = 1'b0;

    reg [WIDTH-1:0] data_sr = 0;                        // data shift-register
    reg data_in = 0;                                    // input data sample

    assign s_copi = data_sr[WIDTH-1];                   // transmit high-bit of shift-register
    assign o_rdata = data_sr;                           // expose data received
    assign o_bsy = (state != IDLE);                     // transmitter is busy if not idle

    // enumerated values for state
    localparam IDLE         = 2'h0;
    localparam SAMPLE       = 2'h1;
    localparam SHIFT        = 2'h2;

    // state-machine
    reg [1:0] state = IDLE;                             // initial state
    always @(posedge i_clk) begin
        case (state)
            IDLE: begin
                if (i_wr) begin
                    data_sr <= i_wdata;                 // parallel load shift-register
                    bit_count <= WIDTH-1;
                    state <= SAMPLE;
                end
            end
            SAMPLE: begin
                s_clk <= 1'b1;                          // sample edge
                data_in <= s_cipo;
                state <= SHIFT;
            end
            SHIFT: begin
                s_clk <= 1'b0;                          // shift edge
                data_sr <= { data_sr[WIDTH-2:0], data_in };
                if (bit_count != 0) begin
                    bit_count <= bit_count - 1;
                    state <= SAMPLE;
                end else begin
                    state <= IDLE;
                end
            end
            default: begin
                s_clk <= 1'b0;
                state <= IDLE;
            end
        endcase
    end

endmodule
