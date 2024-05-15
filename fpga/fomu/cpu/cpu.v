/*

uCode Central Processing Unit (CPU)

    +-------------------+
    | cpu               |
    |                   |
--->|i_run     o_running|--->
    |           o_status|--->
    |                   |
    |               i_rx|<---
    |               o_tx|--->
 +->|i_clk              |
 |  +-------------------+

The CPU runs when `i_run` is asserted.
`o_running` is asserted while the CPU is active.
Once `o_running` is de-asserted,
the value of `o_status` indicates success (1) or failure (0).

*/

`default_nettype none

`include "../lib/lifo.v"
`include "lifo.v"
`include "alu.v"
//`include "alu_nr.v"
`include "uart.v"
`ifdef __ICARUS__
`include "quad_mem.v"
`else
`include "quad_spram.v"
//`include "quad_bram.v"
`endif

// Memory Ranges
`define MEM_UC  (3'h0)      // uCode memory
`define MEM_PC  (3'h1)      // contents of PC+1 & increment
`define MEM_ERR (3'h2)      // RESERVED (signals failure)
`define MEM_DEV (3'h3)      // memory-mapped devices
`define MEM_Q_T (3'h4)      // uFork quad-memory field T
`define MEM_Q_X (3'h5)      // uFork quad-memory field X
`define MEM_Q_Y (3'h6)      // uFork quad-memory field Y
`define MEM_Q_Z (3'h7)      // uFork quad-memory field Z

// Device Registers
`define UART_TX_RDY (8'h00)
`define UART_TX_DAT (8'h01)
`define UART_RX_RDY (8'h02)
`define UART_RX_DAT (8'h03)

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
    parameter ADDR_SZ       = 12;                       // number of bits in each address
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
    localparam UC_TO_R      = 16'h2100;                 // >R ( a -- ) ( R: -- a )
    localparam UC_R_FROM    = 16'h1280;                 // R> ( -- a ) ( R: a -- )
    localparam UC_EXIT      = 16'h5000;                 // ( -- ) ( R: addr -- ) addr->pc

    localparam UC_LIT       = 16'h021F;                 // (LIT) item ( -- item )
    localparam UC_SUB       = 16'h0742;                 // - ( a b -- a-b )
    localparam UC_MUL       = 16'h0743;                 // * ( a b -- a*b )
    localparam UC_OR        = 16'h0746;                 // OR ( a b -- a|b )
    localparam UC_NOT       = 16'h0335;                 // INVERT ( a -- ~a )
    localparam UC_NEG       = 16'h03C2;                 // NEGATE ( a -- -a )
    localparam UC_DEC       = 16'h0312;                 // 1- ( a -- a-1 )
    localparam UC_OVER      = 16'h0240;                 // ( a b -- a b a )
    localparam UC_ROT       = 16'h0500;                 // ( a b c -- b c a )
    localparam UC_R_FETCH   = 16'h0280;                 // R@ ( -- a ) ( R: a -- a )
    localparam UC_2MUL      = 16'h0301;                 // 2* ( a -- a+a )

    localparam UC_FAIL      = 16'h002F;                 // ( -- ) signal failure
    localparam UC_CALL      = 16'hC000;                 // <addr> ( -- ) ( R: -- pc+1 ) @pc->pc

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
//    localparam UC_CONST     = 16'hC088;
    localparam UC_CONST     = 16'h521F;                 // (CONST) item ( -- item ) ( R: addr -- ) addr->pc
    localparam UC_TRUE      = 16'h02F6;                 // ( -- -1 )
    localparam UC_FALSE     = 16'h02C0;                 // ( -- 0 )
    localparam UC_LSB       = 16'h02D6;                 // ( -- 1 )
    localparam UC_MSB       = 16'h02E6;                 // ( -- -32768 )
    localparam UC_NIP       = 16'hC124;                 // ( a b -- b )
    localparam UC_TUCK      = 16'hC127;                 // ( a b -- b a b )
    localparam UC_2DUP      = 16'hC12A;                 // ( a b -- a b a b )
    localparam UC_2DROP     = 16'hC12D;                 // ( a b -- )

    localparam UC_RX_OK     = 16'hC130;                 // rx? ( -- ready )
    localparam UC_GET_RX    = 16'hC134;                 // rx@ ( -- char )
    localparam UC_TX_OK     = 16'hC138;                 // tx? ( -- ready )
    localparam UC_SET_TX    = 16'hC13C;                 // tx! ( char -- )

    // initial program
    initial begin
        $readmemh("ucode_rom.mem", ucode);
        /*
        ucode[12'h000] = 16'h8020;//16'h8002;//UC_NOP;
        ucode[12'h001] = UC_FAIL;
        ucode[12'h002] = UC_TRUE;
        ucode[12'h003] = UC_DUP;
        ucode[12'h004] = UC_DEC;
        ucode[12'h005] = UC_AND;
        ucode[12'h006] = UC_NOT;
        ucode[12'h007] = UC_DROP;
        ucode[12'h008] = UC_JMP;//16'h8000;
        ucode[12'h009] = UC_BOOT;
        //
        // ALU and stack ops
        //
        ucode[12'h010] = UC_LSB;                        // 1
        ucode[12'h011] = UC_DUP;                        // 1 1
        ucode[12'h012] = UC_INC;                        // 1 2
        ucode[12'h013] = UC_DUP;                        // 1 2 2
        ucode[12'h014] = UC_2MUL;                       // 1 2 4
        ucode[12'h015] = UC_DEC;                        // 1 2 3
        ucode[12'h016] = UC_ROT;                        // 2 3 1
        ucode[12'h017] = UC_NIP;                        // 2 1
        ucode[12'h018] = UC_TUCK;                       // 1 2 1
        ucode[12'h019] = 16'h8000;                      // jump $000
        //
        // branch, fetch, and store
        //
        ucode[12'h01D] = UC_CONST;                      // ( -- $01F )
        ucode[12'h01E] = 16'h001F;
        ucode[12'h01F] = 3;
        ucode[12'h020] = 16'hC01D;                      // call $01D
        ucode[12'h021] = UC_FETCH;                      // ( $01F -- I )
        ucode[12'h022] = UC_TO_R;                       // ( I -- ) ( R: -- I )
        ucode[12'h023] = 16'h8027;                      // jump $027
        ucode[12'h024] = UC_R_FETCH;                    // ( -- I' )
        ucode[12'h025] = 16'hC01D;                      // call $01D
        ucode[12'h026] = UC_STORE;                      // ( I' $01F -- )
        ucode[12'h027] = 16'hB024;                      // test, decrement, and branch $024
        ucode[12'h028] = UC_LIT;                        // ( -- -5 )
        ucode[12'h029] = -5;
        ucode[12'h02A] = UC_LIT;                        // ( -- $01F )
        ucode[12'h02B] = 16'h001F;
        ucode[12'h02C] = UC_STORE;                      // ( -5 $01F -- )
        ucode[12'h02D] = 16'h8000;                      // jump $000
        //
        // serial UART
        //
        ucode[12'h030] = UC_RX_OK;                      // rx?
        ucode[12'h031] = 16'h9030;                      // (BZ $030)
        ucode[12'h032] = UC_GET_RX;                     // char
//        ucode[12'h030] = UC_LIT;                        // 'K'
//        ucode[12'h031] = 16'd75;
//        ucode[12'h032] = UC_NOP;                        // char='K'
        ucode[12'h033] = UC_TX_OK;                      // char tx?
        ucode[12'h034] = 16'h9033;                      // char (BZ $033)
        ucode[12'h035] = UC_SET_TX;                     // --
        ucode[12'h036] = 16'h8030;
        //
        // uFork quad-space
        //
        ucode[12'h040] = UC_LIT;                        // $BE11
        ucode[12'h041] = 16'hBE11;
        ucode[12'h042] = UC_LIT;                        // ^00FF
        ucode[12'h043] = 16'h00FF;
        ucode[12'h044] = 16'h09DF;                      // X!
        ucode[12'h045] = UC_LIT;                        // ^00FF
        ucode[12'h046] = 16'h00FF;
        ucode[12'h047] = 16'h035F;                      // X@
        ucode[12'h048] = UC_LIT;                        // $BE11
        ucode[12'h049] = 16'hBE11;
        ucode[12'h04A] = UC_XOR;                        // EQ?
        ucode[12'h04B] = 16'h904D;                      // BZ $04D
        ucode[12'h04C] = UC_FAIL;                       // FAIL
        ucode[12'h04D] = 16'h8000;                      // jump $000
        //
        // single-cycle multiply
        //
        ucode[12'h050] = UC_LIT;                        // 12345=16#3039
        ucode[12'h051] = 12345;
        ucode[12'h052] = UC_LIT;                        // 12345 -6789=16#E57B
        ucode[12'h053] = -6789;
        ucode[12'h054] = UC_MUL;                        // 12345*-6789
        ucode[12'h055] = UC_LIT;                        // 12345*-6789 10339=16#2863
        ucode[12'h056] = 10339;
        ucode[12'h057] = UC_XOR;                        // EQ?
        ucode[12'h058] = 16'h905A;                      // BZ $05A
        ucode[12'h059] = UC_FAIL;                       // FAIL
        ucode[12'h05A] = 16'h8000;                      // jump $000
        //
        // ...
        //
        // JMP
        ucode[12'h080] = UC_R_FROM;
        ucode[12'h081] = UC_FETCH;
        // EXE
        ucode[12'h082] = UC_TO_R;
        ucode[12'h083] = UC_EXIT;
        // ALT ( altn cnsq cond -- cnsq | altn )
        ucode[12'h084] = 16'h2086;                      // SKZ
        ucode[12'h085] = UC_SWAP;
        ucode[12'h086] = UC_DROP;
        ucode[12'h087] = UC_EXIT;
        // CONST
        ucode[12'h088] = UC_R_FROM;
        ucode[12'h089] = UC_FETCH;
        ucode[12'h08A] = UC_EXIT;
        // TRUE ( -- -1 )
        ucode[12'h08B] = UC_CONST;
        ucode[12'h08C] = 16'hFFFF;
        // FALSE ( -- 0 )
        ucode[12'h08D] = UC_CONST;
        ucode[12'h08E] = 16'h0000;
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
        ucode[12'h125] = UC_DROP + UC_EXIT;
        ucode[12'h126] = UC_EXIT;
        // TUCK ( a b -- b a b )
        ucode[12'h127] = UC_SWAP;
        ucode[12'h128] = UC_OVER + UC_EXIT;
        ucode[12'h129] = UC_EXIT;
        // 2DUP ( a b -- a b a b )
        ucode[12'h12A] = UC_OVER;
        ucode[12'h12B] = UC_OVER + UC_EXIT;
        ucode[12'h12C] = UC_EXIT;
        // 2DROP ( a b -- )
        ucode[12'h12D] = UC_DROP;
        ucode[12'h12E] = UC_DROP + UC_EXIT;
        ucode[12'h12F] = UC_EXIT;
        // RX_OK ( -- ready )
        ucode[12'h130] = UC_LIT;
        ucode[12'h131] = { 8'h00, `UART_RX_RDY };
        ucode[12'h132] = 16'h033F + UC_EXIT;
        ucode[12'h133] = UC_EXIT;
        // GET_RX ( -- char )
        ucode[12'h134] = UC_LIT;
        ucode[12'h135] = { 8'h00, `UART_RX_DAT };
        ucode[12'h136] = 16'h033F + UC_EXIT;
        ucode[12'h137] = UC_EXIT;
        // TX_OK ( -- ready )
        ucode[12'h138] = UC_LIT;
        ucode[12'h139] = { 8'h00, `UART_TX_RDY };
        ucode[12'h13A] = 16'h033F + UC_EXIT;
        ucode[12'h13B] = UC_EXIT;
        // SET_TX ( char -- )
        ucode[12'h13C] = UC_LIT;
        ucode[12'h13D] = { 8'h00, `UART_TX_DAT };
        ucode[12'h13E] = 16'h09BF + UC_EXIT;
        ucode[12'h13F] = UC_EXIT;
        */
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

        .o_s0(tors)                                     // top of return stack
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

        .o_s0(tos),                                     // top of stack
        .o_s1(nos)                                      // next on stack
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
    // serial UART
    //

    uart #(
        .CLK_FREQ(CLK_FREQ)
    ) UART (
        .i_clk(i_clk),
        .i_rx(i_rx),
        .o_tx(o_tx),

        .i_en(uart_en),
        .i_wr(uart_wr),
        .i_addr(uart_addr),
        .i_data(uart_wdata),

        .o_data(uart_rdata)
    );

    //
    // uFork quad-cell memory
    //

    quad_mem QUADS (
        .i_clk(i_clk),
        .i_cs_ram(cs_qram),
        .i_cs_rom0(cs_qrom0),
        .i_cs_rom1(cs_qrom1),

        .i_wr(quad_wr),
        .i_addr(quad_addr),
        .i_field(quad_field),
        .i_data(quad_wdata),

        .o_data(quad_rdata)
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
    reg [DATA_SZ-1:0] instr_r = UC_NOP;
    wire [DATA_SZ-1:0] instr =                          // current instruction
        ( p_alu ? uc_rdata
        : instr_r );
    wire ctrl = instr[15];                              // {0:evaluation, 1:control-transfer}
    wire r_pc = instr[14];                              // PC <-> R interaction
    wire [1:0] r_op = instr[13:12];                     // R-stack operation (tst/inc, if ctrl)
    wire auto = instr[13];                              // auto increment/decrement (if ctrl)
    wire d_drop = instr[11];                            // extra D-stack DROP --- FIXME: infer from (mem_op && mem_wr)?
    wire [2:0] d_op = instr[10:8];                      // D-stack operation
    wire [1:0] alu_a =                                  // left ALU input selector
        ( ctrl ? 2'b10
        : instr[7:6] );
    wire [1:0] alu_b =                                  // right ALU input selector
        ( ctrl ? { instr[12], 1'b1 }
        : instr[5:4] );
    wire [3:0] alu_op = instr[3:0];                     // ALU operation
    wire mem_op = !ctrl && (alu_op == `MEM_OP);         // ALU bypass for MEM ops
    wire mem_wr = instr[7];                             // {0:read, 1:write} MEM
    wire [2:0] mem_rng = instr[6:4];                    // MEM range selector
    wire quad_op = mem_rng[2];                          // uFork quad-memory operation
    wire d_zero = (tos == 0);                           // zero check for top-of-stack
    wire r_zero = (tors == 0);                          // zero check for top-of-return-stack
    wire branch = (r_op == 2'b00)                       // branch taken
                || ((r_op == 2'b01) && d_zero)
                || (auto && !r_zero);
    wire [3:0] dev_id = tos[7:4];                       // device id (mem_rng == `MEM_DEV)
    wire [3:0] reg_id = tos[3:0];                       // register id (mem_rng == `MEM_DEV)

    wire uc_en = (p_alu && mem_op && mem_rng == `MEM_UC);
    assign uc_wr = (uc_en && mem_wr);
    assign uc_waddr = tos[ADDR_SZ-1:0];
    assign uc_wdata = nos;
    assign uc_raddr =
        ( uc_en ? tos[ADDR_SZ-1:0]
        : pc );

    wire [DATA_SZ-1:0] r_value =
        ( ctrl && !auto ? { {PAD_ADDR{1'b0}}, pc }
        : d_value );
    wire [2:0] r_se =
        ( ctrl ?
            ( p_alu && !auto ? ( r_pc ? `PUSH_SE : `NO_SE )
            : !p_alu && auto ? ( r_zero ? `DROP_SE : `RPLC_SE )
            : `NO_SE )
        : !p_alu ? r_op
        : `NO_SE );
    wire [DATA_SZ-1:0] tors;

    wire [DATA_SZ-1:0] mem_out =
        ( quad_op ? quad_rdata
        : mem_rng == `MEM_DEV ? { {(DATA_SZ-8){uart_rdata[7]}}, uart_rdata }
        : uc_rdata );
    wire [DATA_SZ-1:0] d_value =
        ( mem_op ? mem_out
        : alu_out );
    wire [2:0] d_se =
        ( ctrl ? ( !p_alu && r_op == 2'b01 ? `DROP_SE : `NO_SE )
        : p_alu && d_drop ? `DROP_SE
        : !p_alu ? d_op
        : `NO_SE );
    wire [DATA_SZ-1:0] tos;
    wire [DATA_SZ-1:0] nos;

    wire [3:0] alu_fn =
        ( ctrl ? `ADD_OP
        : alu_op );
    wire [DATA_SZ-1:0] alu_arg0 =
        ( alu_a == 2'b01 ? nos
        : alu_a == 2'b10 ? tors
        : alu_a == 2'b11 ? 0
        : tos );
    wire [DATA_SZ-1:0] alu_arg1 =
        ( alu_b == 2'b01 ? 1
        : alu_b == 2'b10 ? 16'h8000
        : alu_b == 2'b11 ? -1
        : tos );
    wire [DATA_SZ-1:0] alu_out;

    wire uart_en = (p_alu && mem_op && mem_rng == `MEM_DEV && dev_id == 4'h0);
    wire uart_wr = mem_wr;
    wire [3:0] uart_addr = reg_id;
    wire [7:0] uart_wdata = nos[7:0];
    wire [7:0] uart_rdata;

    wire quad_en = (p_alu && mem_op && quad_op);
    wire cs_qram = (quad_en && tos[15:14]==2'b01);
    wire cs_qrom0 = (quad_en && tos[15:12]==4'b0000);
    wire cs_qrom1 = (quad_en && tos[15:12]==4'b0001);
    wire quad_wr = (quad_en && mem_wr);
    wire [11:0] quad_addr = tos[11:0];
    wire [1:0] quad_field = mem_rng[1:0];
    wire [15:0] quad_wdata = nos;
    wire [15:0] quad_rdata;

    reg p_alu = 0;                                      // 0: stack-phase, 1: alu-phase
    always @(posedge i_clk) begin
        if (mem_op && mem_rng == `MEM_ERR) begin
            o_status <= 1'b0;                           // signal failure
            p_alu <= 1'b0;
            instr_r <= UC_NOP;
        end else if (p_alu) begin
            if (!ctrl && r_pc) begin
                pc <= tors[ADDR_SZ-1:0];                // return from procedure
            end else if (mem_op && mem_rng == `MEM_PC) begin
                pc <= pc + 1'b1;                        // auto-increment on [PC] access
            end else if (ctrl && branch) begin
                pc <= instr[ADDR_SZ-1:0];               // jump or call procedure
            end
            instr_r <= uc_rdata;
            p_alu <= !p_alu;
        end else if (o_running) begin
            pc <= pc + 1'b1;                            // default next PC
            p_alu <= !p_alu;
        end
    end

endmodule
