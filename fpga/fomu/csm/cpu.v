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
`include "../lib/serial_tx.v"
`include "../lib/serial_rx.v"

module cpu #(
    parameter CLK_FREQ      = 48_000_000                // clock frequency (Hz)
) (
    input                   i_clk,                      // system clock
    input                   i_run,                      // run the processor
    input                   i_rx,                       // serial port transmit
    output                  o_tx,                       // serial port receive
    output                  o_running,                  // processor active
    output reg              o_status                    // final status
);

    initial o_status = 1'b1;                            // default to success

    parameter DATA_SZ       = 16;                       // number of bits per memory word
    parameter ADDR_SZ       = 10;                       // number of bits in each address
    parameter MEM_MAX       = (1<<ADDR_SZ);             // maximum memory memory address
    parameter PAD_ADDR      = (DATA_SZ-ADDR_SZ);        // number of padding bits from addr to data

    // symbolic constants
    localparam FALSE        = 16'h0000;                 // Boolean FALSE = 0
    localparam TRUE         = 16'hFFFF;                 // Boolean TRUE = -1

    // uCode instructions
    localparam UC_NOP       = 16'h0000;                 // ( -- )
    localparam UC_ADD       = 16'h0001;                 // + ( a b -- a+b )
    localparam UC_AND       = 16'h0002;                 // AND ( a b -- a&b )
    localparam UC_XOR       = 16'h0003;                 // XOR ( a b -- a^b )
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
    localparam UC_EXIT      = 16'h000F;                 // ( -- ) R:( addr -- ) addr->pc

    localparam UC_LIT       = 16'h0020;                 // (LIT) item ( -- item )
    //dat("R>", "DUP", "1+", ">R", "@", "EXIT");
    localparam UC_SUB       = 16'h0021;                 // - ( a b -- a-b )
    //dat("NEGATE", "+", "EXIT")
    localparam UC_OR        = 16'h0022;                 // OR ( a b -- a|b )
    //dat("INVERT", "SWAP", "INVERT");
    //def("NAND"); // ( a b -- not(a & b)
    //dat("&", "INVERT", "EXIT");
    localparam UC_NOT       = 16'h0023;                 // INVERT ( a -- ~a )
    //dat("TRUE", "XOR", "EXIT");
    localparam UC_NEG       = 16'h0024;                 // NEGATE ( a -- -a )
    //dat("ZERO", "SWAP", "SUB", "EXIT");
    //dat("INVERT", "1+", "EXIT");
    localparam UC_DEC       = 16'h0025;                 // 1- ( a -- a-1 )
    //dat("ONE", "SUB", "EXIT");
    //dat("NEGATE", "1+", "NEGATE", "EXIT");
    localparam UC_NIP       = 16'h0026;                 // ( a b -- b )
    //dat("SWAP", "DROP", "EXIT");
    localparam UC_TUCK      = 16'h0027;                 // ( a b -- b a b )
    localparam UC_2DUP      = 16'h0028;                 // ( a b -- a b a b )
    //dat("OVER", "OVER", "EXIT");
    localparam UC_2DROP     = 16'h0029;                 // ( a b -- )
    //dat("DROP", "DROP", "EXIT");
    localparam UC_OVER      = 16'h002A;                 // ( a b -- a b a )
    //dat(">R", "DUP", "R>", "SWAP", "EXIT");

    localparam UC_RX_OK     = 16'h003C;                 // rx? ( -- ready )
    localparam UC_GET_RX    = 16'h003D;                 // rx@ ( -- char )
    localparam UC_TX_OK     = 16'h003E;                 // tx? ( -- ready )
    localparam UC_SET_TX    = 16'h003F;                 // tx! ( char -- )

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
    localparam UC_BOOT      = 16'hF000;
    localparam UC_JMP       = 16'hF080;
    localparam UC_EXE       = 16'hF082;
    localparam UC_ALT       = 16'hF084;                 // ( altn cnsq cond -- cnsq | altn )
    localparam UC_CONST     = 16'hF088;
    localparam UC_TRUE      = 16'hF08B;                 // ( -- -1 )
    localparam UC_FALSE     = 16'hF08D;                 // ( -- 0 )
