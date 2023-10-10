/*
 * ufork.c -- Actor Virtual Machine
 * Copyright 2022 Dale Schumacher
 *
 * See further [https://github.com/organix/uFork/]
 */

#include "ufork.h"
#include "runtime.h"
#include "debug.h"

/*
 * character classes
 */

#define CTL (1<<0)  /* control */
#define DGT (1<<1)  /* digit */
#define UPR (1<<2)  /* uppercase */
#define LWR (1<<3)  /* lowercase */
#define DLM (1<<4)  /* "'(),;[]`{|} */
#define SYM (1<<5)  /* symbol (non-DLM) */
#define HEX (1<<6)  /* hexadecimal */
#define WSP (1<<7)  /* whitespace */

static unsigned char char_class[128] = {
/*      _0       _1       _2       _3       _4       _5       _6       _7    */
/*0_*/  CTL,     CTL,     CTL,     CTL,     CTL,     CTL,     CTL,     CTL,
/*      _8       _9       _A       _B       _C       _D       _E       _F    */
/*0_*/  CTL,     CTL|WSP, CTL|WSP, CTL|WSP, CTL|WSP, CTL|WSP, CTL,     CTL,
/*      _0       _1       _2       _3       _4       _5       _6       _7    */
/*1_*/  CTL,     CTL,     CTL,     CTL,     CTL,     CTL,     CTL,     CTL,
/*      _8       _9       _A       _B       _C       _D       _E       _F    */
/*1_*/  CTL,     CTL,     CTL,     CTL,     CTL,     CTL,     CTL,     CTL,
/*      _0       _1       _2       _3       _4       _5       _6       _7    */
/*2_*/  WSP,     SYM,     DLM,     SYM,     SYM,     SYM,     SYM,     DLM,
/*      _8       _9       _A       _B       _C       _D       _E       _F    */
/*2_*/  DLM,     DLM,     SYM,     SYM,     DLM,     SYM,     SYM,     SYM,
/*      _0       _1       _2       _3       _4       _5       _6       _7    */
/*3_*/  DGT|HEX, DGT|HEX, DGT|HEX, DGT|HEX, DGT|HEX, DGT|HEX, DGT|HEX, DGT|HEX,
/*      _8       _9       _A       _B       _C       _D       _E       _F    */
/*3_*/  DGT|HEX, DGT|HEX, SYM,     DLM,     SYM,     SYM,     SYM,     SYM,
/*      _0       _1       _2       _3       _4       _5       _6       _7    */
/*4_*/  SYM,     UPR|HEX, UPR|HEX, UPR|HEX, UPR|HEX, UPR|HEX, UPR|HEX, UPR,
/*      _8       _9       _A       _B       _C       _D       _E       _F    */
/*4_*/  UPR,     UPR,     UPR,     UPR,     UPR,     UPR,     UPR,     UPR,
/*      _0       _1       _2       _3       _4       _5       _6       _7    */
/*5_*/  UPR,     UPR,     UPR,     UPR,     UPR,     UPR,     UPR,     UPR,
/*      _8       _9       _A       _B       _C       _D       _E       _F    */
/*5_*/  UPR,     UPR,     UPR,     DLM,     SYM,     DLM,     SYM,     SYM,
/*      _0       _1       _2       _3       _4       _5       _6       _7    */
/*6_*/  DLM,     LWR|HEX, LWR|HEX, LWR|HEX, LWR|HEX, LWR|HEX, LWR|HEX, LWR,
/*      _8       _9       _A       _B       _C       _D       _E       _F    */
/*6_*/  LWR,     LWR,     LWR,     LWR,     LWR,     LWR,     LWR,     LWR,
/*      _0       _1       _2       _3       _4       _5       _6       _7    */
/*7_*/  LWR,     LWR,     LWR,     LWR,     LWR,     LWR,     LWR,     LWR,
/*      _8       _9       _A       _B       _C       _D       _E       _F    */
/*7_*/  LWR,     LWR,     LWR,     DLM,     DLM,     DLM,     SYM,     CTL,
};

int_t char_in_class(int_t n, int_t c) {
    return (((n & ~0x7F) == 0) && ((char_class[n] & c) != 0));
}

/*
 * heap memory management (cells)
 */

