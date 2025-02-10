/*

SPI (Serial Peripheral Interface) -- physical layer

    +-------------------+
    | spi_phy           |
    |                   |
<---|s_cs        o_rdata|=8=>
    |              o_rdy|--->
<---|s_clk          i_rd|<---
    |                   |
<---|s_copi        o_bsy|--->
    |               i_wr|<---
--->|s_cipo      i_wdata|<=8=
    |                   |
 +->|i_clk              |
 |  +-------------------+

https://wavedrom.com/
{signal: [
  {name: 'clk',  wave: 'P...................'},
  {name: 'cs',   wave: '10................1.'},
  {name: 'sclk', wave: '0.1010101010101010..'},
  {name: 'copi', wave: 'x=.=.=.=.=.=.=.=.x..', data: ['o7', 'o6', 'o5', 'o4', 'o3', 'o2', 'o1', 'o0']},
  {name: 'cipo', wave: 'x.=.=.=.=.=.=.=.=.x.', data: ['i7', 'i6', 'i5', 'i4', 'i3', 'i2', 'i1', 'i0']},
]}

*/

`default_nettype none

module spi_phy #(
    parameter WIDTH         = 8                         // data bus width (in bits)
) (
    input                   i_clk,                      // system clock

    output reg              s_cs,                       // serial chip select
    output reg              s_clk,                      // serial clock
    output                  s_copi,                     // serial controller out / peripheral in
    input                   s_cipo,                     // serial controller in / peripheral out

    output reg  [WIDTH-1:0] o_rdata                     // data received
    output reg              o_rdy,                      // data is ready
    input                   i_rd,                       // read acknowledgement

    output reg              o_bsy,                      // transmitter is busy
    input                   i_wr,                       // write command
    input       [WIDTH-1:0] i_wdata                     // data to be sent
);
    localparam COUNT_WIDTH  = $clog2(WIDTH-1);

    // bit countdown
    reg [COUNT_WIDTH-1:0] bit_count = 0;

    // initialize output registers
    initial s_cs = 1'b1;
    initial s_clk = 1'b0;
    initial o_rdata = 0;
    initial o_rdy = 1'b0;
    initial o_bsy = 1'b0;

    reg [WIDTH-1:0] rdata_sr = 0;                       // read data shift-register
    reg [WIDTH-1:0] wdata_sr = 0;                       // write data shift-register

    assign s_copi = wdata_sr[WIDTH-1];                  // transmit high-bit of shift-register

    // write buffer
    reg [WIDTH-1:0] wdata = 0;
    always @(posedge i_clk) begin
        if (i_wr && !o_bsy) begin
            wdata <= i_wdata;
            o_bsy <= 1'b1;
        end
    end

    // read buffer
    wire [WIDTH-1:0] rdata = { s_cipo, rdata_sr[WIDTH-1:1] };
    always @(posedge i_clk) begin
        if (i_rd && o_rdy) begin
            o_rdy <= 1'b0;
        end
    end

    // enumerated values for state
    localparam START        = 2'h0;
    localparam SAMPLE       = 2'h1;
    localparam SHIFT        = 2'h2;
    localparam STOP         = 2'h3;

    // state-machine
    reg [1:0] state = START;                            // initial state
    always @(posedge i_clk) begin
        case (state)
            START: begin
                if (o_bsy) begin
                    wdata_sr <= wdata;                  // load shift-register
                    o_bsy <= 1'b0;
                    s_cs <= 1'b0;                       // select peripheral
                    bit_count <= WIDTH-1;
                    state <= SAMPLE;
                end
            end
            SAMPLE: begin
                s_clk <= 1'b1;                          // sample edge
                state <= SHIFT;
            end
            SHIFT: begin
                s_clk <= 1'b0;                          // shift edge
                wdata_sr <= { wdata_sr[WIDTH-2:0], 1'b0 };
                rdata_sr <= rdata;
                if (bit_count != 0) begin
                    bit_count <= bit_count - 1;
                    state <= SAMPLE;
                end else begin
                    o_rdata <= rdata;
                    o_rdy <= 1'b1;
                    if (o_bsy) begin
                        wdata_sr <= wdata;              // reload shift-register
                        o_bsy <= 1'b0;
                        state <= SAMPLE;
                    end else begin
                        state <= STOP;
                    end
                end
            end
            default: begin
                s_cs <= 1'b1;                           // deselect peripheral
                state <= START;
            end
        endcase
    end

endmodule
