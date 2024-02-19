/*

Synchronize External Signal to Clock Domain

    +------------+
    | clk_sync   |
    |            |
--->|i_ext  o_reg|--->
    |            |
 +->|i_clk       |
 |  +------------+

*/

`default_nettype none

module clk_sync #(
  parameter STAGES = 3                  // number of FF stages to pass through (>= 2)
) (
  input             i_clk,              // domain clock
  input             i_ext,              // external (unsynchronized) signal
  output            o_reg               // registered (synchronized) signal
);

  reg [STAGES-1:0] stage;  // synchronization shift-register
  initial stage = 0;
  always @(posedge i_clk)
    stage <= { i_ext, stage[STAGES-1:1] };  // enter SR at MSB

  assign o_reg = stage[0];  // exit SR at LSB

endmodule

/*

The internal operation of this module is illustrated below:

        +-----------------------------------------------+
        |                                               |
        |       stage[2]     stage[1]     stage[0]      |
        |       +------+     +------+     +------+      |
  [i_ext>------>|D    Q|---->|D    Q|---->|D    Q|----->[o_reg>
        |       |      |     |      |     |      |      |
        |    +->|CLK   |  +->|CLK   |  +->|CLK   |      |
        |    |  +------+  |  +------+  |  +------+      |
        |    |            |            |                |
  [i_clk>----+------------+------------+                |
        |                                               |
        +-----------------------------------------------+

*/