cell_t cell_table[CELL_MAX] = {
    { .t=Literal_T,     .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  0: UNDEF = #?
    { .t=Literal_T,     .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  1: NIL = ()
    { .t=Literal_T,     .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  2: FALSE = #f
    { .t=Literal_T,     .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  3: TRUE = #t
    { .t=Literal_T,     .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  4: UNIT = #unit
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  5: Type_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  6: Event_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  7: Instr_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  8: Actor_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  9: Fixnum_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  // 10: Symbol_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  // 11: Pair_T
//  { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  // 12: Fexpr_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  // 12: Dict_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  // 13: Free_T
    { .t=1700,          .x=NIL,         .y=TO_FIX(0),   .z=DDEQUE,      },  // 14: MEMORY
    { .t=START,         .x=START,       .y=NIL,         .z=NIL,         },  // 15: DDEQUE

// manually updated assembly references
#define _A_BOOT TO_CAP(104)
#define _M_EVAL TO_CAP(236)

#define BOOT_BASE (START)
#include "boot.asm"

#undef Fexpr_T  // <--- remember to manually synchronize the value in `ufork.h`
#define Fexpr_T (BOOT_END)
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  // Fexpr_T

#define SCHEME_BASE (BOOT_END+1)
#include "scheme.asm"

#define LIB_SCM_BASE (SCHEME_END)
#include "lib_scm.asm"

#define PEG_BASE (LIB_SCM_END)
#include "peg.asm"

#define SCM_PEG_BASE (PEG_END)
#include "scm_peg.asm"

#if PEG_TOOLS_SCM
#define PEG_SCM_BASE (SCM_PEG_END)
#include "peg_scm.asm"
#else
#define PEG_SCM_END (SCM_PEG_END)
#endif

#if SCHEME_ACTORS
#define ACT_SCM_BASE (PEG_SCM_END)
#include "act_scm.asm"
#else
#define ACT_SCM_END (PEG_SCM_END)
#endif

#if ASM_TOOLS_SCM
#define ASM_SCM_BASE (ACT_SCM_END)
#include "asm_scm.asm"
#else
#define ASM_SCM_END (ACT_SCM_END)
#endif

#define A_PRINT (ASM_SCM_END)
#define _A_PRINT TO_CAP(A_PRINT)
    { .t=Actor_T,       .x=A_PRINT+1,   .y=NIL,         .z=UNDEF,       },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=A_PRINT+2,   },
    { .t=Instr_T,       .x=VM_debug,    .y=TO_FIX(7331),.z=COMMIT,      },

#define A_QUIT (A_PRINT+3)
#define _A_QUIT TO_CAP(A_QUIT)
    { .t=Actor_T,       .x=A_QUIT+1,    .y=NIL,         .z=UNDEF,       },
    { .t=Instr_T,       .x=VM_end,      .y=END_STOP,    .z=UNDEF,       },  // kill thread

#define CELL_BASE (A_QUIT+2)
};

cell_t *cell_zero = &cell_table[0];  // base for cell offsets
#if !MEM_SAVES_ALL
int_t cell_next = NIL;  // head of cell free-list (or NIL if empty)
int_t cell_top = CELL_BASE; // limit of allocated cell memory
#endif

static struct { int_t addr; char *label; } cell_map[] = {
    { UNDEF, "UNDEF" },
    { NIL, "NIL" },
    { FALSE, "FALSE" },
    { TRUE, "TRUE" },
    { UNIT, "UNIT" },
    { Type_T, "Type_T" },
    { Event_T, "Event_T" },
    { Instr_T, "Instr_T" },
    { Actor_T, "Actor_T" },
    { Fixnum_T, "Fixnum_T" },
    { Symbol_T, "Symbol_T" },
    { Pair_T, "Pair_T" },
    //{ Fexpr_T, "Fexpr_T" },
    { Dict_T, "Dict_T" },
    { Free_T, "Free_T" },
    { MEMORY, "MEMORY" },
    { DDEQUE, "DDEQUE" },
    { START, "START" },

// boot.asm
    { RV_SELF, "RV_SELF" },
    { CUST_SEND, "CUST_SEND" },
    { SEND_0, "SEND_0" },
    { COMMIT, "COMMIT" },
    { RESEND, "RESEND" },
    { RELEASE_0, "RELEASE_0" },
    { RELEASE, "RELEASE" },
    { RV_FALSE, "RV_FALSE" },
    { RV_TRUE, "RV_TRUE" },
    { RV_NIL, "RV_NIL" },
    { RV_UNDEF, "RV_UNDEF" },
    { RV_UNIT, "RV_UNIT" },
    { RV_ZERO, "RV_ZERO" },
    { RV_ONE, "RV_ONE" },

    { S_VALUE, "S_VALUE" },
    { S_EMPTY, "S_EMPTY" },
    { S_GETC, "S_GETC" },
    { S_END_X, "S_END_X" },
    { S_VAL_X, "S_VAL_X" },
    { S_LIST_B, "S_LIST_B" },
    { G_START, "G_START" },
    { G_CALL_B, "G_CALL_B" },
    { G_LANG, "G_LANG" },
    { EMPTY_ENV, "EMPTY_ENV" },
    { GLOBAL_ENV, "GLOBAL_ENV" },
    { BOUND_BEH, "BOUND_BEH" },

    { REPL_R, "REPL_R" },
    { REPL_E, "REPL_E" },
    { REPL_P, "REPL_P" },
    { REPL_L, "REPL_L" },
    { REPL_F, "REPL_F" },
    { A_BOOT, "A_BOOT" },  // <--- used to defined _A_BOOT

    { A_CLOCK, "A_CLOCK" },
    { CLOCK_BEH, "CLOCK_BEH" },

    { TAG_BEH, "TAG_BEH" },
    { K_JOIN_H, "K_JOIN_H" },
    { K_JOIN_T, "K_JOIN_T" },
    { JOIN_BEH, "JOIN_BEH" },
    { FORK_BEH, "FORK_BEH" },

// scheme.asm
    { Fexpr_T, "Fexpr_T" },
    { S_IGNORE, "S_IGNORE" },
    { S_QUOTE, "S_QUOTE" },
    { S_QQUOTE, "S_QQUOTE" },
    { S_UNQUOTE, "S_UNQUOTE" },
    { S_QSPLICE, "S_QSPLICE" },
    { S_PLACEH, "S_PLACEH" },

    { M_EVAL, "M_EVAL" },  // <--- used to defined _M_EVAL
    { K_COMBINE, "K_COMBINE" },
    { K_APPLY_F, "K_APPLY_F" },
    { M_APPLY, "M_APPLY" },
    { M_LOOKUP, "M_LOOKUP" },
    { M_EVLIS_P, "M_EVLIS_P" },
    { M_EVLIS_K, "M_EVLIS_K" },
    { M_EVLIS, "M_EVLIS" },
    { FX_PAR, "FX_PAR" },
    { OP_PAR, "OP_PAR" },
    { M_ZIP_IT, "M_ZIP_IT" },
    { M_ZIP_K, "M_ZIP_K" },
    { M_ZIP_P, "M_ZIP_P" },
    { M_ZIP_R, "M_ZIP_R" },
    { M_ZIP_S, "M_ZIP_S" },
    { M_ZIP, "M_ZIP" },
    { CLOSURE_B, "CLOSURE_B" },
    { M_EVAL_B, "M_EVAL_B" },
    { FEXPR_B, "FEXPR_B" },
    { K_SEQ_B, "K_SEQ_B" },
    { M_IF_K, "M_IF_K" },

    { M_BIND_E, "M_BIND_E" },
    { FX_QUOTE, "FX_QUOTE" },
    { OP_QUOTE, "OP_QUOTE" },
    { FX_LAMBDA, "FX_LAMBDA" },
    { OP_LAMBDA, "OP_LAMBDA" },
    { FX_VAU, "FX_VAU" },
    { OP_VAU, "OP_VAU" },
    { K_DEFINE_B, "K_DEFINE_B" },
    { K_DZIP_B, "K_DZIP_B" },
    { K_BIND_B, "K_BIND_B" },
    { FX_DEFINE, "FX_DEFINE" },
    { OP_DEFINE, "OP_DEFINE" },
    { FX_IF, "FX_IF" },
    { OP_IF, "OP_IF" },
    { FX_COND, "FX_COND" },
    { OP_COND, "OP_COND" },
    { K_COND, "K_COND" },
    { FX_SEQ, "FX_SEQ" },
    { OP_SEQ, "OP_SEQ" },

// lib_scm.asm
    { F_LIST, "F_LIST" },
    { F_CONS, "F_CONS" },
    { F_CAR, "F_CAR" },
    { F_CDR, "F_CDR" },
    { F_CADR, "F_CADR" },
    { F_CADDR, "F_CADDR" },
    { F_NTH, "F_NTH" },
    { F_NULL_P, "F_NULL_P" },
    { F_TYPE_P, "F_TYPE_P" },
    { F_PAIR_P, "F_PAIR_P" },
    { F_BOOL_P, "F_BOOL_P" },
    { F_NUM_P, "F_NUM_P" },
    { F_SYM_P, "F_SYM_P" },
    { F_ACT_P, "F_ACT_P" },
    { F_EQ_P, "F_EQ_P" },
    { F_NUM_EQ, "F_NUM_EQ" },
    { F_NUM_LT, "F_NUM_LT" },
    { F_NUM_LE, "F_NUM_LE" },
    { F_NUM_GE, "F_NUM_GE" },
    { F_NUM_GT, "F_NUM_GT" },
    { F_NUM_ADD, "F_NUM_ADD" },
    { F_NUM_SUB, "F_NUM_SUB" },
    { F_NUM_MUL, "F_NUM_MUL" },
    { F_LST_NUM, "F_LST_NUM" },
    { F_LST_SYM, "F_LST_SYM" },
    { F_PRINT, "F_PRINT" },

// peg.asm
    { G_EMPTY, "G_EMPTY" },
    { G_FAIL, "G_FAIL" },
    { G_NEXT_K, "G_NEXT_K" },
    { G_ANY, "G_ANY" },
    { G_EQ_B, "G_EQ_B" },
    { G_FAIL_K, "G_FAIL_K" },
    { G_OR_B, "G_OR_B" },
    { G_AND_PR, "G_AND_PR" },
    { G_AND_OK, "G_AND_OK" },
    { G_AND_B, "G_AND_B" },
    { G_NOT_B, "G_NOT_B" },
    { G_OPT_B, "G_OPT_B" },
    { G_PLUS_B, "G_PLUS_B" },
    { G_STAR_B, "G_STAR_B" },
    { G_ALT_B, "G_ALT_B" },
    { G_SEQ_B, "G_SEQ_B" },
    { G_CLS_B, "G_CLS_B" },
    { G_PRED_K, "G_PRED_K" },
    { G_PRED_OK, "G_PRED_OK" },
    { G_PRED_B, "G_PRED_B" },
    { G_XLAT_K, "G_XLAT_K" },
    { G_XLAT_OK, "G_XLAT_OK" },
    { G_XLAT_B, "G_XLAT_B" },
    { S_CHAIN, "S_CHAIN" },
    { S_BUSY_C, "S_BUSY_C" },
    { S_NEXT_C, "S_NEXT_C" },

// scm_peg.asm
    { G_END, "G_END" },
    { G_EOL, "G_EOL" },
    { G_WSP, "G_WSP" },
    { G_WSP_S, "G_WSP_S" },
    { G_TO_EOL, "G_TO_EOL" },
    { G_SEMIC, "G_SEMIC" },
    { G_COMMENT, "G_COMMENT" },
    { G_OPTWSP, "G_OPTWSP" },
    { G_PRT, "G_PRT" },
    { G_EOT, "G_EOT" },
    { G_UNDER, "G_UNDER" },
    { G_M_SGN, "G_M_SGN" },
    { G_P_SGN, "G_P_SGN" },
    { G_SIGN, "G_SIGN" },
    { G_DGT, "G_DGT" },
    { G_DIGIT, "G_DIGIT" },
    { G_DIGITS, "G_DIGITS" },
    { G_NUMBER, "G_NUMBER" },
    { F_IGN, "F_IGN" },
    { G_IGN, "G_IGN" },
    { G_HASH, "G_HASH" },
    { G_LWR_U, "G_LWR_U" },
    { G_LWR_N, "G_LWR_N" },
    { G_LWR_I, "G_LWR_I" },
    { G_LWR_T, "G_LWR_T" },
    { G_LWR_F, "G_LWR_F" },
    { G_QMARK, "G_QMARK" },
    { F_FALSE, "F_FALSE" },
    { G_FALSE, "G_FALSE" },
    { F_TRUE, "F_TRUE" },
    { G_TRUE, "G_TRUE" },
    { F_UNDEF, "F_UNDEF" },
    { G_UNDEF, "G_UNDEF" },
    { F_UNIT, "F_UNIT" },
    { G_UNIT, "G_UNIT" },
    { G_CONST, "G_CONST" },
    { G_SYMBOL, "G_SYMBOL" },
    { G_OPEN, "G_OPEN" },
    { G_DOT, "G_DOT" },
    { G_CLOSE, "G_CLOSE" },
    { G_QUOTE, "G_QUOTE" },
    { G_BQUOTE, "G_BQUOTE" },
    { G_COMMA, "G_COMMA" },
    { G_AT, "G_AT" },
    { F_QUOTED, "F_QUOTED" },
    { F_QQUOTED, "F_QQUOTED" },
    { F_UNQUOTED, "F_UNQUOTED" },
    { F_QSPLICED, "F_QSPLICED" },
    { F_PLACEHD, "F_PLACEHD" },
    { F_NIL, "F_NIL" },
    { G_QUOTED, "G_QUOTED" },
    { G_DOTTED, "G_DOTTED" },
    { G_TAIL, "G_TAIL" },
    { G_LIST, "G_LIST" },
    { G_EXPR, "G_EXPR" },
    { G_SEXPR, "G_SEXPR" },

// peg_scm.asm
#if PEG_TOOLS_SCM
    { F_G_EQ, "F_G_EQ" },
    { F_G_OR, "F_G_OR" },
    { F_G_AND, "F_G_AND" },
    { F_G_NOT, "F_G_NOT" },
    { F_G_CLS, "F_G_CLS" },
    { F_G_OPT, "F_G_OPT" },
    { F_G_PLUS, "F_G_PLUS" },
    { F_G_STAR, "F_G_STAR" },
    { F_G_ALT, "F_G_ALT" },
    { F_G_SEQ, "F_G_SEQ" },
    { FX_G_CALL, "FX_G_CALL" },
    { OP_G_CALL, "OP_G_CALL" },
    { F_G_PRED, "F_G_PRED" },
    { F_G_XFORM, "F_G_XFORM" },
    { F_S_LIST, "F_S_LIST" },
    { F_G_START, "F_G_START" },
    { F_S_CHAIN, "F_S_CHAIN" },
#endif // PEG_TOOLS_SCM

// act_scm.asm
#if SCHEME_ACTORS
    { S_SEND, "S_SEND" },
    { S_BECOME, "S_BECOME" },
    { S_SELF, "S_SELF" },
    { M_ACTOR_B, "M_ACTOR_B" },
    { M_BUSY_B, "M_BUSY_B" },
    { M_SEND, "M_SEND" },
    { M_BECOME, "M_BECOME" },
    { A_META_B, "A_META_B" },
    { A_EXEC_B, "A_EXEC_B" },
    { A_COMMIT_B, "A_COMMIT_B" },
    { FX_M_BEH, "FX_M_BEH" },
    { OP_M_BEH, "OP_M_BEH" },
    { F_CREATE, "F_CREATE" },
    { F_SEND, "F_SEND" },
    { F_CALL, "F_CALL" },
#endif // SCHEME_ACTORS

// asm_scm.asm
#if ASM_TOOLS_SCM
    { F_CELL, "F_CELL" },
    { F_GET_T, "F_GET_T" },
    { F_GET_X, "F_GET_X" },
    { F_GET_Y, "F_GET_Y" },
    { F_GET_Z, "F_GET_Z" },
    { F_SET_T, "F_SET_T" },
    { F_SET_X, "F_SET_X" },
    { F_SET_Y, "F_SET_Y" },
    { F_SET_Z, "F_SET_Z" },
#endif // ASM_TOOLS_SCM

    { A_PRINT, "A_PRINT" },
    { A_QUIT, "A_QUIT" },
    { CELL_BASE, "CELL_BASE" },
    { -1, "" },
};
void dump_cell_map() {
    for (int i = 0; cell_map[i].addr >= 0; ++i) {
        fprintf(stderr, "%5"PdI": %s\n",
            cell_map[i].addr, cell_map[i].label);
    }
}
char *get_cell_label(int_t addr) {
    int i = 0;
    while (cell_map[i].addr >= 0) {
        if (addr == cell_map[i].addr) break;
        ++i;
    }
    return cell_map[i].label;
}

int_t sane = 0;  // run-away loop prevention

int_t cell_new(int_t t, int_t x, int_t y, int_t z) {
    int_t next = cell_top;
    if (cell_next != NIL) {
        // use cell from free-list
        next = cell_next;
        cell_next = get_z(next);
        --gc_free_cnt;
    } else if (next < CELL_MAX) {
        // extend top of heap
        ++cell_top;
    } else {
        return panic("out of cell memory");
    }
    set_t(next, t);
    set_x(next, x);
    set_y(next, y);
    set_z(next, z);
    return MARK_CELL(next);
}

static void cell_reclaim(int_t addr) {
    // link into free-list
    cell_zero[addr].z = cell_next;
    cell_zero[addr].y = UNDEF;
    cell_zero[addr].x = UNDEF;
    cell_zero[addr].t = Free_T;
    // NOTE: we don't use the set_*() macros to avoid marking the cell in-use
    cell_next = FREE_CELL(addr);
    ++gc_free_cnt;
}

int_t cell_free(int_t addr) {
    if (IS_CAP(addr)) {
        addr = TO_REF(addr);
    }
    ASSERT(IN_HEAP(addr));
    ASSERT(!IS_FREE(addr));  // prevent double-free
    cell_reclaim(addr);
    return UNDEF;
}

int_t actor_new(int_t ip, int_t sp) {
    ASSERT(IS_CODE(ip));
    ASSERT((sp == NIL) || IS_PAIR(sp));
    int_t a = cell_new(Actor_T, ip, sp, UNDEF);
    if (IN_HEAP(a)) {
        a = TO_CAP(a);
    }
    return a;
}

int_t cons(int_t head, int_t tail) {
    return cell_new(Pair_T, head, tail, UNDEF);
}

//#define car(v) get_x(v)
int_t car(int_t v) {
    if (IS_PAIR(v)) {
        return get_x(v);
    }
    return UNDEF; //warning("car() defined only for Pair_T");
}
//#define cdr(v) get_y(v)
int_t cdr(int_t v) {
    if (IS_PAIR(v)) {
        return get_y(v);
    }
    return UNDEF; //warning("cdr() defined only for Pair_T");
}

//#define set_car(v,x) set_x((v),(x))
int_t set_car(int_t v, int_t x) {
    if (IS_PAIR(v)) {
        return set_x(v, x);
    }
    return warning("set_car() defined only for Pair_T");
}
//#define set_cdr(v,y) set_y((v),(y))
int_t set_cdr(int_t v, int_t x) {
    if (IS_PAIR(v)) {
        return set_y(v, x);
    }
    return warning("set_cdr() defined only for Pair_T");
}

int_t equal(int_t x, int_t y) {
    if (x == y) return TRUE;
    while (IS_PAIR(x) && IS_PAIR(y)) {
        if (!equal(car(x), car(y))) break;
        x = cdr(x);
        y = cdr(y);
        if (x == y) return TRUE;
    }
    return FALSE;
}

int_t list_len(int_t val) {
    int_t len = 0;
    sane = SANITY;
    while (IS_PAIR(val)) {
        ++len;
        val = cdr(val);
        if (sane-- == 0) return panic("insane list_len");
    }
    return len;
}

// WARNING! destructive reverse-in-place and append
//          (appends `tail` to reversed `head`)
int_t append_reverse(int_t head, int_t tail) {
    sane = SANITY;
    while (IS_PAIR(head)) {
        int_t rest = cdr(head);
        set_cdr(head, tail);
        tail = head;
        head = rest;
        if (sane-- == 0) return panic("insane append_reverse");
    }
    return tail;
}

// return integer fixnum for character string
int_t fixnum(int_t str) {  // FIXME: add `base` parameter
    int_t num = 0;
    int_t neg = UNDEF;
    while (IS_PAIR(str)) {
        int_t ch = TO_INT(car(str));
        str = cdr(str);
        if (char_in_class(ch, DGT)) {
            num = (10 * num) + (ch - '0');
        } else if (ch == '_') {
            // ignore separator
        } else {
            if (neg == UNDEF) {
                if (ch == '-') {
                    neg = TRUE;
                    continue;
                } else if (ch == '+') {
                    neg = FALSE;
                    continue;
                }
            }
            break;  // illegal character
        }
        if (neg == UNDEF) {
            neg = FALSE;
        }
    }
    if (neg == TRUE) {
        num = -num;
    }
    return TO_FIX(num);
}

/*
 * garbage collection (reclaiming the heap)
 */

// FORWARD DECLARATIONS
static int_t sym_intern[256];

#if !MEM_SAVES_ALL
static int_t gc_root_set = NIL;
int_t gc_free_cnt = TO_FIX(0);  // number of cells in free-list
#endif
#if RUNTIME_STATS
long gc_cycle_count = 0;
#endif

void gc_add_root(int_t addr) {
    gc_root_set = cons(addr, gc_root_set);
}

#if CONCURRENT_GC
#define GC_GENX (0x0)  // This cell is in use as of Generation X
#define GC_GENY (0x1)  // This cell is in use as of Generation Y
#define GC_SCAN (0x2)  // This cell is in use, but has not been scanned
#define GC_FREE (0x3)  // This cell is in the free-cell chain {t:Free_T}

static char gc_marks[CELL_MAX] = { 0 };
static char gc_prev_gen = GC_GENY;
static char gc_next_gen = GC_GENX;

static void gc_dump_map() {  // dump memory allocation map
    static char mark_label[] = { 'x', 'y', '?', '.' };
    i32 gc_prev_cnt = 0;
    i32 gc_next_cnt = 0;
    i32 gc_scan_cnt = 0;
    for (int_t a = 0; a < cell_top; ++a) {
    //for (int_t a = 0; a < CELL_MAX; ++a) {
        if (a && ((a & 0x3F) == 0)) {
            fprintf(stderr, "\n");
        }
        char m = gc_marks[a];
        char c = mark_label[m];
        if (a <= MEMORY) {
            c = 'r';
        } else if (a >= cell_top) {
            c = '-';
        } else if (m == gc_prev_gen) {
            ++gc_prev_cnt;
        } else if (m == gc_next_gen) {
            ++gc_next_cnt;
        } else if (m == GC_SCAN) {
            ++gc_scan_cnt;
        }
        fprintf(stderr, "%c", c);
    }
    fprintf(stderr, "\n");
    fprintf(stderr,
        "gc: top=%"PRId32" gen_%c=%"PRId32" gen_%c=%"PRId32" free=%"PdI" scan=%"PRId32"\n",
        cell_top,
        mark_label[gc_prev_gen], gc_prev_cnt,
        mark_label[gc_next_gen], gc_next_cnt,
        TO_INT(gc_free_cnt), gc_scan_cnt);
}

static int_t gc_scan_cell(int_t addr) {  // mark cell be scanned
    if (IS_CAP(addr)) {
        addr = TO_REF(addr);
    }
    if (IN_HEAP(addr)) {
        if (gc_marks[addr] == gc_prev_gen) {
            gc_marks[addr] = GC_SCAN;
        }
    }
    return addr;
}

int_t gc_mark_cell(int_t addr) {  // mark cell in-use
    if (IS_CAP(addr)) {
        addr = TO_REF(addr);
    }
    if (IN_HEAP(addr)) {
        gc_marks[addr] = gc_next_gen;
        gc_scan_cell(get_t(addr));
        gc_scan_cell(get_x(addr));
        gc_scan_cell(get_y(addr));
        gc_scan_cell(get_z(addr));
    }
    return addr;
}

int_t gc_free_cell(int_t addr) {  // mark cell free
    if (IS_CAP(addr)) {
        addr = TO_REF(addr);
    }
    if (IN_HEAP(addr)) {
        gc_marks[addr] = GC_FREE;
    }
    return addr;
}

static int_t gc_scan_addr = START;
static int_t gc_find_cell(char mark) {  // find next cell with `mark`
    int_t gc_scan_stop = gc_scan_addr;
    while (1) {
        if (++gc_scan_addr >= cell_top) {
            gc_scan_addr = START;
        }
        if (gc_scan_addr == gc_scan_stop) {
            break;  // nothing to scan...
        }
        if (gc_marks[gc_scan_addr] == mark) {
            return gc_scan_addr;
        }
    }
    return UNDEF;
}

#define GC_STRIDE (0x0F)

static char gc_state = 0;
static int_t gc_index = 0;

static void gc_increment() {  // perform an incremental GC step
    //fprintf(stderr, "gc_increment: gc_state=%d gc_index=%"PdI"\n", gc_state, gc_index);
    switch (gc_state) {
        case 0: {
            // swap generations
#if RUNTIME_STATS
            ++gc_cycle_count;
#endif
            if (gc_next_gen == GC_GENX) {
                gc_prev_gen = GC_GENX;
                gc_next_gen = GC_GENY;
            } else {
                gc_prev_gen = GC_GENY;
                gc_next_gen = GC_GENX;
            }
            // mark roots
#if !MEM_SAVES_ALL
            gc_mark_cell(e_queue_head);
            gc_mark_cell(k_queue_head);
#endif
            gc_mark_cell(gc_root_set);
            // next state
            gc_state = 1;
            gc_index = 256;
            break;
        }
        case 1: {
            // mark global symbols
            while ((--gc_index & GC_STRIDE) != 0) {
                gc_mark_cell(sym_intern[gc_index]);
            }
            gc_mark_cell(sym_intern[gc_index]);
            if (gc_index == 0) {
                // next state
                gc_state = 2;
                gc_index = 0;
            }
            break;
        }
        case 2: {
            // scan cells
            while ((++gc_index & GC_STRIDE) != 0) {
                int_t cell = gc_find_cell(GC_SCAN);
                if (IN_HEAP(cell)) {
                    gc_mark_cell(cell);
                } else {
                    // next state
                    gc_index = 0;
                    gc_state = 3;
                    break;
                }
            }
            break;
        }
        case 3: {
            // free unreachable cells
            while ((++gc_index & GC_STRIDE) != 0) {
                int_t cell = gc_find_cell(gc_prev_gen);
                if (IN_HEAP(cell)) {
                    cell_reclaim(cell);
                } else {
                    // next state
                    gc_index = 0;
                    gc_state = 0;
                    break;
                }
            }
            break;
        }
    }
    return;
}
#endif // CONCURRENT_GC

#if MARK_SWEEP_GC
#define GC_LO_BITS(val) I32(I32(val) & 0x1F)
#define GC_HI_BITS(val) I32(I32(val) >> 5)

#define GC_MAX_BITS GC_HI_BITS(CELL_MAX)
#define GC_RESERVED (I32(1 << GC_LO_BITS(DDEQUE)) - 1)

i32 gc_bits[GC_MAX_BITS] = { GC_RESERVED };  // in-use mark bits

i32 gc_clear() {  // clear all GC bits (except RESERVED)
    i32 cnt = I32(TO_INT(gc_free_cnt));
    cell_next = NIL;  // empty the free-list
    gc_free_cnt = TO_FIX(0);
    gc_bits[0] = GC_RESERVED;
    for (int_t i = 1; i < GC_MAX_BITS; ++i) {
        gc_bits[i] = 0;
    }
    return cnt;
}

static i32 gc_get_mark(int_t val) {
    return (gc_bits[GC_HI_BITS(val)] & I32(1 << GC_LO_BITS(val)));
}

static void gc_set_mark(int_t val) {
    gc_bits[GC_HI_BITS(val)] |= I32(1 << GC_LO_BITS(val));
}

/*
static void gc_clr_mark(int_t val) {
    gc_bits[GC_HI_BITS(val)] &= ~I32(1 << GC_LO_BITS(val));
}
*/

static void gc_dump_map() {  // dump memory allocation map
    for (int_t a = 0; a < cell_top; ++a) {
    //for (int_t a = 0; a < CELL_MAX; ++a) {
        if (a && ((a & 0x3F) == 0)) {
            fprintf(stderr, "\n");
        }
        char c = (gc_get_mark(a) ? 'x' : '.');
        if (a >= cell_top) c = '-';
#if 1
        /* extra detail */
        if (c == 'x') {
            int_t t = get_t(a);
            if (t == Literal_T) c = 'l';    // literal value
            if (t == Type_T) c = 't';       // type marker
            if (t == Event_T) c = 'E';      // Event_T
            if (t == Instr_T) c = 'i';      // Instr_T
            if (t == Actor_T) c = 'A';      // Actor_T
            if (t == Fixnum_T) c = '#';     // Fixnum_T <-- should not happen
            if (t == Symbol_T) c = 'S';     // Symbol_T
            if (t == Pair_T) c = 'p';       // Pair_T
            if (t == Dict_T) c = 'd';       // Dict_T
            if (t == Free_T) c = '?';       // Free_T <-- should not happen
            if (t == Fexpr_T) c = 'F';      // Fexpr_T
            else if (t >= START) c = 'K';   // continuation
        }
#endif
        fprintf(stderr, "%c", c);
    }
    fprintf(stderr, "\n");
}

i32 gc_mark_cells(int_t val) {  // mark cells reachable from `val`
    i32 cnt = 0;
    while (1) {
        if (IS_CAP(val)) {
            val = TO_REF(val);
        }
        if (!IN_HEAP(val)) {
            break;  // only gc heap quad-cells
        }
        if (gc_get_mark(val)) {
            break;  // cell already marked
        }
        if (IS_FREE(val)) {
            //DEBUG(debug_print("gc_mark_cells", val));
            break;  // don't mark free cells
        }
        gc_set_mark(val);
        ++cnt;
        cnt += gc_mark_cells(get_t(val));   // recurse on t
        cnt += gc_mark_cells(get_x(val));   // recurse on x
        cnt += gc_mark_cells(get_y(val));   // recurse on y
        val = get_z(val);                   // iterate over z
    }
    return cnt;
}

i32 gc_mark_roots(int_t dump) {  // mark cells reachable from the root-set
    i32 cnt = MEMORY;
    for (int i = 0; i < 256; ++i) {
        if (sym_intern[i]) {
            cnt += gc_mark_cells(sym_intern[i]);
        }
    }
#if !MEM_SAVES_ALL
    cnt += gc_mark_cells(e_queue_head);
    cnt += gc_mark_cells(k_queue_head);
#endif
    cnt += gc_mark_cells(gc_root_set);
    if (dump != FALSE) {
        gc_dump_map();
    }
    return cnt;
}

i32 gc_sweep() {  // free unmarked cells
    i32 cnt = 0;
    int_t next = cell_top;
    while (--next >= START) {
        if (!gc_get_mark(next)) {
            cell_reclaim(next);
            ++cnt;
        }
    }
    return cnt;
}

i32 gc_mark_and_sweep(int_t dump) {
    i32 t = I32(cell_top);
    i32 f = gc_clear();
    i32 m = gc_mark_roots(dump);
    i32 a = gc_sweep();
    if (dump != FALSE) {
        fprintf(stderr,
            "gc: top=%"PRId32" free=%"PRId32" used=%"PRId32" avail=%"PRId32"\n",
            t, f, m, a);
    }
#if RUNTIME_STATS
    ++gc_cycle_count;
#endif
    return m;
}

i32 gc_safepoint() {
    if ((cell_top > (CELL_MAX - 256)) && (TO_INT(gc_free_cnt) < 64)) {
        gc_mark_and_sweep(FALSE);  // no gc output
        //gc_mark_and_sweep(UNDEF);  // one-line gc summary
        if (TO_INT(gc_free_cnt) < 128) {  // low-memory warning!
            gc_mark_and_sweep(UNDEF);  // one-line gc summary
        }
    }
    return I32(TO_INT(gc_free_cnt));
}
#endif // MARK_SWEEP_GC

/*
 * symbol/character-string
 */

static uint32_t crc_table[] = {  // CRC-32 (cksum)
0x00000000,
0x04c11db7, 0x09823b6e, 0x0d4326d9, 0x130476dc, 0x17c56b6b,
0x1a864db2, 0x1e475005, 0x2608edb8, 0x22c9f00f, 0x2f8ad6d6,
0x2b4bcb61, 0x350c9b64, 0x31cd86d3, 0x3c8ea00a, 0x384fbdbd,
0x4c11db70, 0x48d0c6c7, 0x4593e01e, 0x4152fda9, 0x5f15adac,
0x5bd4b01b, 0x569796c2, 0x52568b75, 0x6a1936c8, 0x6ed82b7f,
0x639b0da6, 0x675a1011, 0x791d4014, 0x7ddc5da3, 0x709f7b7a,
0x745e66cd, 0x9823b6e0, 0x9ce2ab57, 0x91a18d8e, 0x95609039,
0x8b27c03c, 0x8fe6dd8b, 0x82a5fb52, 0x8664e6e5, 0xbe2b5b58,
0xbaea46ef, 0xb7a96036, 0xb3687d81, 0xad2f2d84, 0xa9ee3033,
0xa4ad16ea, 0xa06c0b5d, 0xd4326d90, 0xd0f37027, 0xddb056fe,
0xd9714b49, 0xc7361b4c, 0xc3f706fb, 0xceb42022, 0xca753d95,
0xf23a8028, 0xf6fb9d9f, 0xfbb8bb46, 0xff79a6f1, 0xe13ef6f4,
0xe5ffeb43, 0xe8bccd9a, 0xec7dd02d, 0x34867077, 0x30476dc0,
0x3d044b19, 0x39c556ae, 0x278206ab, 0x23431b1c, 0x2e003dc5,
0x2ac12072, 0x128e9dcf, 0x164f8078, 0x1b0ca6a1, 0x1fcdbb16,
0x018aeb13, 0x054bf6a4, 0x0808d07d, 0x0cc9cdca, 0x7897ab07,
0x7c56b6b0, 0x71159069, 0x75d48dde, 0x6b93dddb, 0x6f52c06c,
0x6211e6b5, 0x66d0fb02, 0x5e9f46bf, 0x5a5e5b08, 0x571d7dd1,
0x53dc6066, 0x4d9b3063, 0x495a2dd4, 0x44190b0d, 0x40d816ba,
0xaca5c697, 0xa864db20, 0xa527fdf9, 0xa1e6e04e, 0xbfa1b04b,
0xbb60adfc, 0xb6238b25, 0xb2e29692, 0x8aad2b2f, 0x8e6c3698,
0x832f1041, 0x87ee0df6, 0x99a95df3, 0x9d684044, 0x902b669d,
0x94ea7b2a, 0xe0b41de7, 0xe4750050, 0xe9362689, 0xedf73b3e,
0xf3b06b3b, 0xf771768c, 0xfa325055, 0xfef34de2, 0xc6bcf05f,
0xc27dede8, 0xcf3ecb31, 0xcbffd686, 0xd5b88683, 0xd1799b34,
0xdc3abded, 0xd8fba05a, 0x690ce0ee, 0x6dcdfd59, 0x608edb80,
0x644fc637, 0x7a089632, 0x7ec98b85, 0x738aad5c, 0x774bb0eb,
0x4f040d56, 0x4bc510e1, 0x46863638, 0x42472b8f, 0x5c007b8a,
0x58c1663d, 0x558240e4, 0x51435d53, 0x251d3b9e, 0x21dc2629,
0x2c9f00f0, 0x285e1d47, 0x36194d42, 0x32d850f5, 0x3f9b762c,
0x3b5a6b9b, 0x0315d626, 0x07d4cb91, 0x0a97ed48, 0x0e56f0ff,
0x1011a0fa, 0x14d0bd4d, 0x19939b94, 0x1d528623, 0xf12f560e,
0xf5ee4bb9, 0xf8ad6d60, 0xfc6c70d7, 0xe22b20d2, 0xe6ea3d65,
0xeba91bbc, 0xef68060b, 0xd727bbb6, 0xd3e6a601, 0xdea580d8,
0xda649d6f, 0xc423cd6a, 0xc0e2d0dd, 0xcda1f604, 0xc960ebb3,
0xbd3e8d7e, 0xb9ff90c9, 0xb4bcb610, 0xb07daba7, 0xae3afba2,
0xaafbe615, 0xa7b8c0cc, 0xa379dd7b, 0x9b3660c6, 0x9ff77d71,
0x92b45ba8, 0x9675461f, 0x8832161a, 0x8cf30bad, 0x81b02d74,
0x857130c3, 0x5d8a9099, 0x594b8d2e, 0x5408abf7, 0x50c9b640,
0x4e8ee645, 0x4a4ffbf2, 0x470cdd2b, 0x43cdc09c, 0x7b827d21,
0x7f436096, 0x7200464f, 0x76c15bf8, 0x68860bfd, 0x6c47164a,
0x61043093, 0x65c52d24, 0x119b4be9, 0x155a565e, 0x18197087,
0x1cd86d30, 0x029f3d35, 0x065e2082, 0x0b1d065b, 0x0fdc1bec,
0x3793a651, 0x3352bbe6, 0x3e119d3f, 0x3ad08088, 0x2497d08d,
0x2056cd3a, 0x2d15ebe3, 0x29d4f654, 0xc5a92679, 0xc1683bce,
0xcc2b1d17, 0xc8ea00a0, 0xd6ad50a5, 0xd26c4d12, 0xdf2f6bcb,
0xdbee767c, 0xe3a1cbc1, 0xe760d676, 0xea23f0af, 0xeee2ed18,
0xf0a5bd1d, 0xf464a0aa, 0xf9278673, 0xfde69bc4, 0x89b8fd09,
0x8d79e0be, 0x803ac667, 0x84fbdbd0, 0x9abc8bd5, 0x9e7d9662,
0x933eb0bb, 0x97ffad0c, 0xafb010b1, 0xab710d06, 0xa6322bdf,
0xa2f33668, 0xbcb4666d, 0xb8757bda, 0xb5365d03, 0xb1f740b4
};

uint32_t add_crc(uint32_t crc, uint8_t octet) {
    octet ^= (crc >> 24);
    return (crc << 8) ^ crc_table[octet];
}

uint32_t list_crc(int_t val) {
    uint32_t crc = 0;
    int_t len = 0;
    sane = SANITY;
    // compute crc from octets
    while (IS_PAIR(val)) {
        int_t ch = TO_INT(car(val));
        crc = add_crc(crc, (uint8_t)ch);
        ++len;
        val = cdr(val);
        if (sane-- == 0) return panic("insane list_crc");
    }
    // include length in crc
    while (len) {
        crc = add_crc(crc, (uint8_t)len);
        len >>= 8;
    }
    return ~crc;  // complement result
}

int_t cstr_to_list(char *s) {
    int_t xs = NIL;
    while (s && *s) {
        int_t c = TO_FIX(0xFF & *s++);
        xs = cons(c, xs);
    }
    return append_reverse(xs, NIL);
}

int_t sym_new(int_t str) {
    int_t hash = TO_FIX(list_crc(str));
    return cell_new(Symbol_T, hash, str, UNDEF);
}

#define cstr_intern(s) symbol(cstr_to_list(s))

#define SYM_MAX (1<<8)  // 256
#define SYM_MASK (SYM_MAX-1)
static int_t sym_intern[SYM_MAX];

// return interned symbol for character string
int_t symbol(int_t str) {
    int_t sym = sym_new(str);
    int_t hash = get_x(sym);
    int_t slot = hash & SYM_MASK;
    int_t chain = sym_intern[slot];
    if (!chain) {
        chain = NIL;
        sym_intern[slot] = chain;  // fix static init
    }
    while (IS_PAIR(chain)) {
        int_t s = car(chain);
        if ((hash == get_x(s)) && equal(str, get_y(s))) {
            sym = XFREE(sym);
            return s;  // found interned symbol
        }
        chain = cdr(chain);
    }
    // add symbol to hash-chain
    sym_intern[slot] = cons(sym, sym_intern[slot]);
    return sym;
}

// install static symbol into symbol table
static void sym_install(int_t sym) {
    int_t str = get_y(sym);
    int_t hash = TO_FIX(list_crc(str));
    set_x(sym, hash);
    int_t slot = hash & SYM_MASK;
    int_t chain = sym_intern[slot];
    if (!chain) {
        chain = NIL;
        sym_intern[slot] = chain;  // fix static init
    }
    // add symbol to hash-chain
    sym_intern[slot] = cons(sym, sym_intern[slot]);
}

void print_symbol(int_t symbol) {
    if (IS_SYM(symbol)) {
        for (int_t p = get_y(symbol); IS_PAIR(p); p = cdr(p)) {
            int_t ch = TO_INT(car(p));
            char c = '~';
            if ((ch >= ' ') || (ch < 0x7F)) {
                c = (ch & 0x7F);
            }
            fprintf(stderr, "%c", c);
        }
    } else {
        print_word("", symbol);
    }
}
#if INCLUDE_DEBUG
static void print_intern(int_t hash) {
    int_t slot = hash & SYM_MASK;
    int_t chain = sym_intern[slot];
    if (!chain) {
        fprintf(stderr, "--\n");
    } else {
        char c = '(';
        while (IS_PAIR(chain)) {
            fprintf(stderr, "%c", c);
            int_t s = car(chain);
            fprintf(stderr, "%"PxI":", get_x(s));
            print_symbol(s);
            c = ' ';
            chain = cdr(chain);
        }
        fprintf(stderr, ")\n");
    }
}
static int_t test_symbol_intern() {
    ASSERT(cstr_intern("_") == cstr_intern("_"));
    for (int_t slot = 0; slot < SYM_MAX; ++slot) {
        print_intern(slot);
    }
    return UNIT;
}
#endif // INCLUDE_DEBUG

#define bind_global(cstr,val) set_z(cstr_intern(cstr), (val))

int_t init_global_env() {
    sym_install(S_IGNORE);
    sym_install(S_QUOTE);
    sym_install(S_QQUOTE);
    sym_install(S_UNQUOTE);
    sym_install(S_QSPLICE);
    sym_install(S_PLACEH);
#if SCHEME_ACTORS
    sym_install(S_SEND);
    sym_install(S_BECOME);
    sym_install(S_SELF);
#endif

    bind_global("peg-lang", _G_SEXPR);  // language parser start symbol
    bind_global("empty-env", _EMPTY_ENV);
    bind_global("global-env", _GLOBAL_ENV);

    bind_global("eval", _M_EVAL);
    bind_global("apply", _M_APPLY);
    bind_global("quote", FX_QUOTE);
    bind_global("lambda", FX_LAMBDA);
    bind_global("vau", FX_VAU);
    bind_global("define", FX_DEFINE);
    bind_global("zip", _M_ZIP);
    bind_global("if", FX_IF);
    bind_global("cond", FX_COND);
#if !EVLIS_IS_PAR
    bind_global("par", FX_PAR);
#endif
    bind_global("seq", FX_SEQ);
    bind_global("list", _F_LIST);
    bind_global("cons", _F_CONS);
    bind_global("car", _F_CAR);
    bind_global("cdr", _F_CDR);
    bind_global("eq?", _F_EQ_P);
    bind_global("pair?", _F_PAIR_P);
    bind_global("symbol?", _F_SYM_P);
    bind_global("cadr", _F_CADR);
    bind_global("caddr", _F_CADDR);
    bind_global("nth", _F_NTH);
    bind_global("null?", _F_NULL_P);
    bind_global("boolean?", _F_BOOL_P);
    bind_global("number?", _F_NUM_P);
    bind_global("actor?", _F_ACT_P);
    bind_global("=", _F_NUM_EQ);
    bind_global("<", _F_NUM_LT);
    bind_global("<=", _F_NUM_LE);
    bind_global(">=", _F_NUM_GE);
    bind_global(">", _F_NUM_GT);
    bind_global("+", _F_NUM_ADD);
    bind_global("-", _F_NUM_SUB);
    bind_global("*", _F_NUM_MUL);
    bind_global("list->number", _F_LST_NUM);
    bind_global("list->symbol", _F_LST_SYM);
    bind_global("print", _F_PRINT);

#if SCHEME_ACTORS
    bind_global("BEH", FX_M_BEH);
    bind_global("CREATE", _F_CREATE);
    bind_global("SEND", _F_SEND);
    bind_global("CALL", _F_CALL);
#endif // SCHEME_ACTORS

#if ASM_TOOLS_SCM
    bind_global("UNDEF", UNDEF);
    bind_global("NIL", NIL);
    bind_global("FALSE", FALSE);
    bind_global("TRUE", TRUE);
    bind_global("UNIT", UNIT);

    bind_global("Literal_T", Literal_T);
    bind_global("Type_T", Type_T);
    bind_global("Event_T", Event_T);
    bind_global("Instr_T", Instr_T);
    bind_global("Actor_T", Actor_T);
    bind_global("Fixnum_T", Fixnum_T);
    bind_global("Symbol_T", Symbol_T);
    bind_global("Pair_T", Pair_T);
    bind_global("Fexpr_T", Fexpr_T);
    bind_global("Dict_T", Dict_T);
    bind_global("Free_T", Free_T);

    bind_global("VM_typeq", VM_typeq);
    bind_global("VM_cell", VM_cell);
    bind_global("VM_get", VM_get);
    bind_global("VM_set", VM_set);
    bind_global("VM_pair", VM_pair);
    bind_global("VM_part", VM_part);
    bind_global("VM_nth", VM_nth);
    bind_global("VM_push", VM_push);
    bind_global("VM_depth", VM_depth);
    bind_global("VM_drop", VM_drop);
    bind_global("VM_pick", VM_pick);
    bind_global("VM_dup", VM_dup);
    bind_global("VM_roll", VM_roll);
    bind_global("VM_alu", VM_alu);
    bind_global("VM_eq", VM_eq);
    bind_global("VM_cmp", VM_cmp);
    bind_global("VM_if", VM_if);
    bind_global("VM_msg", VM_msg);
    bind_global("VM_my", VM_my);
    bind_global("VM_send", VM_send);
    bind_global("VM_new", VM_new);
    bind_global("VM_beh", VM_beh);
    bind_global("VM_end", VM_end);
    bind_global("VM_cvt", VM_cvt);
    bind_global("VM_putc", VM_putc);
    bind_global("VM_getc", VM_getc);
    bind_global("VM_debug", VM_debug);

    bind_global("FLD_T", FLD_T);
    bind_global("FLD_X", FLD_X);
    bind_global("FLD_Y", FLD_Y);
    bind_global("FLD_Z", FLD_Z);

    bind_global("ALU_NOT", ALU_NOT);
    bind_global("ALU_AND", ALU_AND);
    bind_global("ALU_OR", ALU_OR);
    bind_global("ALU_XOR", ALU_XOR);
    bind_global("ALU_ADD", ALU_ADD);
    bind_global("ALU_SUB", ALU_SUB);
    bind_global("ALU_MUL", ALU_MUL);

    bind_global("CMP_EQ", CMP_EQ);
    bind_global("CMP_GE", CMP_GE);
    bind_global("CMP_GT", CMP_GT);
    bind_global("CMP_LT", CMP_LT);
    bind_global("CMP_LE", CMP_LE);
    bind_global("CMP_NE", CMP_NE);
    bind_global("CMP_CLS", CMP_CLS);

    bind_global("MY_SELF", MY_SELF);
    bind_global("MY_BEH", MY_BEH);
    bind_global("MY_STATE", MY_STATE);

    bind_global("END_ABORT", END_ABORT);
    bind_global("END_STOP", END_STOP);
    bind_global("END_COMMIT", END_COMMIT);
    bind_global("END_RELEASE", END_RELEASE);

    bind_global("CVT_LST_NUM", CVT_LST_NUM);
    bind_global("CVT_LST_SYM", CVT_LST_SYM);

    //bind_global("START", START);
    bind_global("RV_SELF", RV_SELF);
    bind_global("CUST_SEND", CUST_SEND);
    bind_global("SEND_0", SEND_0);
    bind_global("COMMIT", COMMIT);
    bind_global("RESEND", RESEND);
    bind_global("RELEASE_0", RELEASE_0);
    bind_global("RELEASE", RELEASE);

    bind_global("RV_FALSE", RV_FALSE);
    bind_global("RV_TRUE", RV_TRUE);
    bind_global("RV_NIL", RV_NIL);
    bind_global("RV_UNDEF", RV_UNDEF);
    bind_global("RV_UNIT", RV_UNIT);
    bind_global("RV_ZERO", RV_ZERO);
    bind_global("RV_ONE", RV_ONE);

    bind_global("cell", _F_CELL);
    bind_global("get-t", _F_GET_T);
    bind_global("get-x", _F_GET_X);
    bind_global("get-y", _F_GET_Y);
    bind_global("get-z", _F_GET_Z);
    bind_global("set-t", _F_SET_T);
    bind_global("set-x", _F_SET_X);
    bind_global("set-y", _F_SET_Y);
    bind_global("set-z", _F_SET_Z);
#endif //ASM_TOOLS_SCM

#if (PEG_TOOLS_SCM || ASM_TOOLS_SCM)
    bind_global("CTL", TO_FIX(CTL));
    bind_global("DGT", TO_FIX(DGT));
    bind_global("UPR", TO_FIX(UPR));
    bind_global("LWR", TO_FIX(LWR));
    bind_global("DLM", TO_FIX(DLM));
    bind_global("SYM", TO_FIX(SYM));
    bind_global("HEX", TO_FIX(HEX));
    bind_global("WSP", TO_FIX(WSP));
#endif

#if PEG_TOOLS_SCM
    bind_global("peg-empty", _G_EMPTY);
    bind_global("peg-fail", _G_FAIL);
    bind_global("peg-any", _G_ANY);
    bind_global("peg-eq", _F_G_EQ);
    bind_global("peg-or", _F_G_OR);
    bind_global("peg-and", _F_G_AND);
    bind_global("peg-not", _F_G_NOT);
    bind_global("peg-class", _F_G_CLS);
    bind_global("peg-opt", _F_G_OPT);
    bind_global("peg-plus", _F_G_PLUS);
    bind_global("peg-star", _F_G_STAR);
    bind_global("peg-alt", _F_G_ALT);
    bind_global("peg-seq", _F_G_SEQ);
    bind_global("peg-call", FX_G_CALL);
    bind_global("peg-pred", _F_G_PRED);
    bind_global("peg-xform", _F_G_XFORM);
    bind_global("peg-source", _F_S_LIST);
    bind_global("peg-start", _F_G_START);
    bind_global("peg-chain", _F_S_CHAIN);

    bind_global("peg-end", _G_END);
    bind_global("lex-eol", _G_EOL);
    bind_global("lex-optwsp", _G_WSP_S);
    bind_global("scm-to-eol", _G_TO_EOL);
    bind_global("scm-comment", _G_COMMENT);
    bind_global("scm-optwsp", _G_OPTWSP);
    bind_global("lex-eot", _G_EOT);
    bind_global("scm-const", _G_CONST);
    bind_global("lex-sign", _G_SIGN);
    bind_global("lex-digit", _G_DIGIT);
    bind_global("lex-digits", _G_DIGITS);
    bind_global("lex-number", _G_NUMBER);
    bind_global("scm-symbol", _G_SYMBOL);
    bind_global("scm-quoted", _G_QUOTED);
    bind_global("scm-dotted", _G_DOTTED);
    bind_global("scm-tail", _G_TAIL);
    bind_global("scm-list", _G_LIST);
    bind_global("scm-expr", _G_EXPR);
    bind_global("scm-sexpr", _G_SEXPR);
#endif // PEG_TOOLS_SCM

    bind_global("a-print", _A_PRINT);
    bind_global("quit", _A_QUIT);
    return UNIT;
}

/*
 * bootstrap
 */

static char repl_lib[] =
#if EVLIS_IS_PAR
" (define par (lambda _))"
#endif
" (define caar (lambda (x) (car (car x))))"
" (define cdar (lambda (x) (cdr (car x))))"
" (define cddr (lambda (x) (nth -2 x))))"
" (define cadar (lambda (x) (cadr (car x))))"
" (define cadddr (lambda (x) (nth 4 x))))"
" (define not (lambda (x) (if x #f #t))))"
" (define equal? (lambda (x y) (if (pair? x) (if (pair? y) (if (equal? (car x) (car y)) (equal? (cdr x) (cdr y)) #f) #f) (eq? x y))))"
" (define length (lambda (x) (if (pair? x) (+ (length (cdr x)) 1) 0)))"
" (define list* (lambda (h . t) (if (pair? t) (cons h (apply list* t)) h)))"
" (define append (lambda x (if (pair? x) (apply (lambda (h . t)"
"   (if (pair? t) (if (pair? h) (cons (car h) (apply append (cons (cdr h) t))) (apply append t)) h)) x) x)))"
" (define filter (lambda (pred? xs) (if (pair? xs) (if (pred? (car xs))"
"   (cons (car xs) (filter pred? (cdr xs))) (filter pred? (cdr xs))) ())))"
" (define reduce (lambda (op z xs) (if (pair? xs) (if (pair? (cdr xs)) (op (car xs) (reduce op z (cdr xs))) (car xs)) z)))"
" (define foldl (lambda (op z xs) (if (pair? xs) (foldl op (op z (car xs)) (cdr xs)) z)))"
" (define foldr (lambda (op z xs) (if (pair? xs) (op (car xs) (foldr op z (cdr xs))) z)))"
" (define reverse (lambda (xs) (foldl (lambda (x y) (cons y x)) () xs)))"
//" (define map (lambda (f xs) (if (pair? xs) (cons (f (car xs)) (map f (cdr xs))) ())))"
" (define map (lambda (f . xs) (if (pair? (car xs))"
"   (cons (apply f (foldr (lambda (x y) (cons (car x) y)) () xs))"
"   (apply map (cons f (foldr (lambda (x y) (cons (cdr x) y)) () xs)))) ())))"
" (define current-env (vau _ e e))"
" (define macro (vau (frml . body) env"
"   (eval (list vau frml '_env_ (list eval (cons seq body) '_env_)) env) ))"
" (define let (macro (bindings . body) (cons (list* lambda (map car bindings) body) (map cadr bindings))))"
" (define and (macro x (if (pair? x) (if (pair? (cdr x))"
"   (list let (list (list '_test_ (car x))) (list if '_test_ (cons 'and (cdr x)) '_test_)) (car x)) #t)))"
" (define or (macro x (if (pair? x) (if (pair? (cdr x))"
"   (list let (list (list '_test_ (car x))) (list if '_test_ '_test_ (cons 'or (cdr x)))) (car x)) #f)))"
#if QQUOTE_SYNTAX
" (define quasiquote (vau (x) e (if (pair? x)"
"   (if (eq? (car x) 'unquote) (eval (cadr x) e)"
"   (quasi-list x e)) x)))"
" (define quasi-list (lambda (x e) (if (pair? x) (if (pair? (car x))"
"   (if (eq? (caar x) 'unquote-splicing) (append (eval (cadar x) e) (quasi-list (cdr x) e))"
"   (cons (apply quasiquote (list (car x)) e) (quasi-list (cdr x) e)))"
"   (cons (car x) (quasi-list (cdr x) e))) x)))"
" (define gensym (lambda () (cell Symbol_T (get-x '_) (get-y '_))))"
#endif // QQUOTE_SYNTAX
" \0";
static char *repl_inp = repl_lib;

#if BOOTSTRAP_LIB
int_t console_stdio = FALSE;  // start reading from repl_lib
#else
int_t console_stdio = TRUE;  // start reading from stdio
#endif

int_t console_putc(int_t c) {
    ASSERT(IS_FIX(c));
    c = TO_INT(c);
    if (console_stdio != FALSE) {
        putchar(c);
    }
    return UNIT;
}

int_t console_getc() {
    int_t c = -1;  // EOS
    if (console_stdio != FALSE) {
        c = getchar();
    } else if (repl_inp && (c = *repl_inp)) {
        if (*++repl_inp == '\0') {
            console_stdio = TRUE;  // switch to stdio
        }
    } else {
        console_stdio = TRUE;  // switch to stdio
    }
    c = TO_FIX(c);
    return c;
}

int main(int argc, char const *argv[])
{
    DEBUG(hexdump("repl_lib", ((int_t *)repl_lib), 16));
#if 0
    // display character class table
    printf("| ch | dec | hex | CTL | DGT | UPR | LWR | DLM | SYM | HEX | WSP |\n");
    printf("|----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|\n");
    for (int i = 0; i < 0x80; ++i) {
        if (i == 0x7F) {
            printf("| ^? ");
        } else if (char_class[i] & CTL) {
            printf("| ^%c ", (i + '@'));
        } else {
            printf("| %c  ", i);
        }
        printf("| %3d ", i);
        printf("|  %02x ", i);
        printf("|%s", (char_class[i] & CTL) ? "  x  " : "     ");
        printf("|%s", (char_class[i] & DGT) ? "  x  " : "     ");
        printf("|%s", (char_class[i] & UPR) ? "  x  " : "     ");
        printf("|%s", (char_class[i] & LWR) ? "  x  " : "     ");
        printf("|%s", (char_class[i] & DLM) ? "  x  " : "     ");
        printf("|%s", (char_class[i] & SYM) ? "  x  " : "     ");
        printf("|%s", (char_class[i] & HEX) ? "  x  " : "     ");
        printf("|%s", (char_class[i] & WSP) ? "  x  " : "     ");
        printf("|\n");
    }
    // compare with: echo 'ufork' | cksum
    int_t str = cstr_to_list("ufork\n");
    fprintf(stderr, "%"PRIu32" %"PdI"\n", list_crc(str), list_len(str));
#else
    DEBUG(fprintf(stderr, "CELL_MAX=%"PuI"\n", CELL_MAX));
    DEBUG(hexdump("cell memory", ((int_t *)cell_zero), 16*4));
    DEBUG(dump_cell_map());
    init_global_env();
    gc_add_root(clk_init(_A_CLOCK));

    runtime();  // event-dispatch and instruction-execution loop

    DEBUG(test_symbol_intern());
    //DEBUG(hexdump("cell memory", ((int_t *)&cell_table[500]), 16*4));
#if CONCURRENT_GC
    gc_dump_map();
#endif
#if MARK_SWEEP_GC
    gc_mark_and_sweep(TRUE);
#endif // MARK_SWEEP_GC
    DEBUG(fprintf(stderr, "cell_top=%"PuI" gc_free_cnt=%"PdI"\n", cell_top, TO_INT(gc_free_cnt)));
#if RUNTIME_STATS
    fprintf(stderr, "events=%ld instructions=%ld gc_cycles=%ld\n",
        event_count, instruction_count, gc_cycle_count);
#endif
#endif
    return 0;
}

/*
 * error handling
 */

int_t panic(char *reason) {
    fprintf(stderr, "\nPANIC! %s\n", reason);
    exit(-1);
    return UNDEF;  // not reached, but typed for easy swap with error()
}

int_t warning(char *reason) {
    fprintf(stderr, "\nWarning! %s\n", reason);
    return UNDEF;
}

int_t error(char *reason) {
    fprintf(stderr, "\nERROR! %s\n", reason);
    return UNDEF;
}

int_t failure(char *_file_, int _line_) {
    fprintf(stderr, "\nASSERT FAILED! %s:%d\n", _file_, _line_);
    exit(-1);
    return UNDEF;  // not reached, but typed for easy swap with error()
}
