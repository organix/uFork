/*

uCode Central Processing Unit (CPU)

    +-------------------+
    | cpu               |
    |                   |
--->|i_run     o_running|--->
    |           o_status|--->
    |                   |
 +->|i_clk              |
 |  +-------------------+

The CPU runs when `i_run` is asserted. `o_running` is asserted while the CPU is active.
Once `o_running` is de-asserted, the value of `o_status` indicates success (1) or failure (0).

*/

`default_nettype none

`include "../lib/lifo.v"
`include "alu.v"

module cpu (
    input                   i_clk,                      // system clock
    input                   i_run,                      // run the processor
    output                  o_running,                  // processor active
    output reg              o_status                    // final status
);
    parameter DATA_SZ       = 16;                       // number of bits per memory word
    parameter ADDR_SZ       = 8;                        // number of bits in each address
    parameter MEM_MAX       = (1<<ADDR_SZ);             // maximum memory memory address

    // uCode instructions
    localparam UC_NOP       = 16'h0000;                 // ( -- )
    localparam UC_ADD       = 16'h0001;                 // + ( a b -- a+b )
    localparam UC_AND       = 16'h0002;                 // & ( a b -- a&b )
    localparam UC_XOR       = 16'h0003;                 // ^ ( a b -- a^b )
    localparam UC_ROL       = 16'h0004;                 // ( a -- {a[14:0],a[15]} )
    localparam UC_INC       = 16'h0005;                 // 1+ ( a -- a+1 )
    localparam UC_FETCH     = 16'h0006;                 // @ ( addr -- cell )
    localparam UC_STORE     = 16'h0007;                 // ! ( cell addr -- )
    localparam UC_DUP       = 16'h0008;                 // ( a -- a a )
    localparam UC_DROP      = 16'h0009;                 // ( a -- )
    localparam UC_SWAP      = 16'h000A;                 // ( a b -- b a )
    localparam UC_SKZ       = 16'h000B;                 // ( cond -- ) cond==0?pc+2:pc+1->pc
    localparam UC_PUSH_R    = 16'h000C;                 // >R ( a -- ) R:( -- a )
    localparam UC_R_POP     = 16'h000D;                 // R> ( -- a ) R:( a -- )
    localparam UC_000E      = 16'h000E;
    localparam UC_EXIT      = 16'h000F;                 // ( -- ) R:( raddr -- ) raddr->pc
    localparam UC_CALL      = 16'hFFC0;                 // ( -- ) R:( -- pc ) @pc[15:8]->pc

    //
    // uCode program memory
    //

    reg [DATA_SZ-1:0] ucode [0:MEM_MAX-1];              // inferred block ram
    reg uc_wr = 0;                                      // write/_read request
    reg [ADDR_SZ-1:0] uc_waddr;                         // write address
    reg [DATA_SZ-1:0] uc_wdata;                         // data to write
    reg [ADDR_SZ-1:0] uc_raddr = 0;                     // read address
    reg [DATA_SZ-1:0] uc_rdata;                         // last data read
    always @(posedge i_clk) begin
        // write conditionally
        if (uc_wr) begin
            ucode[uc_waddr] <= uc_wdata;
        end
        // read always
        uc_rdata <= ucode[uc_raddr];
    end

    // uCode word definitions
    localparam UC_BOOT      = 16'h0080;
    localparam UC_JMP       = 16'h8080;
    localparam UC_EXE       = 16'h8280;
    localparam UC_ALT       = 16'h8480;                 // ( altn cnsq cond -- cnsq | altn )
    localparam UC_CONST     = 16'h8880;
    localparam UC_TRUE      = 16'h8B80;                 // ( -- -1 )
    localparam UC_FALSE     = 16'h8D80;                 // ( -- 0 )
    localparam UC_INVERT    = 16'h8F80;                 // ( a -- ~a )
    localparam UC_LIT       = 16'h9280;                 // LIT item ( -- item )
    localparam UC_NEGATE    = 16'h9880;                 // ( a -- -a )
    localparam UC_DEC       = 16'h9B80;                 // 1- ( a -- a-1 )
    localparam UC_SUB       = 16'h9F80;                 // - ( a b -- a+b )

    // initial program
    initial begin
        ucode[8'h00] = UC_NOP;
        ucode[8'h01] = UC_JMP;
        ucode[8'h02] = UC_BOOT;
        // JMP
        ucode[8'h80] = UC_R_POP;
        ucode[8'h81] = UC_FETCH;
        // EXE
        ucode[8'h82] = UC_PUSH_R;
        ucode[8'h83] = UC_EXIT;
        // ALT ( altn cnsq cond -- cnsq | altn )
        ucode[8'h84] = UC_SKZ;
        ucode[8'h85] = UC_SWAP;
        ucode[8'h86] = UC_DROP;
        ucode[8'h87] = UC_EXIT;
        // CONST
        ucode[8'h88] = UC_R_POP;
        ucode[8'h89] = UC_FETCH;
        ucode[8'h8A] = UC_EXIT;
        // TRUE ( -- -1 )
        ucode[8'h8B] = UC_CONST;
        ucode[8'h8C] = 16'hFFFF;
        // FALSE ( -- 0 )
        ucode[8'h8D] = UC_CONST;
        ucode[8'h8E] = 16'h0000;
        // INVERT ( a -- ~a )
        ucode[8'h8F] = UC_TRUE;
        ucode[8'h90] = UC_XOR;
        ucode[8'h91] = UC_EXIT;
        // LIT item ( -- item )
        ucode[8'h92] = UC_R_POP;
        ucode[8'h93] = UC_DUP;
        ucode[8'h94] = UC_INC;
        ucode[8'h95] = UC_PUSH_R;
        ucode[8'h96] = UC_FETCH;
        ucode[8'h97] = UC_EXIT;
        // NEGATE ( a -- -a )
        ucode[8'h98] = UC_INVERT;
        ucode[8'h99] = UC_INC;
        ucode[8'h9A] = UC_EXIT;
        // DEC ( a -- a-1 )
        ucode[8'h9B] = UC_NEGATE;
        ucode[8'h9C] = UC_INC;
        ucode[8'h9D] = UC_NEGATE;
        ucode[8'h9E] = UC_EXIT;
        // SUB ( a b -- a-b )
        ucode[8'h9F] = UC_NEGATE;
        ucode[8'hA0] = UC_ADD;
        ucode[8'hA1] = UC_EXIT;
        /*
        */
    end

    //
    // evaluation (data) stack
    //

    reg [15:0] d_value = 16'h0000;
    reg d_push = 1'b0;
    reg d_pop = 1'b0;
    wire [15:0] d0;
    wire [15:0] d1;

    lifo #(
        .WIDTH(16)
    ) D_STACK (
        .i_clk(i_clk),

        .i_data(d_value),
        .i_push(d_push),
        .i_pop(d_pop),

        .o_s0(d0),
        .o_s1(d1)
    );

    //
    // control (return) stack
    //

    reg [15:0] r_value = 16'h0000;
    reg r_push = 1'b0;
    reg r_pop = 1'b0;
    wire [15:0] r0;
    wire [15:0] r1;

    lifo #(
        .WIDTH(16)
    ) R_STACK (
        .i_clk(i_clk),

        .i_data(r_value),
        .i_push(r_push),
        .i_pop(r_pop),

        .o_s0(r0),
        .o_s1(r1)
    );

    //
    // arithmetic/logical unit
    //

    reg [3:0] alu_op = `NO_OP;
    reg [DATA_SZ-1:0] alu_arg0 = 16'h0000;
    reg [DATA_SZ-1:0] alu_arg1 = 16'h0000;
    wire [DATA_SZ-1:0] alu_data;                        // result value

    alu #(
        .WIDTH(DATA_SZ)
    ) ALU (
        .i_clk(i_clk),

        .i_op(alu_op),
        .i_arg0(alu_arg0),
        .i_arg1(alu_arg1),

        .o_data(alu_data)
    );

    //
    // uCode execution engine
    //

    reg [7:0] pc = 8'h00;
    reg [15:0] opcode = UC_NOP;
    wire is_call = opcode[7];

    assign o_running = i_run && o_status;

    reg [1:0] phase = 0;
    always @(posedge i_clk) begin
        uc_wr <= 1'b0;
        d_push <= 1'b0;
        d_pop <= 1'b0;
        r_push <= 1'b0;
        r_pop <= 1'b0;
        alu_op <= `NO_OP;
        case (phase)
            0: begin                                    // fetch
                if (o_running) begin
                    phase <= 1;
                end
            end
            1: begin                                    // decode
                opcode <= uc_rdata;
                pc <= pc + 1'b1;
                phase <= 2;
            end
            2: begin                                    // execute
                case (opcode)
                    UC_NOP: begin
                        phase <= 3;
                    end
                    default: begin
                        if (is_call) begin
                            // ( -- ) R:( -- pc ) @pc[15:8]->pc
                            r_value <= { pc, 8'h80 };
                            r_push <= 1'b1;
                            pc <= opcode[15:8];
                        end else begin
                            o_status <= 1'b0;           // register failure
                        end
                        phase <= 3;
                    end
                endcase
            end
            3: begin                                    // next
                if (o_running) begin
                    uc_raddr <= pc;
                end
                phase <= 0;
            end
            default: begin
                o_status <= 1'b0;                       // register failure
            end
        endcase
    end

    initial o_status = 1'b1;                            // default to success

endmodule
