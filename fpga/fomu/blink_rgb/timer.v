/*

Free-Running Timer Component

*/

`default_nettype none

module timer #(
    parameter WIDTH             = 28,                   // width of counter chain
    parameter BITS              = 1                     // number of timer output bits
) (
    input                       i_clk,                  // system clock
    output           [BITS-1:0] o_data                  // timer output bits
);

    // establish free-running counter
    reg [WIDTH-1:0] counter = 0;
    always @(posedge i_clk) begin
        counter <= counter + 1'b1;
    end

    assign o_data = counter[WIDTH-1:WIDTH-BITS];

endmodule