//    localparam UC_INVERT    = 16'hF08F;                 // ( a -- ~a )
//    localparam UC_LIT       = 16'hF092;                 // (LIT) item ( -- item )
//    localparam UC_NEGATE    = 16'hF098;                 // ( a -- -a )
//    localparam UC_DEC       = 16'hF09B;                 // 1- ( a -- a-1 )
//    localparam UC_SUB       = 16'hF09F;                 // - ( a b -- a+b )
    localparam UC_LSB       = 16'hF0A2;                 // ( -- 1 )
    localparam UC_MSB       = 16'hF0A4;                 // ( -- -32768 )

    // initial program
    initial begin
        ucode[8'h00] = UC_NOP;
        ucode[8'h01] = UC_JMP;
        ucode[8'h02] = UC_BOOT;
        //
        // ...
        //
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
        // (LIT) item ( -- item )
        ucode[8'h92] = UC_R_POP;
        ucode[8'h93] = UC_DUP;
        ucode[8'h94] = UC_INC;
        ucode[8'h95] = UC_PUSH_R;
        ucode[8'h96] = UC_FETCH;
        ucode[8'h97] = UC_EXIT;
        // NEGATE ( a -- -a )
        ucode[8'h98] = UC_NOT;//UC_INVERT;
        ucode[8'h99] = UC_INC;
        ucode[8'h9A] = UC_EXIT;
        // DEC ( a -- a-1 )
        ucode[8'h9B] = UC_NEG;//UC_NEGATE;
        ucode[8'h9C] = UC_INC;
        ucode[8'h9D] = UC_NEG;//UC_NEGATE;
        ucode[8'h9E] = UC_EXIT;
        // SUB ( a b -- a-b )
        ucode[8'h9F] = UC_NEG;//UC_NEGATE;
        ucode[8'hA0] = UC_ADD;
        ucode[8'hA1] = UC_EXIT;
        // LSB ( -- 1 )
        ucode[8'hA2] = UC_CONST;
        ucode[8'hA3] = 16'h0001;
        // MSB ( -- -32768 )
        ucode[8'hA4] = UC_CONST;
        ucode[8'hA5] = 16'h8000;
        /*
        */
    end

    //
    // evaluation (data) stack
    //

    reg [DATA_SZ-1:0] d_value = 0;
    reg d_push = 1'b0;
    reg d_pop = 1'b0;
    wire [DATA_SZ-1:0] d0;
    wire [DATA_SZ-1:0] d1;

    lifo #(
        .WIDTH(DATA_SZ)
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

    reg [DATA_SZ-1:0] r_value = 0;
    reg r_push = 1'b0;
    reg r_pop = 1'b0;
    wire [DATA_SZ-1:0] r0;
    wire [DATA_SZ-1:0] r1;

    lifo #(
        .WIDTH(DATA_SZ)
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

    reg [ADDR_SZ-1:0] pc = 0;
    reg [DATA_SZ-1:0] opcode = UC_NOP;

    reg halt = 1'b0;
    /*
    reg [7:0] tick = 0;                                 // "watchdog" timer
    always @(posedge i_clk) begin
        tick <= tick + 1'b1;
        halt <= (tick > 16);
    end
    */

    assign o_running = i_run && o_status && !halt;

    reg [1:0] phase = 0;
    always @(posedge i_clk) begin
        uc_wr <= 1'b0;
        d_push <= 1'b0;
        d_pop <= 1'b0;
        r_push <= 1'b0;
        r_pop <= 1'b0;
        alu_op <= `NO_OP;
        tx_wr <= 1'b0;
        case (phase)
            0: begin                                    // fetch
                if (o_running) begin
                    // wait for memory cycle...
                    phase <= 1;
                end
            end
            1: begin                                    // decode
                phase <= 2;
                case (uc_rdata)
                    UC_ADD: begin                       // + ( a b -- a+b )
                        alu_op <= `ADD_OP;
                        alu_arg0 <= d1;
                        alu_arg1 <= d0;
                        d_pop <= 1'b1;
                    end
                    UC_AND: begin                       // AND ( a b -- a&b )
                        alu_op <= `AND_OP;
                        alu_arg0 <= d1;
                        alu_arg1 <= d0;
                        d_pop <= 1'b1;
                    end
                    UC_XOR: begin                       // XOR ( a b -- a^b )
                        alu_op <= `XOR_OP;
                        alu_arg0 <= d1;
                        alu_arg1 <= d0;
                        d_pop <= 1'b1;
                    end
                    UC_ROL: begin                       // ( a -- {a[14:0],a[15]} )
                        alu_op <= `ROL_OP;
                        alu_arg0 <= d0;
                    end
                    UC_INC: begin                       // 1+ ( a -- a+1 )
                        alu_op <= `ADD_OP;
                        alu_arg0 <= d0;
                        alu_arg1 <= 16'h0001;
                    end
                    UC_FETCH: begin                     // @ ( addr -- cell )
                        uc_raddr <= d0[ADDR_SZ-1:0];
                    end
                    UC_STORE: begin                     // ! ( cell addr -- )
                        uc_waddr <= d0[ADDR_SZ-1:0];
                        uc_wdata <= d1;
                        uc_wr <= 1'b1;
                        d_pop <= 1'b1;                  // pop d-stack twice (in 2 separate phases)
                    end
                    UC_SWAP: begin                      // ( a b -- b a )
                        alu_op <= `NO_OP;
                        alu_arg0 <= d0;                 // pass b thru ALU
                        d_pop <= 1'b1;
                    end
                    UC_SUB: begin                       // - ( a b -- a-b )
                        alu_op <= `SUB_OP;
                        alu_arg0 <= d1;
                        alu_arg1 <= d0;
                        d_pop <= 1'b1;
                    end
                    UC_OR: begin                        // OR ( a b -- a|b )
                        alu_op <= `OR_OP;
                        alu_arg0 <= d1;
                        alu_arg1 <= d0;
                        d_pop <= 1'b1;
                    end
                    UC_NOT: begin                       // INVERT ( a -- ~a )
                        alu_op <= `XOR_OP;
                        alu_arg0 <= d0;
                        alu_arg1 <= 16'hFFFF;
                    end
                    UC_NEG: begin                       // NEGATE ( a -- -a )
                        alu_op <= `SUB_OP;
                        alu_arg0 <= 16'h0000;
                        alu_arg1 <= d0;
                    end
                    UC_DEC: begin                       // 1- ( a -- a-1 )
                        alu_op <= `SUB_OP;
                        alu_arg0 <= d0;
                        alu_arg1 <= 16'h0001;
                    end
                endcase
                opcode <= uc_rdata;
                pc <= pc + 1'b1;
            end
            2: begin                                    // execute
                phase <= 3;
                case (opcode)
                    UC_NOP: begin                       // ( -- )
                    end
                    UC_ADD: begin                       // + ( a b -- a+b )
                        d_value <= alu_data;
                        d_pop <= 1'b1;
                        d_push <= 1'b1;
                    end
                    UC_AND: begin                       // AND ( a b -- a&b )
                        d_value <= alu_data;
                        d_pop <= 1'b1;
                        d_push <= 1'b1;
                    end
                    UC_XOR: begin                       // XOR ( a b -- a^b )
                        d_value <= alu_data;
                        d_pop <= 1'b1;
                        d_push <= 1'b1;
                    end
                    UC_ROL: begin                       // ( a -- {a[14:0],a[15]} )
                        d_value <= alu_data;
                        d_pop <= 1'b1;
                        d_push <= 1'b1;
                    end
                    UC_INC: begin                       // 1+ ( a -- a+1 )
                        d_value <= alu_data;
                        d_pop <= 1'b1;
                        d_push <= 1'b1;
                    end
                    UC_FETCH: begin                     // @ ( addr -- cell )
                        // wait for memory cycle...
                    end
                    UC_STORE: begin                     // ! ( cell addr -- )
                        d_pop <= 1'b1;                  // pop d-stack twice (in 2 separate phases)
                    end
                    UC_DUP: begin                       // ( a -- a a )
                        d_value <= d0;
                        d_push <= 1'b1;
                    end
                    UC_DROP: begin                      // ( a -- )
                        d_pop <= 1'b1;
                    end
                    UC_SWAP: begin                      // ( a b -- b a )
                        alu_op <= `NO_OP;
                        alu_arg0 <= d0;                 // pass a thru ALU
                        d_value <= alu_data;            // replace a with b
                        d_pop <= 1'b1;
                        d_push <= 1'b1;
                    end
                    UC_SKZ: begin                       // ( cond -- ) cond==0?pc+2:pc+1->pc
                        if (d0 == 0) begin
                            pc <= pc + 1'b1;
                        end
                        d_pop <= 1'b1;
                    end
                    UC_PUSH_R: begin                    // >R ( a -- ) R:( -- a )
                        r_value <= d0;
                        d_pop <= 1'b1;
                        r_push <= 1'b1;
                    end
                    UC_R_POP: begin                     // R> ( -- a ) R:( a -- )
                        d_value <= r0;
                        r_pop <= 1'b1;
                        d_push <= 1'b1;
                    end
                    UC_EXIT: begin                      // ( -- ) R:( addr -- ) addr->pc
                        pc <= r0[ADDR_SZ-1:0];
                        r_pop <= 1'b1;
                    end
                    UC_SUB: begin                       // - ( a b -- a-b )
                        d_value <= alu_data;
                        d_pop <= 1'b1;
                        d_push <= 1'b1;
                    end
                    UC_OR: begin                        // OR ( a b -- a|b )
                        d_value <= alu_data;
                        d_pop <= 1'b1;
                        d_push <= 1'b1;
                    end
                    UC_NOT: begin                       // INVERT ( a -- ~a )
                        d_value <= alu_data;
                        d_pop <= 1'b1;
                        d_push <= 1'b1;
                    end
                    UC_NEG: begin                       // NEGATE ( a -- -a )
                        d_value <= alu_data;
                        d_pop <= 1'b1;
                        d_push <= 1'b1;
                    end
                    UC_DEC: begin                       // 1- ( a -- a-1 )
                        d_value <= alu_data;
                        d_pop <= 1'b1;
                        d_push <= 1'b1;
                    end
                    UC_RX_OK: begin                     // rx? ( -- ready )
                        d_value <= (rx_ready ? TRUE : FALSE);
                        d_push <= 1'b1;
                    end
                    UC_GET_RX: begin                    // rx@ ( -- char )
                        d_value <= { {(DATA_SZ-8){1'b0}}, rx_buffer };
                        rx_ready <= 1'b0;
                        d_push <= 1'b1;
                    end
                    UC_TX_OK: begin                     // tx? ( -- ready )
                        d_value <= (tx_busy ? FALSE : TRUE);
                        d_push <= 1'b1;
                    end
                    UC_SET_TX: begin                    // tx! ( char -- )
                        tx_data <= d0[7:0];
                        tx_wr <= 1'b1;
                        d_pop <= 1'b1;
                    end
                    default: begin
                        if (opcode[DATA_SZ-1]) begin    // CALL ( -- ) R:( -- pc ) @pc->pc
                            r_value <= { {PAD_ADDR{1'b1}}, pc };
                            r_push <= 1'b1;
                            pc <= opcode[ADDR_SZ-1:0];
                        end else begin
                            o_status <= 1'b0;           // register failure
                        end
                    end
                endcase
            end
            3: begin                                    // write-back & next
                phase <= 0;
                case (opcode)
                    UC_FETCH: begin                     // @ ( addr -- cell )
                        d_value = uc_rdata;
                        d_push = 1'b1;
                    end
                    UC_SWAP: begin                      // ( a b -- b a )
                        d_value <= alu_data;            // push a
                        d_push <= 1'b1;
                    end
                endcase
                uc_raddr <= pc;
            end
            default: begin
                o_status <= 1'b0;                       // register failure
            end
        endcase
    end

    //
    // serial port UART
    //

    parameter BAUD_RATE     = 115_200;                  // baud rate (bits per second)

    // instantiate serial transmitter
    reg tx_wr = 1'b0;
    reg [7:0] tx_data;
    wire tx_busy;
    serial_tx #(
        .CLK_FREQ(CLK_FREQ),
        .BAUD_RATE(BAUD_RATE)
    ) SER_TX (
        .i_clk(i_clk),
        .i_wr(tx_wr),
        .i_data(tx_data),
        .o_busy(tx_busy),
        .o_tx(o_tx)
    );

    // instantiate serial receiver
    wire rx_wr;
    wire [7:0] rx_data;
    serial_rx #(
        .CLK_FREQ(CLK_FREQ),
        .BAUD_RATE(BAUD_RATE)
    ) SER_RX (
        .i_clk(i_clk),
        .i_rx(i_rx),
        .o_wr(rx_wr),
        .o_data(rx_data)
    );

    reg rx_ready = 1'b0;                                // character in buffer
    reg [7:0] rx_buffer;                                // character received
    always @(posedge i_clk) begin
        if (rx_wr) begin
            rx_ready <= 1'b1;
            rx_buffer <= rx_data;
        end
    end

endmodule
