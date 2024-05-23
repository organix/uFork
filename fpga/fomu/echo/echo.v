`default_nettype none
`timescale 10ns/1ns

module echo;
    localparam STDIN = 32'h8000_0000;
    localparam STDOUT = 32'h8000_0001;
    localparam STDERR = 32'h8000_0002;

    // dump simulation signals
    initial begin
        $dumpfile("echo.vcd");
        $dumpvars(0, echo);
        #10;
        $finish;
    end

    // generate chip clock
    reg clk = 0;
    always begin
        #1 clk = !clk;
    end

    reg [8:0] char = 0; // 9'b1 indicates error, possibly EOF
    always @(posedge clk) begin
        char = $fgetc(STDIN);               // read a char
        $fwrite(STDOUT, "%c", char[7:0]);   // write a char
    end
endmodule
