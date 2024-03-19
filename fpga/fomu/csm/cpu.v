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

The CPU runs when `i_run` is asserted.
`o_running` is asserted while the CPU is active.
Once `o_running` is de-asserted,
the value of `o_status` indicates success (1) or failure (0).

*/

`default_nettype none

//`include "../lib/bram.v"
//`include "../lib/spram.v"
`include "../lib/lifo.v"
`include "lifo.v"
`include "alu.v"
//`include "alu_nr.v"
//`include "../lib/serial_tx.v"
//`include "../lib/serial_rx.v"

// Memory Ranges
`define MEM_UC  (3'h0)      // uCode memory
`define MEM_PC  (3'h1)      // contents of PC+1 & increment
//`define MEM_TBD (3'h2)      // RESERVED
`define MEM_DEV (3'h3)      // memory-mapped devices
`define MEM_Q_T (3'h4)      // uFork quad-memory field T
`define MEM_Q_X (3'h5)      // uFork quad-memory field X
`define MEM_Q_Y (3'h6)      // uFork quad-memory field Y
`define MEM_Q_Z (3'h7)      // uFork quad-memory field Z

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
    parameter MEM_MAX       = (1<<ADDR_SZ);             // maximum memory address
    parameter PAD_ADDR      = (DATA_SZ-ADDR_SZ);        // number of padding bits from addr to data

    // symbolic constants
    localparam FALSE        = 16'h0000;                 // Boolean FALSE = 0
    localparam TRUE         = 16'hFFFF;                 // Boolean TRUE = -1

    // uCode instructions
    localparam UC_NOP       = 16'h0000;                 // ( -- )
    localparam UC_ADD       = 16'h0741;                 // + ( a b -- a+b )
    localparam UC_AND       = 16'h0744;                 // AND ( a b -- a&b )
    localparam UC_XOR       = 16'h0745;                 // XOR ( a b -- a^b )
    localparam UC_ROL       = 16'h0307;                 // ( a -- {a[14:0],a[15]} )
    localparam UC_INC       = 16'h0311;                 // 1+ ( a -- a+1 )
    localparam UC_FETCH     = 16'h030F;                 // @ ( addr -- cell )
    localparam UC_STORE     = 16'h098F;                 // ! ( cell addr -- )
    localparam UC_DUP       = 16'h0200;                 // ( a -- a a )
    localparam UC_DROP      = 16'h0100;                 // ( a -- )
    localparam UC_SWAP      = 16'h0400;                 // ( a b -- b a )
    localparam UC_TO_R      = 16'h2100;                 // >R ( a -- ) R:( -- a )
    localparam UC_R_FROM    = 16'h1280;                 // R> ( -- a ) R:( a -- )
    localparam UC_EXIT      = 16'h5000;                 // ( -- ) R:( addr -- ) addr->pc

    localparam UC_LIT       = 16'h021F;                 // (LIT) item ( -- item )
    localparam UC_SUB       = 16'h0742;                 // - ( a b -- a-b )
    localparam UC_OR        = 16'h0746;                 // OR ( a b -- a|b )
    localparam UC_NOT       = 16'h0335;                 // INVERT ( a -- ~a )
    localparam UC_NEG       = 16'h03C2;                 // NEGATE ( a -- -a )
    localparam UC_DEC       = 16'h0312;                 // 1- ( a -- a-1 )
    localparam UC_OVER      = 16'h0240;                 // ( a b -- a b a )
    localparam UC_ROT       = 16'h0500;                 // ( a b c -- b c a )
//    localparam UC_R_SWAP    = 16'h002C;                 // ( -- ) R:( a b -- b a )
    localparam UC_R_FETCH   = 16'h0280;                 // R@ ( -- a ) R:( a -- a )
    localparam UC_2MUL      = 16'h0301;                 // 2* ( a -- a+a )

    /*
    localparam UC_RX_OK     = 16'h003C;                 // rx? ( -- ready )
    localparam UC_GET_RX    = 16'h003D;                 // rx@ ( -- char )
    localparam UC_TX_OK     = 16'h003E;                 // tx? ( -- ready )
    localparam UC_SET_TX    = 16'h003F;                 // tx! ( char -- )
    */

    localparam UC_CALL      = 16'hC000;                 // <addr> ( -- ) R:( -- pc+1 ) @pc->pc

    //
    // uCode program memory
    //

    wire uc_wr;                                         // write/_read request
    wire [ADDR_SZ-1:0] uc_waddr;                        // write address
    wire [DATA_SZ-1:0] uc_wdata;                        // data to write
    wire [ADDR_SZ-1:0] uc_raddr;                        // read address
    reg [DATA_SZ-1:0] uc_rdata;                         // last data read

    reg [DATA_SZ-1:0] ucode [0:MEM_MAX-1];              // inferred block ram
    always @(posedge i_clk) begin
        if (uc_wr) begin                                // write conditionally
            ucode[uc_waddr] <= uc_wdata;
        end else begin
            uc_rdata <= ucode[uc_raddr];                // only read if not writing
        end
        /*
        uc_rdata <= ucode[uc_raddr];                    // read always
        */
    end

    // uCode word definitions
    localparam UC_BOOT      = 16'hC000;
    localparam UC_JMP       = 16'hC080;
    localparam UC_EXE       = 16'hC082;
    localparam UC_ALT       = 16'hC084;                 // ( altn cnsq cond -- cnsq | altn )
    localparam UC_CONST     = 16'hC088;
    localparam UC_TRUE      = 16'h02F6;                 // ( -- -1 )
    localparam UC_FALSE     = 16'h02C0;                 // ( -- 0 )
    localparam UC_LSB       = 16'h02D6;                 // ( -- 1 )
    localparam UC_MSB       = 16'h02E6;                 // ( -- -32768 )
    localparam UC_NIP       = 16'hC124;                 // ( a b -- b )
    localparam UC_TUCK      = 16'hC127;                 // ( a b -- b a b )
    localparam UC_2DUP      = 16'hC12A;                 // ( a b -- a b a b )
    localparam UC_2DROP     = 16'hC12D;                 // ( a b -- )

    // initial program
    initial begin
        ucode[12'h000] = UC_TRUE;//16'h8020;
        ucode[12'h001] = UC_DUP;
        ucode[12'h002] = UC_DEC;
        ucode[12'h003] = UC_AND;
        ucode[12'h004] = UC_NOT;
        ucode[12'h005] = UC_DROP;
        ucode[12'h006] = 16'h8000;                      // jump $000
        ucode[12'h007] = UC_NOP;
        ucode[12'h008] = UC_JMP;//16'h8000;
        ucode[12'h009] = UC_BOOT;
        //
        // ...
        //
        ucode[12'h010] = UC_LSB;
        ucode[12'h011] = UC_DUP;
        ucode[12'h012] = UC_INC;
        ucode[12'h013] = UC_DUP;
        ucode[12'h014] = UC_2MUL;
        ucode[12'h015] = UC_DEC;
        ucode[12'h016] = UC_ROT;
        ucode[12'h017] = UC_SWAP;
        ucode[12'h018] = UC_OVER;
        ucode[12'h019] = 16'h8000;                      // jump $000
        //
        // ...
        //
        ucode[12'h01D] = UC_CONST;
        ucode[12'h01E] = 16'h001F;
        ucode[12'h01F] = 3;
        ucode[12'h020] = 16'hC01D;                      // $01F
        ucode[12'h021] = UC_FETCH;                      // 3=@$01F
        ucode[12'h022] = UC_NOP;                        // cnt=3
        ucode[12'h023] = UC_DEC;                        // cnt=cnt-1
        ucode[12'h024] = 16'hC01D;                      // cnt $01F
        ucode[12'h025] = UC_STORE;                      // --
        ucode[12'h026] = 16'hC01D;                      // $01F
        ucode[12'h027] = UC_FETCH;                      // 3=@$01F
        ucode[12'h028] = UC_DROP;                       // --
        ucode[12'h029] = 16'h8000;                      // jump $000
        //
        // ...
        //
        // JMP
        ucode[12'h080] = UC_R_FROM;
        ucode[12'h081] = UC_FETCH;
        // EXE
        ucode[12'h082] = UC_TO_R;
        ucode[12'h083] = UC_EXIT;
        /*
        // ALT ( altn cnsq cond -- cnsq | altn )
        ucode[12'h084] = UC_SKZ;
        ucode[12'h085] = UC_SWAP;
        ucode[12'h086] = UC_DROP;
        ucode[12'h087] = UC_EXIT;
        */
        // CONST
        ucode[12'h088] = UC_R_FROM;
        ucode[12'h089] = UC_FETCH;
        ucode[12'h08A] = UC_EXIT;
        /*
        // TRUE ( -- -1 )
        ucode[12'h08B] = UC_CONST;
        ucode[12'h08C] = 16'hFFFF;
        // FALSE ( -- 0 )
        ucode[12'h08D] = UC_CONST;
        ucode[12'h08E] = 16'h0000;
        */
        // LSB ( -- 1 )
        //ucode[12'h08F] = UC_CONST;
        //ucode[12'h090] = 16'h0001;
        // MSB ( -- -32768 )
        //ucode[12'h091] = UC_CONST;
        //ucode[12'h092] = 16'h8000;
        //
        // ...
        //
        // NIP ( a b -- b )
        ucode[12'h124] = UC_SWAP;
        ucode[12'h125] = UC_DROP;
        ucode[12'h126] = UC_EXIT;
        // TUCK ( a b -- b a b )
        ucode[12'h127] = UC_SWAP;
        ucode[12'h128] = UC_OVER;
        ucode[12'h129] = UC_EXIT;
        // 2DUP ( a b -- a b a b )
        ucode[12'h12A] = UC_OVER;
        ucode[12'h12B] = UC_OVER;
        ucode[12'h12C] = UC_EXIT;
        // 2DROP ( a b -- )
        ucode[12'h12D] = UC_DROP;
        ucode[12'h12E] = UC_DROP;
        ucode[12'h12F] = UC_EXIT;
        /*
        $writememh("ucode_rom.mem", ucode);
        */
    end

    //
    // control (return) stack
    //

    lifo #(
        .WIDTH(DATA_SZ)
    ) R_STACK (
        .i_clk(i_clk),

        .i_data(r_value),
        .i_push(r_se[1]),
        .i_pop(r_se[0]),

        .o_s0(r0),
        .o_s1(r1)
    );

    //
    // evaluation (data) stack
    //

    lifo_se #(
        .WIDTH(DATA_SZ)
    ) D_STACK (
        .i_clk(i_clk),

        .i_data(d_value),
        .i_se(d_se),

        .o_s0(d0),
        .o_s1(d1)
    );

    //
    // arithmetic/logical unit
    //

    alu #(
        .WIDTH(DATA_SZ)
    ) ALU (
        .i_clk(i_clk),

        .i_op(alu_fn),
        .i_arg0(alu_arg0),
        .i_arg1(alu_arg1),

        .o_data(alu_out)
    );

    //
    // uCode execution engine
    //

    reg halt = 1'b0;
    /*
    reg [7:0] tick = 0;                                 // "watchdog" timer
    always @(posedge i_clk) begin
        tick <= tick + 1'b1;
        halt <= (tick > 32);
    end
    */
    assign o_running = i_run && o_status && !halt;

    reg [ADDR_SZ-1:0] pc = 0;
    reg [DATA_SZ-1:0] instr_1 = UC_NOP;
    wire [DATA_SZ-1:0] instr =                          // current instruction
        ( p_alu ? uc_rdata
        : instr_1 );
    wire ctrl = instr[15];                              // {0:evaluation, 1:control-transfer}
    wire r_pc = instr[14];                              // PC <-> R interaction
    wire [1:0] r_op = instr[13:12];                     // R-stack operation
    wire d_drop = instr[11];                            // extra D-stack DROP
    wire [2:0] d_op = instr[10:8];                      // D-stack operation
    wire [1:0] alu_a = ( ctrl ? 2'b00 : instr[7:6] );   // left ALU input selector
    wire [1:0] alu_b = ( ctrl ? r_op : instr[5:4] );    // right ALU input selector
    wire [3:0] alu_op = instr[3:0];                     // ALU operation
    wire mem_op = !ctrl && (alu_op == `MEM_OP);         // ALU bypass for MEM ops
    wire mem_wr = instr[7];                             // {0:read, 1:write} MEM
    wire mem_rng = instr[6:4];                          // MEM range selector
    wire d_zero = (d0 == 0);                            // zero check for TOS
    wire c_branch = (r_op == 2'b00 || d_zero);          // ctrl branch taken
    wire ext_addr = p_alu && mem_op
        && (d0[DATA_SZ-1:DATA_SZ-PAD_ADDR] != 0);       // address outside uCode memory


    assign uc_wr =
        ( p_alu && mem_op ? mem_wr
        : 1'b0 );
    assign uc_waddr =
        ( p_alu && mem_op ? d0[ADDR_SZ-1:0]
        : -1 );
    assign uc_wdata =
        ( p_alu && mem_op ? d1
        : -1 );
    assign uc_raddr =
        ( p_alu && mem_op ? d0[ADDR_SZ-1:0]
        : pc );

    wire [DATA_SZ-1:0] r_value =
        ( ctrl ?
            ( p_alu && r_pc ? pc
            : 0 )
        : mem_op ? uc_rdata
        : alu_out );
    wire [2:0] r_se =
        ( ctrl ?
            ( p_alu && r_pc ? `PUSH_SE
            : `NO_SE )
        : !p_alu ? r_op
        : `NO_SE );
    wire [DATA_SZ-1:0] r0;
    wire [DATA_SZ-1:0] r1;

    wire [DATA_SZ-1:0] d_value =
        ( mem_op ? uc_rdata
        : alu_out );
    wire [2:0] d_se =
        ( ctrl ?
            ( p_alu && c_branch && r_op != 2'b00 ? `DROP_SE
            : !p_alu && !c_branch ?
                ( r_op == 2'b00 ? `NO_SE
                : r_op == 2'b10 ? `DROP_SE
                : `RPLC_SE )
            : `NO_SE )
        : p_alu && d_drop ? `DROP_SE
        : !p_alu ? d_op
        : `NO_SE );
    wire [DATA_SZ-1:0] d0;
    wire [DATA_SZ-1:0] d1;

    wire [3:0] alu_fn =
        ( ctrl ? `ADD_OP
        : alu_op );
    wire [DATA_SZ-1:0] alu_arg0 =
        ( alu_a == 2'b01 ? d1
        : alu_a == 2'b10 ? r0
        : alu_a == 2'b11 ? 0
        : d0 );
    wire [DATA_SZ-1:0] alu_arg1 =
        ( alu_b == 2'b01 ? 1
        : alu_b == 2'b10 ? 16'h8000
        : alu_b == 2'b11 ? -1
        : d0 );
    wire [DATA_SZ-1:0] alu_out;

    reg p_alu = 0;                                      // 0: stack-phase, 1: alu-phase
    always @(posedge i_clk) begin
        if (ext_addr) begin
            o_status <= 1'b0;                           // signal failure
        end else if (p_alu) begin
            if (mem_op && mem_rng == `MEM_PC) begin
                pc <= pc + 1'b1;                        // auto-increment on [PC] access
            end else if (ctrl && c_branch) begin
                pc <= instr[ADDR_SZ-1:0];               // jump or call procedure
            end else if (!ctrl && r_pc) begin
                pc <= r0[ADDR_SZ-1:0];                  // return from procedure
            end
            instr_1 <= uc_rdata;
            p_alu <= !p_alu;
        end else if (o_running) begin
            pc <= pc + 1'b1;                            // default next PC
            p_alu <= !p_alu;
        end
    end

/*
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
*/

endmodule
