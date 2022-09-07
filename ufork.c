/*
 * ufork.c -- Actor Virtual Machine
 * Copyright 2022 Dale Schumacher
 */

/**
See further [https://github.com/organix/uFork/blob/master/ufork.md]
**/

#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdint.h>     // for intptr_t, uintptr_t, uint8_t, uint16_t, etc.
#include <inttypes.h>   // for PRIiPTR, PRIuPTR, PRIxPTR, etc.
#include <time.h>       // for clock_t, clock(), etc.

#define INCLUDE_DEBUG 1 // include debugging facilities
#define RUN_DEBUGGER  1 // run program under interactive debugger
#define EXPLICIT_FREE 1 // explicitly free known-dead memory
#define MARK_SWEEP_GC 1 // stop-the-world garbage collection
#define CONCURRENT_GC 0 // concurrent garbage collection
#define RUNTIME_STATS 1 // collect statistics on the runtime
#define SCM_PEG_TOOLS 0 // include PEG tools for LISP/Scheme (+232 cells)
#define BOOTSTRAP_LIB 1 // include bootstrap library definitions
#define EVLIS_IS_PAR  0 // concurrent argument-list evaluation
#define SCM_ASM_TOOLS 1 // include assembly tools for LISP/Scheme
#define QQUOTE_SYNTAX 1 // include support for quasiquote, et. al.
#define PLACEH_SYNTAX 1 // include support for placeholder variables (?x)
#define META_ACTORS   1 // include meta-actor definitions

#if INCLUDE_DEBUG
#define DEBUG(x)    x   // include/exclude debug instrumentation
#define TRACE(x)    x   // include/exclude debug trace
#define XTRACE(x)       // include/exclude execution trace
#else
#define DEBUG(x)        // exclude debug instrumentation
#define TRACE(x)        // include/exclude debug trace
#define XTRACE(x)       // exclude execution trace
#endif

#if EXPLICIT_FREE
#define XFREE(x)    cell_free(x)
#else
#define XFREE(x)    UNDEF
#endif

// choose a definition of "machine word" from the following:
#define USE_INT16_T   1 // int16_t from <stdint.h>
#define USE_INT32_T   0 // int32_t from <stdint.h>
#define USE_INT64_T   0 // int64_t from <stdint.h>
#define USE_INTPTR_T  0 // intptr_t from <stdint.h>

#if USE_INT16_T
typedef int16_t int_t;
typedef uint16_t nat_t;
typedef void *ptr_t;
#define PdI PRId16
#define PuI PRIu16
#define PxI PRIx16
#endif
#if USE_INT32_T
typedef int32_t int_t;
typedef uint32_t nat_t;
typedef void *ptr_t;
#define PdI PRId32
#define PuI PRIu32
#define PxI PRIx32
#endif
#if USE_INT64_T
typedef int64_t int_t;
typedef uint64_t nat_t;
typedef void *ptr_t;
#define PdI PRId64
#define PuI PRIu64
#define PxI PRIx64
#endif
#if USE_INTPTR_T
typedef intptr_t int_t;
typedef uintptr_t nat_t;
typedef void *ptr_t;
#define PdI PRIdPTR
#define PuI PRIuPTR
#define PxI PRIxPTR
#endif

// WASM base types
typedef int32_t i32;
typedef int64_t i64;
#define I32(x) ((i32)(x))
#define I64(x) ((i64)(x))

#define INT(n) ((int_t)(n))
#define NAT(n) ((nat_t)(n))
#define PTR(n) ((ptr_t)(n))

#define MSB(n) NAT(~(NAT(-1)>>(n)))
#define MSB1   NAT(MSB(1))
#define MSB2   NAT(MSB1>>1)
#define TAG    (MSB1|MSB2)

#define TO_REF(v)   INT((v) & ~TAG)
#define TO_CAP(v)   INT(((v) & ~MSB1) | MSB2)
#define IS_VAL(v)   ((v) & MSB1)
#define IS_REF(v)   (!((v) & TAG))
#define IS_CAP(v)   (((v) & TAG) == MSB2)

#define TO_INT(v)   INT(INT(NAT(v) << 1) >> 1)
#define TO_FIX(n)   INT((n) | MSB1)
#define IS_FIX(n)   IS_VAL(n)

typedef struct cell {
    int_t       t;      // proc/type (code offset from proc_zero)
    int_t       x;      // head/car  (data offset from cell_zero)
    int_t       y;      // tail/cdr  (data offset from cell_zero)
    int_t       z;      // link/next (data offset from cell_zero)
} cell_t;

#define PROC_DECL(name)  int_t name(int_t self, int_t arg)

typedef PROC_DECL((*proc_t));

int_t sane = 0;  // run-away loop prevention
#define SANITY (420)

// FORWARD DECLARATIONS
int_t panic(char *reason);
int_t warning(char *reason);
int_t error(char *reason);
int_t failure(char *_file_, int _line_);
int_t console_putc(int_t c);
int_t console_getc();
void print_word(char* prefix, int_t word);
void print_quad(char* prefix, int_t quad);
void print_sexpr(int_t x);
#if INCLUDE_DEBUG
void hexdump(char *label, int_t *addr, size_t cnt);
void debug_print(char *label, int_t addr);
void print_event(int_t ep);
void print_inst(int_t ip);
void print_list(int_t xs);
void continuation_trace();
int_t debugger();
#endif // INCLUDE_DEBUG

#define ASSERT(cond)    if (!(cond)) return failure(__FILE__, __LINE__)

// literal values
#define UNDEF       (0)
#define NIL         (1)
#define FALSE       (2)
#define TRUE        (3)
#define UNIT        (4)
// type markers
#define Literal_T   UNDEF
#define Type_T      (5)
#define Event_T     (6)
#define Opcode_T    (7)
#define Actor_T     (8)
#define Fixnum_T    (9)
#define Symbol_T    (10)
#define Pair_T      (11)
#define Fexpr_T     (12)
#define Free_T      (13)
// entry-point
#define START       (14)

/*
 * native code procedures
 */

// FORWARD DECLARATIONS
PROC_DECL(vm_illegal);
PROC_DECL(vm_typeq);
PROC_DECL(vm_cell);
PROC_DECL(vm_get);
PROC_DECL(vm_set);
PROC_DECL(vm_pair);
PROC_DECL(vm_part);
PROC_DECL(vm_nth);
PROC_DECL(vm_push);
PROC_DECL(vm_depth);
PROC_DECL(vm_drop);
PROC_DECL(vm_pick);
PROC_DECL(vm_dup);
PROC_DECL(vm_roll);
PROC_DECL(vm_alu);
PROC_DECL(vm_eq);
PROC_DECL(vm_cmp);
PROC_DECL(vm_if);
PROC_DECL(vm_msg);
PROC_DECL(vm_self);
PROC_DECL(vm_send);
PROC_DECL(vm_new);
PROC_DECL(vm_beh);
PROC_DECL(vm_end);
PROC_DECL(vm_cvt);
PROC_DECL(vm_putc);
PROC_DECL(vm_getc);
PROC_DECL(vm_debug);

#define VM_typeq    TO_FIX(0)
#define VM_cell     TO_FIX(1)
#define VM_get      TO_FIX(2)
#define VM_set      TO_FIX(3)
#define VM_pair     TO_FIX(4)
#define VM_part     TO_FIX(5)
#define VM_nth      TO_FIX(6)
#define VM_push     TO_FIX(7)
#define VM_depth    TO_FIX(8)
#define VM_drop     TO_FIX(9)
#define VM_pick     TO_FIX(10)
#define VM_dup      TO_FIX(11)
#define VM_roll     TO_FIX(12)
#define VM_alu      TO_FIX(13)
#define VM_eq       TO_FIX(14)
#define VM_cmp      TO_FIX(15)
#define VM_if       TO_FIX(16)
#define VM_msg      TO_FIX(17)
#define VM_self     TO_FIX(18)
#define VM_send     TO_FIX(19)
#define VM_new      TO_FIX(20)
#define VM_beh      TO_FIX(21)
#define VM_end      TO_FIX(22)
#define VM_cvt      TO_FIX(23)
#define VM_putc     TO_FIX(24)
#define VM_getc     TO_FIX(25)
#define VM_debug    TO_FIX(26)

#define PROC_MAX    NAT(sizeof(proc_table) / sizeof(proc_t))
proc_t proc_table[] = {
    vm_typeq,
    vm_cell,
    vm_get,
    vm_set,
    vm_pair,
    vm_part,
    vm_nth,
    vm_push,
    vm_depth,
    vm_drop,
    vm_pick,
    vm_dup,
    vm_roll,
    vm_alu,
    vm_eq,
    vm_cmp,
    vm_if,
    vm_msg,
    vm_self,
    vm_send,
    vm_new,
    vm_beh,
    vm_end,
    vm_cvt,
    vm_putc,
    vm_getc,
    vm_debug,
};

static char *proc_label(int_t proc) {
    static char *label[] = {
        "VM_typeq",
        "VM_cell",
        "VM_get",
        "VM_set",
        "VM_pair",
        "VM_part",
        "VM_nth",
        "VM_push",
        "VM_depth",
        "VM_drop",
        "VM_pick",
        "VM_dup",
        "VM_roll",
        "VM_alu",
        "VM_eq",
        "VM_cmp",
        "VM_if",
        "VM_msg",
        "VM_self",
        "VM_send",
        "VM_new",
        "VM_beh",
        "VM_end",
        "VM_cvt",
        "VM_putc",
        "VM_getc",
        "VM_debug",
    };
    nat_t ofs = NAT(TO_INT(proc));
    if (ofs < PROC_MAX) return label[ofs];
    return "<unknown>";
}

// VM_get/VM_set fields
#define FLD_T       TO_FIX(0)
#define FLD_X       TO_FIX(1)
#define FLD_Y       TO_FIX(2)
#define FLD_Z       TO_FIX(3)

// VM_alu operations
#define ALU_NOT     TO_FIX(0)
#define ALU_AND     TO_FIX(1)
#define ALU_OR      TO_FIX(2)
#define ALU_XOR     TO_FIX(3)
#define ALU_ADD     TO_FIX(4)
#define ALU_SUB     TO_FIX(5)
#define ALU_MUL     TO_FIX(6)

// VM_cmp relations
#define CMP_EQ      TO_FIX(0)
#define CMP_GE      TO_FIX(1)
#define CMP_GT      TO_FIX(2)
#define CMP_LT      TO_FIX(3)
#define CMP_LE      TO_FIX(4)
#define CMP_NE      TO_FIX(5)
#define CMP_CLS     TO_FIX(6)

// VM_end thread action
#define END_ABORT   TO_FIX(-1)
#define END_STOP    TO_FIX(0)
#define END_COMMIT  TO_FIX(+1)
#define END_RELEASE TO_FIX(+2)

// VM_cvt conversions
#define CVT_LST_NUM TO_FIX(0)
#define CVT_LST_SYM TO_FIX(1)

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

static char *cell_label(int_t cell) {
    static char *label[] = {
        "#?",       // UNDEF and Literal_T
        "()",       // NIL
        "#f",       // FALSE
        "#t",       // TRUE
        "#unit",    // UNIT
        "Type_T",
        "Event_T",
        "Opcode_T",
        "Actor_T",
        "Fixnum_T",
        "Symbol_T",
        "Pair_T",
        "Fexpr_T",
        "Free_T",
    };
    if (NAT(cell) < START) return label[cell];
    if (IS_FIX(cell)) return "fix";
    if (IS_CAP(cell)) return "cap";
    return "cell";
}

#define CELL_MAX NAT(1<<14)  // 16K cells
cell_t cell_table[CELL_MAX] = {
    { .t=Literal_T,     .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  0: UNDEF = #?
    { .t=Literal_T,     .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  1: NIL = ()
    { .t=Literal_T,     .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  2: FALSE = #f
    { .t=Literal_T,     .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  3: TRUE = #t
    { .t=Literal_T,     .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  4: UNIT = #unit
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  5: Type_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  6: Event_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  7: Opcode_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  8: Actor_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  //  9: Fixnum_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  // 10: Symbol_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  // 11: Pair_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  // 12: Fexpr_T
    { .t=Type_T,        .x=UNDEF,       .y=UNDEF,       .z=UNDEF,       },  // 13: Free_T
#define _A_BOOT TO_CAP(100)                                                 //  <--------------- UPDATE THIS MANUALLY!
    { .t=Event_T,       .x=_A_BOOT,     .y=NIL,         .z=NIL          },  // START = (A_BOOT)
#define RV_SELF (START+1)
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=RV_SELF+1,   },  // value = SELF
#define CUST_SEND (RV_SELF+1)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=CUST_SEND+1, },  // cust
#define SEND_0 (CUST_SEND+1)
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(0),   .z=SEND_0+1,    },  // (cust . msg)
#define COMMIT (SEND_0+1)
    { .t=Opcode_T,      .x=VM_end,      .y=END_COMMIT,  .z=UNDEF,       },  // commit actor transaction

#define RESEND (COMMIT+1)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=RESEND+1,    },  // msg
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=SEND_0,      },  // SELF

#define RELEASE_0 (RESEND+2)
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(0),   .z=RELEASE_0+1, },  // (cust . msg)
#define RELEASE (RELEASE_0+1)
    { .t=Opcode_T,      .x=VM_end,      .y=END_RELEASE, .z=UNDEF,       },  // commit transaction and free actor

#define RV_FALSE (RELEASE+1)
    { .t=Opcode_T,      .x=VM_push,     .y=FALSE,       .z=CUST_SEND,   },  // FALSE
#define RV_TRUE (RV_FALSE+1)
    { .t=Opcode_T,      .x=VM_push,     .y=TRUE,        .z=CUST_SEND,   },  // TRUE
#define RV_NIL (RV_TRUE+1)
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=CUST_SEND,   },  // NIL
#define RV_UNDEF (RV_NIL+1)
    { .t=Opcode_T,      .x=VM_push,     .y=UNDEF,       .z=CUST_SEND,   },  // UNDEF
#define RV_UNIT (RV_UNDEF+1)
    { .t=Opcode_T,      .x=VM_push,     .y=UNIT,        .z=CUST_SEND,   },  // UNIT
#define RV_ZERO (RV_UNIT+1)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX(0),   .z=CUST_SEND,   },  // +0
#define RV_ONE (RV_ZERO+1)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX(1),   .z=CUST_SEND,   },  // +1

#define S_VALUE (RV_ONE+1)
//  { .t=Opcode_T,      .x=VM_push,     .y=_in_,        .z=S_VALUE+0,   },  // (token . next) -or- NIL
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=S_VALUE+1,   },  // in
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=SEND_0,      },  // cust

#define S_GETC (S_VALUE+2)
#define S_END_X (S_GETC+9)
#define S_VAL_X (S_GETC+10)
    { .t=Opcode_T,      .x=VM_getc,     .y=UNDEF,       .z=S_GETC+1,    },  // ch
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=S_GETC+2,    },  // ch ch
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('\0'),.z=S_GETC+3,    },
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_LT,      .z=S_GETC+4,    },  // ch < '\0'
    { .t=Opcode_T,      .x=VM_if,       .y=S_END_X,     .z=S_GETC+5,    },

    { .t=Opcode_T,      .x=VM_push,     .y=S_GETC,      .z=S_GETC+6,    },  // S_GETC
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(0),   .z=S_GETC+7,    },  // next
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=S_GETC+8,    },  // ch
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=S_VAL_X,     },  // in = (ch . next)

    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=S_GETC+10,   },  // in = ()

    { .t=Opcode_T,      .x=VM_push,     .y=S_VALUE,     .z=S_GETC+11,   },  // S_VALUE
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(1),   .z=RESEND,      },  // BECOME (S_VALUE in)

#define S_LIST_B (S_GETC+12)
//  { .t=Opcode_T,      .x=VM_push,     .y=_list_,      .z=S_LIST_B+0,  },
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=S_LIST_B+1,  },  // list
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=S_LIST_B+2,  },  // list has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=S_LIST_B+3,  .z=S_END_X,     },  // list

    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=S_LIST_B+4,  },  // tail head
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=S_LIST_B+5,  },  // head tail
    { .t=Opcode_T,      .x=VM_push,     .y=S_LIST_B,    .z=S_LIST_B+6,  },  // S_LIST_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=S_LIST_B+7,  },  // next
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=S_LIST_B+8,  },  // head
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=S_VAL_X,     },  // in = (head . next)

#define G_START (S_LIST_B+9)
//  { .t=Opcode_T,      .x=VM_push,     .y=_custs_,     .z=G_START-1,   },  // (ok . fail)
//  { .t=Opcode_T,      .x=VM_push,     .y=_ptrn_,      .z=G_START+0,   },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=G_START+1,   },  // in
    { .t=Opcode_T,      .x=VM_push,     .y=UNDEF,       .z=G_START+2,   },  // value = UNDEF
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(4),   .z=G_START+3,   },  // custs
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(2),   .z=G_START+4,   },  // (custs value . in)
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=SEND_0,      },  // ptrn

#define G_CALL_B (G_START+5)
//  { .t=Opcode_T,      .x=VM_push,     .y=_symbol_,    .z=G_CALL_B+0,  },  // name = symbol
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_Z,       .z=G_CALL_B+1,  },  // ptrn = lookup(name)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=G_CALL_B+2,  },  // (custs value . in)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // (ptrn custs value . in)

#define G_LANG (G_CALL_B+3)
#define _G_LANG TO_CAP(G_LANG)
    { .t=Actor_T,       .x=G_LANG+1,    .y=NIL,         .z=UNDEF        },
    { .t=Opcode_T,      .x=VM_push,     .y=UNDEF,       .z=G_CALL_B,    },  // {y:symbol} patched by A_BOOT

/*
(define empty-env
  (CREATE
    (BEH (cust . _)
      (SEND cust #undefined))))
*/
#define EMPTY_ENV (G_LANG+2)
#define _EMPTY_ENV TO_CAP(EMPTY_ENV)
    { .t=Actor_T,       .x=RV_UNDEF,    .y=NIL,         .z=UNDEF        },

/*
(define global-env
  (CREATE
    (BEH (cust . key)
      (SEND cust (get_z key)) )))  ; extract value from global symbol table
*/
#define GLOBAL_ENV (EMPTY_ENV+1)
#define _GLOBAL_ENV TO_CAP(GLOBAL_ENV)
    { .t=Actor_T,       .x=GLOBAL_ENV+1,.y=NIL,         .z=UNDEF        },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=GLOBAL_ENV+2,},  // symbol = key
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_Z,       .z=CUST_SEND,   },  // get_z(symbol)

/*
(define bound-beh
  (lambda (var val env)
    (BEH (cust . key)  ; FIXME: implement (cust key value) to "bind"?
      (if (eq? key var)
        (SEND cust val)
        (SEND env (cons cust key))
      ))))
*/
#define BOUND_BEH (GLOBAL_ENV+3)
//  { .t=Opcode_T,      .x=VM_push,     .y=_var_,       .z=BOUND_BEH-2, },
//  { .t=Opcode_T,      .x=VM_push,     .y=_val_,       .z=BOUND_BEH-1, },
//  { .t=Opcode_T,      .x=VM_push,     .y=_env_,       .z=BOUND_BEH+0, },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=BOUND_BEH+1, },  // key
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(4),   .z=BOUND_BEH+2, },  // var
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_EQ,      .z=BOUND_BEH+3, },  // key == var
    { .t=Opcode_T,      .x=VM_if,       .y=BOUND_BEH+4, .z=BOUND_BEH+5, },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // val

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=BOUND_BEH+6, },  // msg
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=SEND_0,      },  // env

#define REPL_R (BOUND_BEH+7)
#define REPL_E (REPL_R+8)
#define _REPL_E TO_CAP(REPL_E)
#define REPL_P (REPL_E+8)
#define _REPL_P TO_CAP(REPL_P)
#define REPL_L (REPL_P+3)
#define REPL_F (REPL_L+4)
#define _REPL_F TO_CAP(REPL_F)
#define _M_EVAL TO_CAP(231)                                                 //  <--------------- UPDATE THIS MANUALLY!
    { .t=Opcode_T,      .x=VM_push,     .y=_REPL_F,     .z=REPL_R+1,    },  // fail = REPL_F
    { .t=Opcode_T,      .x=VM_push,     .y=_REPL_E,     .z=REPL_R+2,    },  // ok = REPL_E
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=REPL_R+3,    },  // custs = (ok . fail)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_LANG,     .z=REPL_R+4,    },  // ptrn = G_LANG
    { .t=Opcode_T,      .x=VM_push,     .y=G_START,     .z=REPL_R+5,    },  // G_START
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=REPL_R+6,    },  // start
    { .t=Opcode_T,      .x=VM_push,     .y=S_GETC,      .z=REPL_R+7,    },  // S_GETC
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(0),   .z=SEND_0,      },  // src

    { .t=Actor_T,       .x=REPL_E+1,    .y=NIL,         .z=UNDEF        },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=REPL_E+2,    },  // sexpr
    { .t=Opcode_T,      .x=VM_debug,    .y=TO_FIX(888), .z=REPL_E+3,    },

    //{ .t=Opcode_T,      .x=VM_push,     .y=_GLOBAL_ENV, .z=REPL_E+4,    },  // env = GLOBAL_ENV
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=REPL_E+4,    },  // env = ()
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=REPL_E+5,    },  // form = sexpr
    { .t=Opcode_T,      .x=VM_push,     .y=_REPL_P,     .z=REPL_E+6,    },  // cust = REPL_P
    { .t=Opcode_T,      .x=VM_push,     .y=_M_EVAL,     .z=REPL_E+7,    },  // M_EVAL
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVAL cust form env)

    { .t=Actor_T,       .x=REPL_P+1,    .y=NIL,         .z=UNDEF        },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=REPL_P+2,    },
    { .t=Opcode_T,      .x=VM_debug,    .y=TO_FIX(999), .z=REPL_L,      },

    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('>'), .z=REPL_L+1,    },
    { .t=Opcode_T,      .x=VM_putc,     .y=UNDEF,       .z=REPL_L+2,    },
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX(' '), .z=REPL_L+3,    },
    { .t=Opcode_T,      .x=VM_putc,     .y=UNDEF,       .z=REPL_R,      },

    { .t=Actor_T,       .x=REPL_F+1,    .y=NIL,         .z=UNDEF        },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=REPL_F+2,    },
    { .t=Opcode_T,      .x=VM_debug,    .y=TO_FIX(666), .z=COMMIT,      },

#define A_BOOT (REPL_F+3)
    { .t=Actor_T,       .x=A_BOOT+1,    .y=NIL,         .z=UNDEF        },  // <--- A_BOOT
    { .t=Opcode_T,      .x=VM_push,     .y=G_LANG+1,    .z=A_BOOT+2,    },  // cell to patch
    { .t=Opcode_T,      .x=VM_push,     .y=A_BOOT+5,    .z=A_BOOT+3,    },  // "peg-lang" string
    { .t=Opcode_T,      .x=VM_cvt,      .y=CVT_LST_SYM, .z=A_BOOT+4,    },
    { .t=Opcode_T,      .x=VM_set,      .y=FLD_Y,       .z=REPL_L,      },  // set_y(symbol)

    { .t=Pair_T,        .x=TO_FIX('p'), .y=A_BOOT+6,    .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('e'), .y=A_BOOT+7,    .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('g'), .y=A_BOOT+8,    .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('-'), .y=A_BOOT+9,    .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('l'), .y=A_BOOT+10,   .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('a'), .y=A_BOOT+11,   .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('n'), .y=A_BOOT+12,   .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('g'), .y=NIL,         .z=UNDEF        },

//
// Clock device driver
//

#define A_CLOCK (A_BOOT+13)
#define _A_CLOCK TO_CAP(A_CLOCK)
    { .t=Actor_T,       .x=A_CLOCK+1,   .y=NIL,         .z=UNDEF        },
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX(-1),  .z=A_CLOCK+2,   },
#define CLOCK_BEH (A_CLOCK+2)
#if 0
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=A_CLOCK+3,   },
    { .t=Opcode_T,      .x=VM_push,     .y=CLOCK_BEH,   .z=A_CLOCK+4,   },
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(1),   .z=COMMIT,      },
#else
    { .t=Opcode_T,      .x=VM_push,     .y=A_CLOCK+1,   .z=A_CLOCK+3,   },  // address of VM_push instruction
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=A_CLOCK+4,   },  // clock value
    { .t=Opcode_T,      .x=VM_set,      .y=FLD_Y,       .z=COMMIT,      },  // update stored value (WARNING! SELF-MODIFYING CODE)
#endif

//
// Low-level Actor idioms
//

/*
(define tag-beh
  (lambda (cust)
    (BEH msg
      (SEND cust (cons SELF msg))
    )))
*/
#define TAG_BEH (A_CLOCK+5)
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=TAG_BEH+0,   },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=TAG_BEH+1,   },  // msg
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=TAG_BEH+2,   },  // SELF
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=TAG_BEH+3,   },  // (SELF . msg)
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=SEND_0,      },  // cust

#define K_JOIN_H (TAG_BEH+4)
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=K_JOIN_H-2,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_head_,      .z=K_JOIN_H-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_k_tail_,    .z=K_JOIN_H+0,  },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=K_JOIN_H+1,  },  // (tag . value)
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=K_JOIN_H+2,  },  // value tag
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=K_JOIN_H+3,  },  // k_tail
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_EQ,      .z=K_JOIN_H+4,  },  // (tag == k_tail)
    { .t=Opcode_T,      .x=VM_if,       .y=K_JOIN_H+5,  .z=RELEASE,     },  // WRONG TAG!
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=K_JOIN_H+6,  },  // value head
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=K_JOIN_H+7,  },  // pair = (head . value)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // pair cust

#define K_JOIN_T (K_JOIN_H+8)
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=K_JOIN_T-2,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_tail_,      .z=K_JOIN_T-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_k_head_,    .z=K_JOIN_T+0,  },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=K_JOIN_T+1,  },  // (tag . value)
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=K_JOIN_T+2,  },  // value tag
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=K_JOIN_T+3,  },  // k_head
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_EQ,      .z=K_JOIN_T+4,  },  // (tag == k_head)
    { .t=Opcode_T,      .x=VM_if,       .y=K_JOIN_T+5,  .z=RELEASE,     },  // WRONG TAG!
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=K_JOIN_T+6,  },  // pair = (value . tail)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // pair cust

/*
(define join-beh
  (lambda (cust k_head k_tail)
    (BEH (tag . value))
      ;
      ))
*/
#define JOIN_BEH (K_JOIN_T+7)
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=JOIN_BEH-2,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_k_head_,    .z=JOIN_BEH-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_k_tail_,    .z=JOIN_BEH+0,  },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=JOIN_BEH+1,  },  // (tag . value)
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=JOIN_BEH+2,  },  // value tag

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(4),   .z=JOIN_BEH+3,  },  // k_head
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=JOIN_BEH+4,  },  // tag
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_EQ,      .z=JOIN_BEH+5,  },  // (tag == k_head)
    { .t=Opcode_T,      .x=VM_if,       .y=JOIN_BEH+6,  .z=JOIN_BEH+11, },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(5),   .z=JOIN_BEH+7,  },  // k_head k_tail value tag cust
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=JOIN_BEH+8,  },  // k_head k_tail tag cust value
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(4),   .z=JOIN_BEH+9,  },  // k_head tag cust value k_tail
    { .t=Opcode_T,      .x=VM_push,     .y=K_JOIN_H,    .z=JOIN_BEH+10, },  // K_JOIN_H
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(3),   .z=COMMIT,      },  // BECOME (K_JOIN_H cust value k_tail)

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=JOIN_BEH+12, },  // k_tail
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=JOIN_BEH+13, },  // tag
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_EQ,      .z=JOIN_BEH+14, },  // (tag == k_tail)
    { .t=Opcode_T,      .x=VM_if,       .y=JOIN_BEH+15, .z=COMMIT,      },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(5),   .z=JOIN_BEH+16, },  // k_head k_tail value tag cust
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=JOIN_BEH+17, },  // k_head k_tail tag cust value
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(5),   .z=JOIN_BEH+18, },  // k_tail tag cust value k_head
    { .t=Opcode_T,      .x=VM_push,     .y=K_JOIN_T,    .z=JOIN_BEH+19, },  // K_JOIN_T
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(3),   .z=COMMIT,      },  // BECOME (K_JOIN_T cust value k_head)

/*
(define fork-beh
  (lambda (cust head tail)
    (BEH (h-req t-req))
      ;
      ))
*/
#define FORK_BEH (JOIN_BEH+20)
//  { .t=Opcode_T,      .x=VM_push,     .y=_tail_,      .z=FORK_BEH-2,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_head_,      .z=FORK_BEH-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=FORK_BEH+0,  },

    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=FORK_BEH+1,  },  // self
    { .t=Opcode_T,      .x=VM_push,     .y=TAG_BEH,     .z=FORK_BEH+2,  },  // TAG_BEH
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=FORK_BEH+3,  },  // k_head

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=FORK_BEH+4,  },  // h_req
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=FORK_BEH+5,  },  // k_head
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=FORK_BEH+6,  },  // msg = (k_head . h_req)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(4),   .z=FORK_BEH+7,  },  // tail cust k_head msg head
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(0),   .z=FORK_BEH+8,  },  // (head . msg)

    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=FORK_BEH+9,  },  // self
    { .t=Opcode_T,      .x=VM_push,     .y=TAG_BEH,     .z=FORK_BEH+10, },  // TAG_BEH
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=FORK_BEH+11, },  // k_tail

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=FORK_BEH+12, },  // t_req
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=FORK_BEH+13, },  // k_tail
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=FORK_BEH+14, },  // msg = (k_tail . t_req)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(5),   .z=FORK_BEH+15, },  // cust k_head k_tail msg tail
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(0),   .z=FORK_BEH+16, },  // (tail . msg)

    { .t=Opcode_T,      .x=VM_push,     .y=JOIN_BEH,    .z=FORK_BEH+17, },  // JOIN_BEH
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(3),   .z=COMMIT,      },  // BECOME (JOIN_BEH cust k_head k_tail)

//
// Static Symbols
//

#define S_IGNORE (FORK_BEH+18)
    { .t=Symbol_T,      .x=0,           .y=S_IGNORE+1,  .z=UNDEF,       },
    { .t=Pair_T,        .x=TO_FIX('_'), .y=NIL,         .z=UNDEF        },

#define S_QUOTE (S_IGNORE+2)
    { .t=Symbol_T,      .x=0,           .y=S_QUOTE+1,   .z=UNDEF,       },
    { .t=Pair_T,        .x=TO_FIX('q'), .y=S_QUOTE+2,   .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('u'), .y=S_QUOTE+3,   .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('o'), .y=S_QUOTE+4,   .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('t'), .y=S_QUOTE+5,   .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('e'), .y=NIL,         .z=UNDEF        },

#define S_QQUOTE (S_QUOTE+6)
    { .t=Symbol_T,      .x=0,           .y=S_QQUOTE+1,  .z=UNDEF,       },
    { .t=Pair_T,        .x=TO_FIX('q'), .y=S_QQUOTE+2,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('u'), .y=S_QQUOTE+3,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('a'), .y=S_QQUOTE+4,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('s'), .y=S_QQUOTE+5,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('i'), .y=S_QQUOTE+6,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('q'), .y=S_QQUOTE+7,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('u'), .y=S_QQUOTE+8,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('o'), .y=S_QQUOTE+9,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('t'), .y=S_QQUOTE+10, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('e'), .y=NIL,         .z=UNDEF        },

#define S_UNQUOTE (S_QQUOTE+11)
    { .t=Symbol_T,      .x=0,           .y=S_UNQUOTE+1, .z=UNDEF,       },
    { .t=Pair_T,        .x=TO_FIX('u'), .y=S_UNQUOTE+2, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('n'), .y=S_UNQUOTE+3, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('q'), .y=S_UNQUOTE+4, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('u'), .y=S_UNQUOTE+5, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('o'), .y=S_UNQUOTE+6, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('t'), .y=S_UNQUOTE+7, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('e'), .y=NIL,         .z=UNDEF        },

#define S_QSPLICE (S_UNQUOTE+8)
    { .t=Symbol_T,      .x=0,           .y=S_QSPLICE+1, .z=UNDEF,       },
    { .t=Pair_T,        .x=TO_FIX('u'), .y=S_QSPLICE+2, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('n'), .y=S_QSPLICE+3, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('q'), .y=S_QSPLICE+4, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('u'), .y=S_QSPLICE+5, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('o'), .y=S_QSPLICE+6, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('t'), .y=S_QSPLICE+7, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('e'), .y=S_QSPLICE+8, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('-'), .y=S_QSPLICE+9, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('s'), .y=S_QSPLICE+10,.z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('p'), .y=S_QSPLICE+11,.z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('l'), .y=S_QSPLICE+12,.z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('i'), .y=S_QSPLICE+13,.z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('c'), .y=S_QSPLICE+14,.z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('i'), .y=S_QSPLICE+15,.z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('n'), .y=S_QSPLICE+16,.z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('g'), .y=NIL,         .z=UNDEF        },

#define S_PLACEH (S_QSPLICE+17)
    { .t=Symbol_T,      .x=0,           .y=S_PLACEH+1,  .z=UNDEF,       },
    { .t=Pair_T,        .x=TO_FIX('p'), .y=S_PLACEH+2,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('l'), .y=S_PLACEH+3,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('a'), .y=S_PLACEH+4,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('c'), .y=S_PLACEH+5,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('e'), .y=S_PLACEH+6,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('h'), .y=S_PLACEH+7,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('o'), .y=S_PLACEH+8,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('l'), .y=S_PLACEH+9,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('d'), .y=S_PLACEH+10, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('e'), .y=S_PLACEH+11, .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('r'), .y=NIL,         .z=UNDEF        },

//
// Meta-circular LISP/Scheme Interpreter
//

#define M_EVAL (S_PLACEH+12)
//#define _M_EVAL TO_CAP(M_EVAL) <--- explicitly defined above...
#define K_COMBINE (M_EVAL+20)
#define K_APPLY_F (K_COMBINE+17)
#define M_APPLY (K_APPLY_F+4)
#define _M_APPLY TO_CAP(M_APPLY)
#define M_LOOKUP (M_APPLY+17)
#define _M_LOOKUP TO_CAP(M_LOOKUP)
#define M_EVLIS_P (M_LOOKUP+23)
#define M_EVLIS_K (M_EVLIS_P+4)
#define M_EVLIS (M_EVLIS_K+6)
#define _M_EVLIS TO_CAP(M_EVLIS)
#define FX_PAR (M_EVLIS+14)
#define OP_PAR (FX_PAR+1)
#define _OP_PAR TO_CAP(OP_PAR)
#define M_ZIP_IT (OP_PAR+20)
#define M_ZIP_K (M_ZIP_IT+12)
#define M_ZIP_P (M_ZIP_K+6)
#define M_ZIP_R (M_ZIP_P+9)
#define M_ZIP_S (M_ZIP_R+11)
#define M_ZIP (M_ZIP_S+7)
#define _M_ZIP TO_CAP(M_ZIP)
#define CLOSURE_B (M_ZIP+6)
#define M_EVAL_B (CLOSURE_B+13)
#define FEXPR_B (M_EVAL_B+5)
#define K_SEQ_B (FEXPR_B+15)
#define M_IF_K (K_SEQ_B+15)

/*
(define eval
  (lambda (form env)
    (if (symbol? form)                  ; bound variable
      (lookup form env)
      (if (pair? form)                  ; combination
        (let ((fn    (eval (car form) env))
              (opnds (cdr form)))
          (if (actor? fn)               ; _applicative_
            (CALL fn (evlis opnds env))
            (if (fexpr?)                ; _operative_
              (CALL (get-x fn) (list opnds env))
              #?)))
        form))))                        ; self-evaluating form
*/
    { .t=Actor_T,       .x=M_EVAL+1,    .y=NIL,         .z=UNDEF        },  // (cust form env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_EVAL+2,    },  // form = arg1
    { .t=Opcode_T,      .x=VM_typeq,    .y=Symbol_T,    .z=M_EVAL+3,    },  // form has type Symbol_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_EVAL+4,    .z=M_EVAL+6,    },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=M_EVAL+5,    },  // msg = (cust form env)
    { .t=Opcode_T,      .x=VM_push,     .y=_M_LOOKUP,   .z=SEND_0,      },  // (M_LOOKUP cust key alist)

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_EVAL+7,    },  // form = arg1
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=M_EVAL+8,    },  // form has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_EVAL+10,   .z=M_EVAL+9,    },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // self-eval form

/*
      (if (pair? form)                  ; combination
        (let ((fn    (eval (car form) env))
              (opnds (cdr form)))
*/
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=M_EVAL+11,   },  // env
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_EVAL+12,   },  // form
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=M_EVAL+13,   },  // tail head

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=M_EVAL+14,   },  // env
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=M_EVAL+15,   },  // opnds = tail
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=M_EVAL+16,   },  // cust
    { .t=Opcode_T,      .x=VM_push,     .y=K_COMBINE,   .z=M_EVAL+17,   },  // K_COMBINE
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(3),   .z=M_EVAL+18,   },  // k_combine = (K_COMBINE env tail cust)

    { .t=Opcode_T,      .x=VM_push,     .y=_M_EVAL,     .z=M_EVAL+19,   },  // M_EVAL
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVAL k_combine head env)

/*
          (if (actor? fn)               ; _applicative_
            (CALL fn (evlis opnds env))
            (if (fexpr?)                ; _operative_
              (CALL (get-x fn) (list opnds env))
              #?)))
*/
//  { .t=Opcode_T,      .x=VM_push,     .y=_env_,       .z=K_COMBINE-2, },
//  { .t=Opcode_T,      .x=VM_push,     .y=_opnds_,     .z=K_COMBINE-1, },
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=K_COMBINE+0, },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=K_COMBINE+1, },  // fn
    { .t=Opcode_T,      .x=VM_typeq,    .y=Actor_T,     .z=K_COMBINE+2, },  // fn has type Actor_T
    { .t=Opcode_T,      .x=VM_if,       .y=K_COMBINE+12,.z=K_COMBINE+3, },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=K_COMBINE+4, },  // fn
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fexpr_T,     .z=K_COMBINE+5, },  // fn has type Fexpr_T
    { .t=Opcode_T,      .x=VM_if,       .y=K_COMBINE+9, .z=K_COMBINE+6, },

    { .t=Opcode_T,      .x=VM_push,     .y=UNDEF,       .z=K_COMBINE+7, },  // UNDEF
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=K_COMBINE+8, },  // UNDEF cust
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(0),   .z=RELEASE,     },  // (cust . UNDEF)

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=K_COMBINE+10,},  // env opnds cust fn
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_X,       .z=K_COMBINE+11,},  // oper = get_x(fn)
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=RELEASE,     },  // (oper cust args env)

// env opnds cust
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=K_COMBINE+13,},  // fn
    { .t=Opcode_T,      .x=VM_push,     .y=K_APPLY_F,   .z=K_COMBINE+14,},  // K_APPLY_F
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=K_COMBINE+15,},  // k_apply = (K_APPLY_F cust fn)

#if EVLIS_IS_PAR
    { .t=Opcode_T,      .x=VM_push,     .y=_OP_PAR,     .z=K_COMBINE+16,},  // OP_PAR
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=RELEASE,     },  // (OP_PAR k_apply opnds env)
#else
    { .t=Opcode_T,      .x=VM_push,     .y=_M_EVLIS,    .z=K_COMBINE+16,},  // M_EVLIS
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=RELEASE,     },  // (M_EVLIS k_apply opnds env)
#endif

/*
            (CALL fn (evlis opnds env))
*/
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=K_APPLY_F-1, },
//  { .t=Opcode_T,      .x=VM_push,     .y=_fn_,        .z=K_APPLY_F+0, },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=K_APPLY_F+1, },  // args
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=K_APPLY_F+2, },  // fn args cust
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=K_APPLY_F+3, },  // fn (cust . args)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // (cust . args) fn

/*
(define apply
  (lambda (fn args env)
    (if (actor? fn)                     ; _compiled_
      (CALL fn args)
      (if (fexpr? fn)                   ; _interpreted_
        (CALL (get-x fn) (list args env))
        #?))))
*/
    { .t=Actor_T,       .x=M_APPLY+1,   .y=NIL,         .z=UNDEF        },  // (cust fn args env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_APPLY+2,   },  // fn = arg1
    { .t=Opcode_T,      .x=VM_typeq,    .y=Actor_T,     .z=M_APPLY+3,   },  // fn has type Actor_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_APPLY+4,   .z=M_APPLY+8,   },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=M_APPLY+5,   },  // args
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=M_APPLY+6,   },  // cust
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_APPLY+7,   },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=SEND_0,      },  // fn

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_APPLY+9,   },  // fn = arg1
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fexpr_T,     .z=M_APPLY+10,  },  // fn has type Fexpr_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_APPLY+11,  .z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(4),   .z=M_APPLY+12,  },  // env
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=M_APPLY+13,  },  // args
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=M_APPLY+14,  },  // cust
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_APPLY+15,  },  // fn
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_X,       .z=M_APPLY+16,  },  // oper = get_x(fn)
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (oper cust args env)

/*
(define lookup                          ; look up variable binding in environment
  (lambda (key env)
    (if (pair? env)                     ; association list
      (if (eq? (caar env) key)
        (cdar env)
        (lookup key (cdr env)))
      (if (actor? env)
        (CALL env key)                  ; delegate to environment actor
        (if (symbol? key)
          (get-z key)                   ; get top-level binding
          #?))))                        ; value is undefined
*/
    { .t=Actor_T,       .x=M_LOOKUP+1,  .y=NIL,         .z=UNDEF        },  // (cust key env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=M_LOOKUP+2,  },  // env = arg2

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=M_LOOKUP+3,  },  // env env
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=M_LOOKUP+4,  },  // env has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_LOOKUP+5,  .z=M_LOOKUP+11, },

    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=M_LOOKUP+6,  },  // tail head
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=M_LOOKUP+7,  },  // tail value name
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_LOOKUP+8,  },  // key = arg1
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_EQ,      .z=M_LOOKUP+9,  },  // (name == key)
    { .t=Opcode_T,      .x=VM_if,       .y=CUST_SEND,   .z=M_LOOKUP+10, },
    { .t=Opcode_T,      .x=VM_drop,     .y=TO_FIX(1),   .z=M_LOOKUP+2,  },  // env = tail

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=M_LOOKUP+12, },  // env env
    { .t=Opcode_T,      .x=VM_typeq,    .y=Actor_T,     .z=M_LOOKUP+13, },  // env has type Actor_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_LOOKUP+14, .z=M_LOOKUP+18, },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_LOOKUP+15, },  // key = arg1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=M_LOOKUP+16, },  // cust = arg0
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_LOOKUP+17, },  // (cust . key)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // (cust . key) env

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_LOOKUP+19, },  // key = arg1
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=M_LOOKUP+20, },  // key key
    { .t=Opcode_T,      .x=VM_typeq,    .y=Symbol_T,    .z=M_LOOKUP+21, },  // key has type Symbol_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_LOOKUP+22, .z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_get,      .y=FLD_Z,       .z=CUST_SEND,   },  // global binding from Symbol_T

/*
(define evlis                           ; map `eval` over a list of operands
  (lambda (opnds env)
    (if (pair? opnds)
      (cons (eval (car opnds) env) (evlis (cdr opnds) env))
      ())))                             ; value is NIL
*/
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=M_EVLIS_P-1, },
//  { .t=Opcode_T,      .x=VM_push,     .y=_head_,      .z=M_EVLIS_P+0, },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=M_EVLIS_P+1, },  // tail
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=M_EVLIS_P+2, },  // head
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_EVLIS_P+3, },  // (head . tail)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // cust

//  { .t=Opcode_T,      .x=VM_push,     .y=_env_,       .z=M_EVLIS_K-2, },
//  { .t=Opcode_T,      .x=VM_push,     .y=_rest_,      .z=M_EVLIS_K-1, },
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=M_EVLIS_K+0, },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=M_EVLIS_K+1, },  // head
    { .t=Opcode_T,      .x=VM_push,     .y=M_EVLIS_P,   .z=M_EVLIS_K+2, },  // M_EVLIS_P
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=M_EVLIS_K+3, },  // BECOME (M_EVLIS_P cust head)
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=M_EVLIS_K+4, },  // SELF
    { .t=Opcode_T,      .x=VM_push,     .y=_M_EVLIS,    .z=M_EVLIS_K+5, },  // M_EVLIS
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVLIS SELF rest env)

    { .t=Actor_T,       .x=M_EVLIS+1,   .y=NIL,         .z=UNDEF        },  // (cust opnds env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_EVLIS+2,   },  // opnds = arg1
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=M_EVLIS+3,   },  // opnds has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_EVLIS+4,   .z=RV_NIL,      },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=M_EVLIS+5,   },  // env = arg2
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_EVLIS+6,   },  // opnds = arg1
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=M_EVLIS+7,   },  // rest first

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=M_EVLIS+8,   },  // env
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=M_EVLIS+9,   },  // rest
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=M_EVLIS+10,  },  // cust
    { .t=Opcode_T,      .x=VM_push,     .y=M_EVLIS_K,   .z=M_EVLIS+11,  },  // M_EVLIS_K
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(3),   .z=M_EVLIS+12,  },  // k_eval = (M_EVLIS_K env rest cust)

    { .t=Opcode_T,      .x=VM_push,     .y=_M_EVAL,     .z=M_EVLIS+13,  },  // M_EVAL
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVAL k_eval first env)

/*
(define op-par                          ; (par . <exprs>)
  (CREATE
    (BEH (cust opnds env)
      (if (pair? opnds)
        (SEND
          (CREATE (fork-beh cust eval op-par))
          (list ((car opnds) env) ((cdr opnds) env)))
        (SEND cust ()))
      )))
*/
    { .t=Fexpr_T,       .x=_OP_PAR,     .y=UNDEF,       .z=UNDEF,       },  // (par . <exprs>)

    { .t=Actor_T,       .x=OP_PAR+1,    .y=NIL,         .z=UNDEF        },  // (cust opnds env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_PAR+2,    },  // exprs = opnds
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=OP_PAR+3,    },  // exprs has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=OP_PAR+4,    .z=RV_NIL,      },

    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=OP_PAR+5,    },  // ()
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=OP_PAR+6,    },  // env
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_PAR+7,    },  // exprs = opnds
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(-1),  .z=OP_PAR+8,    },  // cdr(exprs)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(2),   .z=OP_PAR+9,    },  // t_req = (cdr(exprs) env)

    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=OP_PAR+10,   },  // ()
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=OP_PAR+11,   },  // env
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_PAR+12,   },  // exprs = opnds
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=OP_PAR+13,   },  // car(exprs)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(2),   .z=OP_PAR+14,   },  // h_req = (car(exprs) env)

    { .t=Opcode_T,      .x=VM_push,     .y=_OP_PAR,     .z=OP_PAR+15,   },  // tail = OP_PAR
    { .t=Opcode_T,      .x=VM_push,     .y=_M_EVAL,     .z=OP_PAR+16,   },  // head = M_EVAL
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=OP_PAR+17,   },  // cust
    { .t=Opcode_T,      .x=VM_push,     .y=FORK_BEH,    .z=OP_PAR+18,   },  // FORK_BEH
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(3),   .z=OP_PAR+19,   },  // ev_fork = (FORK_BEH OP_PAR M_EVAL cust)

    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(2),   .z=COMMIT,      },  // (ev_fork h_req t_req)

/*
(define var-name? (lambda (x) (if (symbol? x) (if (eq? x '_) #f #t) #f)))
(define zip-it                          ; extend `env` by binding names `x` to values `y`
  (lambda (x y xs ys env)
    (cond
      ((pair? x)
        (if (null? (cdr x))
          (zip-it (car x) (car y) xs ys env)
          (zip-it (car x) (car y) (cons (cdr x) xs) (cons (cdr y) ys) env)))
      ((var-name? x)
        (zip-it xs ys () () (cons (cons x y) env)))
      ((null? xs)
        env)
      (#t
        (zip-it xs ys () () env))
    )))
*/
//  { .t=Opcode_T,      .x=VM_push,     .y=_ys_,        .z=M_ZIP_IT-4,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_xs_,        .z=M_ZIP_IT-3,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_y_,         .z=M_ZIP_IT-2,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_x_,         .z=M_ZIP_IT-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_env_,       .z=M_ZIP_IT+0,  },

// ys xs y x env
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=M_ZIP_IT+1,  },  // x
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=M_ZIP_IT+2,  },  // x has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_ZIP_P,     .z=M_ZIP_IT+3,  },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=M_ZIP_IT+4,  },  // x
    { .t=Opcode_T,      .x=VM_typeq,    .y=Symbol_T,    .z=M_ZIP_IT+5,  },  // x has type Symbol_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_ZIP_IT+6,  .z=M_ZIP_IT+9,  },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=M_ZIP_IT+7,  },  // x
    { .t=Opcode_T,      .x=VM_eq,       .y=S_IGNORE,    .z=M_ZIP_IT+8,  },  // (x == '_)
    { .t=Opcode_T,      .x=VM_if,       .y=M_ZIP_IT+9,  .z=M_ZIP_S,     },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(4),   .z=M_ZIP_IT+10, },  // xs
    { .t=Opcode_T,      .x=VM_eq,       .y=NIL,         .z=M_ZIP_IT+11, },  // (xs == NIL)
    { .t=Opcode_T,      .x=VM_if,       .y=CUST_SEND,   .z=M_ZIP_K,     },  // return(env)

// ys xs y x env
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-3),  .z=M_ZIP_K+1,   },  // ys xs env y x
    { .t=Opcode_T,      .x=VM_drop,     .y=TO_FIX(2),   .z=M_ZIP_K+2,   },  // ys xs env
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=M_ZIP_K+3,   },  // ys xs env ()
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-4),  .z=M_ZIP_K+4,   },  // () ys xs env
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=M_ZIP_K+5,   },  // () ys xs env ()
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-4),  .z=M_ZIP_IT,    },  // () () ys xs env

/*
        (if (null? (cdr x))
          (zip-it (car x) (car y) xs ys env)
*/
// ys xs y x env
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=M_ZIP_P+1,   },  // x
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(-1),  .z=M_ZIP_P+2,   },  // cdr(x)
    { .t=Opcode_T,      .x=VM_eq,       .y=NIL,         .z=M_ZIP_P+3,   },  // (cdr(x) == NIL)
    { .t=Opcode_T,      .x=VM_if,       .y=M_ZIP_P+4,   .z=M_ZIP_R,     },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=M_ZIP_P+5,   },  // ys xs x env y
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=M_ZIP_P+6,   },  // ys xs x env car(y)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=M_ZIP_P+7,   },  // ys xs env car(y) x
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=M_ZIP_P+8,   },  // ys xs env car(y) car(x)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=M_ZIP_IT,    },  // ys xs car(y) car(x) env

/*
          (zip-it (car x) (car y) (cons (cdr x) xs) (cons (cdr y) ys) env)))
*/
// ys xs y x env
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(5),   .z=M_ZIP_R+1,   },  // xs y x env ys
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(4),   .z=M_ZIP_R+2,   },  // xs x env ys y
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=M_ZIP_R+3,   },  // xs x env ys cdr(y) car(y)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-6),  .z=M_ZIP_R+4,   },  // car(y) xs x env ys cdr(y)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_ZIP_R+5,   },  // car(y) xs x env (cdr(y) . ys)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-5),  .z=M_ZIP_R+6,   },  // (cdr(y) . ys) car(y) xs x env
// ys' y' xs x env
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-3),  .z=M_ZIP_R+7,   },  // ys' y' env xs x
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=M_ZIP_R+8,   },  // ys' y' env xs cdr(x) car(x)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-4),  .z=M_ZIP_R+9,   },  // ys' y' car(x) env xs cdr(x)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_ZIP_R+10,  },  // ys' y' car(x) env (cdr(x) . xs)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-4),  .z=M_ZIP_IT,    },  // ys' (cdr(x) . xs) y' car(x) env

/*
        (zip-it xs ys () () (cons (cons x y) env)))
*/
// ys xs y x env
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-3),  .z=M_ZIP_S+1,   },  // ys xs env y x
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_ZIP_S+2,   },  // ys xs env (x . y)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_ZIP_S+3,   },  // ys xs ((x . y) . env)
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=M_ZIP_S+4,   },  // ys xs env' ()
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-4),  .z=M_ZIP_S+5,   },  // () ys xs env'
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=M_ZIP_S+6,   },  // () ys xs env' ()
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-4),  .z=M_ZIP_IT,    },  // () () ys xs env'

/*
(define zip                             ; extend `env` by binding names `x` to values `y`
  (lambda (x y env)
    (zip-it x y () () env)))
*/
    { .t=Actor_T,       .x=M_ZIP+1,     .y=NIL,         .z=UNDEF        },  // (cust x y env)
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=M_ZIP+2,     },  // ys = ()
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=M_ZIP+3,     },  // xs = ()
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=M_ZIP+4,     },  // y = arg2
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_ZIP+5,     },  // x = arg1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(4),   .z=M_ZIP_IT,    },  // env = arg3

/*
(define closure-beh                     ; lexically-bound applicative procedure
  (lambda (frml body env)
    (BEH (cust . args)
      (SEND cust
        (evbody #unit body (zip frml args (scope env)))))))
*/
//  { .t=Opcode_T,      .x=VM_push,     .y=_frml_,      .z=CLOSURE_B-2, },
//  { .t=Opcode_T,      .x=VM_push,     .y=_body_,      .z=CLOSURE_B-1, },
//  { .t=Opcode_T,      .x=VM_push,     .y=_env_,       .z=CLOSURE_B+0, },
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=CLOSURE_B+1, },  // env
    { .t=Opcode_T,      .x=VM_push,     .y=UNDEF,       .z=CLOSURE_B+2, },  // #?
    { .t=Opcode_T,      .x=VM_push,     .y=S_IGNORE,    .z=CLOSURE_B+3, },  // '_
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=CLOSURE_B+4, },  // ('_ . #?)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=CLOSURE_B+5, },  // env' = (('_ . #?) . env)

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=CLOSURE_B+6, },  // args
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(5),   .z=CLOSURE_B+7, },  // frml

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=CLOSURE_B+8, },  // cust
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(6),   .z=CLOSURE_B+9, },  // body
    { .t=Opcode_T,      .x=VM_push,     .y=M_EVAL_B,    .z=CLOSURE_B+10,},  // M_EVAL_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=CLOSURE_B+11,},  // k_eval = (M_EVAL_B cust body)

    { .t=Opcode_T,      .x=VM_push,     .y=_M_ZIP,      .z=CLOSURE_B+12,},  // M_ZIP
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(4),   .z=COMMIT,      },  // (M_ZIP k_eval frml args env')

//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=M_EVAL_B-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_body_,      .z=M_EVAL_B-0,  },
    { .t=Opcode_T,      .x=VM_push,     .y=UNIT,        .z=M_EVAL_B+1,  },  // UNIT
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-3),  .z=M_EVAL_B+2,  },  // #unit cust body

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=M_EVAL_B+3,  },  // env
    { .t=Opcode_T,      .x=VM_push,     .y=K_SEQ_B,     .z=M_EVAL_B+4,  },  // K_SEQ_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(3),   .z=SEND_0,      },  // k-seq = (K_SEQ_B cust body env)

/*
(define fexpr-beh                       ; lexically-bound operative procedure
  (lambda (frml body denv)
    (BEH (cust opnds senv)
      (SEND cust
        (evbody #unit body (zip frml (cons denv opnds) (scope senv)))))))
*/
//  { .t=Opcode_T,      .x=VM_push,     .y=_frml_,      .z=FEXPR_B-2,   },
//  { .t=Opcode_T,      .x=VM_push,     .y=_body_,      .z=FEXPR_B-1,   },
//  { .t=Opcode_T,      .x=VM_push,     .y=_senv_,      .z=FEXPR_B+0,   },
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=FEXPR_B+1,   },  // senv
    { .t=Opcode_T,      .x=VM_push,     .y=UNDEF,       .z=FEXPR_B+2,   },  // #?
    { .t=Opcode_T,      .x=VM_push,     .y=S_IGNORE,    .z=FEXPR_B+3,   },  // '_
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=FEXPR_B+4,   },  // ('_ . #?)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=FEXPR_B+5,   },  // env' = (('_ . #?) . senv)

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=FEXPR_B+6,   },  // opnds
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=FEXPR_B+7,   },  // denv
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=FEXPR_B+8,   },  // opnds' = (denv . opnds)

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(5),   .z=FEXPR_B+9,   },  // frml'

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=FEXPR_B+10,  },  // cust
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(6),   .z=FEXPR_B+11,  },  // body
    { .t=Opcode_T,      .x=VM_push,     .y=M_EVAL_B,    .z=FEXPR_B+12,  },  // M_EVAL_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=FEXPR_B+13,  },  // k_eval = (M_EVAL_B cust body)

    { .t=Opcode_T,      .x=VM_push,     .y=_M_ZIP,      .z=FEXPR_B+14,  },  // M_ZIP
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(4),   .z=COMMIT,      },  // (M_ZIP k_eval frml' opnds' env')

/*
(define k-seq-beh
  (lambda (cust body env)
    (BEH value
      (if (pair? body)
        (SEND
          (CREATE (k-seq-beh cust (cdr body) env))  ; BECOME this...
          (eval (car body) env))
        (SEND cust value)) )))
*/
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=K_SEQ_B-2,   },
//  { .t=Opcode_T,      .x=VM_push,     .y=_body_,      .z=K_SEQ_B-1,   },
//  { .t=Opcode_T,      .x=VM_push,     .y=_env_,       .z=K_SEQ_B+0,   },
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=K_SEQ_B+1,   },  // body
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=K_SEQ_B+2,   },  // body has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=K_SEQ_B+5,   .z=K_SEQ_B+3,   },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=K_SEQ_B+4,   },  // value
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(4),   .z=RELEASE_0,   },  // (cust . value)

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=K_SEQ_B+6,   },  // cust env body
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=K_SEQ_B+7,   },  // rest first

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=K_SEQ_B+8,   },  // env
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=K_SEQ_B+9,   },  // expr = first
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=K_SEQ_B+10,  },  // cust = SELF
    { .t=Opcode_T,      .x=VM_push,     .y=_M_EVAL,     .z=K_SEQ_B+11,  },  // M_EVAL
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=K_SEQ_B+12,  },  // (M_EVAL SELF first env)

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-2),  .z=K_SEQ_B+13,  },  // cust rest env
    { .t=Opcode_T,      .x=VM_push,     .y=K_SEQ_B,     .z=K_SEQ_B+14,  },  // K_SEQ_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(3),   .z=COMMIT,      },  // BECOME (K_SEQ_B cust rest env)

/*
(define evalif                          ; if `test` is #f, evaluate `altn`,
  (lambda (test cnsq altn env)          ; otherwise evaluate `cnsq`.
    (if test
      (eval cnsq env)
      (eval altn env))))
*/
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=M_IF_K-2,    },
//  { .t=Opcode_T,      .x=VM_push,     .y=_env_,       .z=M_IF_K-1,    },
//  { .t=Opcode_T,      .x=VM_push,     .y=_cont_,      .z=M_IF_K+0,    },  // (cnsq altn)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=M_IF_K+1,    },  // bool
    { .t=Opcode_T,      .x=VM_if,       .y=M_IF_K+2,    .z=M_IF_K+3,    },

    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=M_IF_K+4,    },  // cnsq

    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(2),   .z=M_IF_K+4,    },  // altn

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=M_IF_K+5,    },  // cust
    { .t=Opcode_T,      .x=VM_push,     .y=_M_EVAL,     .z=M_IF_K+6,    },  // M_EVAL
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=RELEASE,     },  // (M_EVAL cust cnsq/altn env)

/*
(define bind-env                        ; update binding in environment
  (lambda (key val env)
    (if (pair? env)                     ; association list
      (if (eq? (caar env) '_)
        (seq                            ; insert new binding
          (set-cdr env (cons (car env) (cdr env)))
          (set-car env (cons key val)))
        (if (eq? (caar env) key)
          (set-cdr (car env) val)       ; mutate binding
          (bind-env key val (cdr env))))
      (if (symbol? key)
        (set-z key val)))               ; set top-level binding
    #unit))                             ; value is UNIT
*/
#define M_BIND_E (M_IF_K+7)
#define _M_BIND_E TO_CAP(M_BIND_E)
    { .t=Actor_T,       .x=M_BIND_E+1,  .y=NIL,         .z=UNDEF        },  // (cust key val env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(4),   .z=M_BIND_E+2,  },  // env = arg3

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=M_BIND_E+3,  },  // env env
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=M_BIND_E+4,  },  // env has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_BIND_E+5,  .z=M_BIND_E+25, },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=M_BIND_E+6,  },  // env env
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=M_BIND_E+7,  },  // cdr(env) car(env)
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=M_BIND_E+8,  },  // car(env) car(env)
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=M_BIND_E+9,  },  // caar(env)
    { .t=Opcode_T,      .x=VM_eq,       .y=S_IGNORE,    .z=M_BIND_E+10, },  // (caar(env) == '_)
    { .t=Opcode_T,      .x=VM_if,       .y=M_BIND_E+11, .z=M_BIND_E+17, },

    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_BIND_E+12, },  // (car(env) . cdr(env))
    { .t=Opcode_T,      .x=VM_set,      .y=FLD_Y,       .z=M_BIND_E+13, },  // set-cdr

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=M_BIND_E+14, },  // val = arg2
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_BIND_E+15, },  // key = arg1
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_BIND_E+16, },  // (key . val)
    { .t=Opcode_T,      .x=VM_set,      .y=FLD_X,       .z=RV_UNIT,     },  // set-car

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=M_BIND_E+18, },  // car(env) car(env)
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=M_BIND_E+19, },  // caar(env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_BIND_E+20, },  // key = arg1
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_EQ,      .z=M_BIND_E+21, },  // (caar(env) == key)
    { .t=Opcode_T,      .x=VM_if,       .y=M_BIND_E+22, .z=M_BIND_E+24, },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=M_BIND_E+23, },  // val = arg2
    { .t=Opcode_T,      .x=VM_set,      .y=FLD_Y,       .z=RV_UNIT,     },  // set-cdr

    { .t=Opcode_T,      .x=VM_drop,     .y=TO_FIX(1),   .z=M_BIND_E+2,  },  // (bind-env key val (cdr env))

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_BIND_E+26, },  // key = arg1
    { .t=Opcode_T,      .x=VM_typeq,    .y=Symbol_T,    .z=M_BIND_E+27, },  // key has type Symbol_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_BIND_E+28, .z=RV_UNIT,     },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_BIND_E+29, },  // key = arg1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=M_BIND_E+30, },  // val = arg2
    { .t=Opcode_T,      .x=VM_set,      .y=FLD_Z,       .z=RV_UNIT,     },  // bind(key, val)

/*
(define op-quote                        ; (quote <form>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (car opnds)
      ))))
*/
#define FX_QUOTE (M_BIND_E+31)
#define OP_QUOTE (FX_QUOTE+1)
#define _OP_QUOTE TO_CAP(OP_QUOTE)
    { .t=Fexpr_T,       .x=_OP_QUOTE,   .y=UNDEF,       .z=UNDEF,       },  // (quote <form>)

    { .t=Actor_T,       .x=OP_QUOTE+1,  .y=NIL,         .z=UNDEF        },  // (cust opnds env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_QUOTE+2,  },  // opnds
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // form = car(opnds)

/*
(define op-lambda                       ; (lambda <frml> . <body>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (CREATE (closure-beh (car opnds) (cdr opnds) env))
      ))))
*/
#define FX_LAMBDA (OP_QUOTE+3)
#define OP_LAMBDA (FX_LAMBDA+1)
#define _OP_LAMBDA TO_CAP(OP_LAMBDA)
    { .t=Fexpr_T,       .x=_OP_LAMBDA,  .y=UNDEF,       .z=UNDEF,       },  // (lambda <frml> . <body>)

    { .t=Actor_T,       .x=OP_LAMBDA+1, .y=NIL,         .z=UNDEF        },  // (cust opnds env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_LAMBDA+2, },  // opnds
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=OP_LAMBDA+3, },  // frml = car(opnds)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_LAMBDA+4, },  // opnds
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(-1),  .z=OP_LAMBDA+5, },  // body = cdr(opnds)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=OP_LAMBDA+6, },  // env
    { .t=Opcode_T,      .x=VM_push,     .y=CLOSURE_B,   .z=OP_LAMBDA+7, },  // CLOSURE_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(3),   .z=CUST_SEND,   },  // closure = (CLOSURE_B frml body env)

/*
(define op-vau                          ; (vau <frml> <evar> . <body>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (cell Fexpr_T
          (CREATE (fexpr-beh (cons (cadr opnds) (car opnds)) (cddr opnds) env)))
      ))))
*/
#define FX_VAU (OP_LAMBDA+8)
#define OP_VAU (FX_VAU+1)
#define _OP_VAU TO_CAP(OP_VAU)
    { .t=Fexpr_T,       .x=_OP_VAU,     .y=UNDEF,       .z=UNDEF,       },  // (vau <frml> <evar> . <body>)

    { .t=Actor_T,       .x=OP_VAU+1,    .y=NIL,         .z=UNDEF        },  // (cust opnds env)
    { .t=Opcode_T,      .x=VM_push,     .y=Fexpr_T,     .z=OP_VAU+2,    },  // Fexpr_T

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_VAU+3,    },  // opnds
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=OP_VAU+4,    },  // frml = car(opnds)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_VAU+5,    },  // opnds
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(2),   .z=OP_VAU+6,    },  // evar = cadr(opnds)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=OP_VAU+7,    },  // frml' = (evar . frml)

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_VAU+8,    },  // opnds
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(-2),  .z=OP_VAU+9,    },  // body = cddr(opnds)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=OP_VAU+10,   },  // senv = env
    { .t=Opcode_T,      .x=VM_push,     .y=FEXPR_B,     .z=OP_VAU+11,   },  // FEXPR_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(3),   .z=OP_VAU+12,   },  // oper = (FEXPR_B frml' body senv)

    { .t=Opcode_T,      .x=VM_cell,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // fexpr = {t:Fexpr_T, x:oper}

/*
(define k-define-beh
  (lambda (cust env frml)
    (BEH value
      (SEND
        (CREATE (k-defzip-beh cust env))
        (CALL zip (list k-defzip-beh frml value ())) ))))
*/
#define K_DEFINE_B (OP_VAU+13)
#define K_DZIP_B (K_DEFINE_B+8)
#define K_BIND_B (K_DZIP_B+17)
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=K_DEFINE_B-2,},
//  { .t=Opcode_T,      .x=VM_push,     .y=_env_,       .z=K_DEFINE_B-1,},
//  { .t=Opcode_T,      .x=VM_push,     .y=_frml_,      .z=K_DEFINE_B+0,},
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=K_DEFINE_B+1,},  // ()
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=K_DEFINE_B+2,},  // value
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=K_DEFINE_B+3,},  // frml
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=K_DEFINE_B+4,},  // SELF
    { .t=Opcode_T,      .x=VM_push,     .y=_M_ZIP,      .z=K_DEFINE_B+5,},  // M_ZIP
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(4),   .z=K_DEFINE_B+6,},  // (M_ZIP SELF frml value NIL)

    { .t=Opcode_T,      .x=VM_push,     .y=K_DZIP_B,    .z=K_DEFINE_B+7,},  // K_DZIP_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=COMMIT,      },  // BECOME (K_DZIP_B cust env)
/*
(define k-defzip-beh
  (lambda (cust env)
    (BEH alist
      (if (pair? alist)
        (seq
          (define k-bind (CREATE (k-bind-beh cust (cdr alist) env)))
          (SEND bind-env (list k-defbind (caar alist) (cdar alist) env)))
        (SEND cust #unit))
*/
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=K_DZIP_B-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_env_,       .z=K_DZIP_B+0,  },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=K_DZIP_B+1,  },  // alist
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=K_DZIP_B+2,  },  // alist has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=K_DZIP_B+6,  .z=K_DZIP_B+3,  },

    { .t=Opcode_T,      .x=VM_push,     .y=UNIT,        .z=K_DZIP_B+4,  },  // #unit
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=K_DZIP_B+5,  },  // cust
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(0),   .z=RELEASE,     },  // (cust UNIT)

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=K_DZIP_B+7,  },  // alist
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=K_DZIP_B+8,  },  // rest first
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=K_DZIP_B+9,  },  // value symbol
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(4),   .z=K_DZIP_B+10, },  // env
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-3),  .z=K_DZIP_B+11, },  // rest env value symbol
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=K_DZIP_B+12, },  // SELF
    { .t=Opcode_T,      .x=VM_push,     .y=_M_BIND_E,   .z=K_DZIP_B+13, },  // M_BIND_E
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(4),   .z=K_DZIP_B+14, },  // (M_BIND_E SELF symbol value env)

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(-2),  .z=K_DZIP_B+15, },  // cust rest env
    { .t=Opcode_T,      .x=VM_push,     .y=K_BIND_B,    .z=K_DZIP_B+16, },  // K_BIND_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(3),   .z=COMMIT,      },  // BECOME (K_BIND_B cust rest env)
/*
(define k-bind-beh
  (lambda (cust alist env)
    (BEH _
      (BECOME (k-defzip-beh cust env))
      (SEND SELF alist) )))
*/
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=K_BIND_B-2,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_alist_,     .z=K_BIND_B-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_env_,       .z=K_BIND_B+0,  },
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=K_BIND_B+1,  },  // alist
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=K_BIND_B+2,  },  // SELF
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(0),   .z=K_BIND_B+3,  },  // (SELF alist)

    { .t=Opcode_T,      .x=VM_push,     .y=K_DZIP_B,    .z=K_BIND_B+4,  },  // K_DZIP_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=COMMIT,      },  // BECOME (K_DZIP_B cust env)

/*
(define bind-each
  (lambda (alist env)
    (if (pair? alist)
      (seq
        (bind-env (caar alist) (cdar alist) env)
        (bind-each (cdr alist) env))
      #unit)))
(define op-define                       ; (define <frml> <expr>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (bind-each (zip (car opnds) (eval (cadr opnds) env) ()) env)
      ))))
*/
#define FX_DEFINE (K_BIND_B+5)
#define OP_DEFINE (FX_DEFINE+1)
#define _OP_DEFINE TO_CAP(OP_DEFINE)
    { .t=Fexpr_T,       .x=_OP_DEFINE,  .y=UNDEF,       .z=UNDEF,       },  // (define <frml> <expr>)

    { .t=Actor_T,       .x=OP_DEFINE+1, .y=NIL,         .z=UNDEF        },  // (cust opnds env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=OP_DEFINE+2, },  // env
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_DEFINE+3, },  // opnds
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(2),   .z=OP_DEFINE+4, },  // expr = cadr(opnds)

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=OP_DEFINE+5, },  // cust
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=OP_DEFINE+6, },  // env
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_DEFINE+7, },  // opnds
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=OP_DEFINE+8, },  // frml = car(opnds)
    { .t=Opcode_T,      .x=VM_push,     .y=K_DEFINE_B,  .z=OP_DEFINE+9, },  // K_DEFINE_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(3),   .z=OP_DEFINE+10,},  // k_define = (K_DEFINE_B cust env frml)

    { .t=Opcode_T,      .x=VM_push,     .y=_M_EVAL,     .z=OP_DEFINE+11,},  // M_EVAL
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVAL k_define expr env)

/*
(define op-if                           ; (if <pred> <cnsq> <altn>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (evalif (eval (car opnds) env) (cadr opnds) (caddr opnds) env)
      ))))
*/
#define FX_IF (OP_DEFINE+12)
#define OP_IF (FX_IF+1)
#define _OP_IF TO_CAP(OP_IF)
    { .t=Fexpr_T,       .x=_OP_IF,      .y=UNDEF,       .z=UNDEF,       },  // (if <pred> <cnsq> <altn>)

    { .t=Actor_T,       .x=OP_IF+1,     .y=NIL,         .z=UNDEF        },  // (cust opnds env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=OP_IF+2,     },  // env
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_IF+3,     },  // opnds
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=OP_IF+4,     },  // (cnsq altn) pred

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=OP_IF+5,     },  // cust
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=OP_IF+6,     },  // env
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(4),   .z=OP_IF+7,     },  // cont = (cnsq altn)
    { .t=Opcode_T,      .x=VM_push,     .y=M_IF_K,      .z=OP_IF+8,     },  // M_IF_K
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(3),   .z=OP_IF+9,     },  // k_if = (M_IF_K cust env cont)

    { .t=Opcode_T,      .x=VM_push,     .y=_M_EVAL,     .z=OP_IF+10,    },  // M_EVAL
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVAL k_if pred env)

/*
(define op-cond                         ; (cond (<test> . <body>) . <clauses>)
  (CREATE
    (BEH (cust opnds env)
      (if (pair? (car opnds))
        (if (eval (caar opnds) env)
          (SEND cust (evbody #unit (cdar opnds) env))
          (SEND SELF (list cust (cdr opnds) env)))
        (SEND cust #?)) )))
*/
#define FX_COND (OP_IF+11)
#define OP_COND (FX_COND+1)
#define _OP_COND TO_CAP(OP_COND)
#define K_COND (OP_COND+17)
    { .t=Fexpr_T,       .x=_OP_COND,    .y=UNDEF,       .z=UNDEF,       },  // (cond (<test> . <body>) . <clauses>)

    { .t=Actor_T,       .x=OP_COND+1,   .y=NIL,         .z=UNDEF        },  // (cust opnds env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_COND+2,   },  // opnds
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=OP_COND+3,   },  // opnds has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=OP_COND+4,   .z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_COND+5,   },  // opnds
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=OP_COND+6,   },  // rest first
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=OP_COND+7,   },  // rest body test

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=OP_COND+8,   },  // env
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=OP_COND+9,   },  // env test

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=OP_COND+10,  },  // cust
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(4),   .z=OP_COND+11,  },  // rest env test cust body
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=OP_COND+12,  },  // env
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(6),   .z=OP_COND+13,  },  // opnds' = rest
    { .t=Opcode_T,      .x=VM_push,     .y=K_COND,      .z=OP_COND+14,  },  // K_COND
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(4),   .z=OP_COND+15,  },  // k_cond = (K_COND cust body env opnds')

    { .t=Opcode_T,      .x=VM_push,     .y=_M_EVAL,     .z=OP_COND+16,  },  // M_EVAL
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVAL k_cond test env)

//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=K_COND-3,    },
//  { .t=Opcode_T,      .x=VM_push,     .y=_body_,      .z=K_COND-2,    },
//  { .t=Opcode_T,      .x=VM_push,     .y=_env_,       .z=K_COND+0,    },
//  { .t=Opcode_T,      .x=VM_push,     .y=_opnds_,     .z=K_COND-1,    },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=K_COND+1,    },  // test_result
    { .t=Opcode_T,      .x=VM_if,       .y=K_COND+2,    .z=K_COND+7,    },

    { .t=Opcode_T,      .x=VM_drop,     .y=TO_FIX(1),   .z=K_COND+3,    },  // cust body env
    { .t=Opcode_T,      .x=VM_push,     .y=K_SEQ_B,     .z=K_COND+4,    },  // K_SEQ_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(3),   .z=K_COND+5,    },  // BECOME (K_SEQ_B cust body env)

    { .t=Opcode_T,      .x=VM_push,     .y=UNIT,        .z=K_COND+6,    },  // UNIT
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=SEND_0,      },  // (SELF . UNIT)

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(4),   .z=K_COND+8,    },  // body env opnds cust
    { .t=Opcode_T,      .x=VM_push,     .y=_OP_COND,    .z=K_COND+9,    },  // OP_COND
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(3),   .z=RELEASE,     },  // (OP_COND cust opnds env)

/*
(define op-seq                          ; (seq . <body>)
  (CREATE
    (BEH (cust opnds env)
      ;(SEND cust (evbody #unit opnds env))
      (SEND (CREATE (k-seq-beh cust opnds env)) #unit)
    )))
*/
#define FX_SEQ (K_COND+10)
#define OP_SEQ (FX_SEQ+1)
#define _OP_SEQ TO_CAP(OP_SEQ)
    { .t=Fexpr_T,       .x=_OP_SEQ,     .y=UNDEF,       .z=UNDEF,       },  // (seq . <body>)

    { .t=Actor_T,       .x=OP_SEQ+1,    .y=NIL,         .z=UNDEF        },  // (cust opnds env)
    { .t=Opcode_T,      .x=VM_push,     .y=UNIT,        .z=OP_SEQ+2,    },  // UNIT

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=OP_SEQ+3,    },  // cust
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_SEQ+4,    },  // body = opnds
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=OP_SEQ+5,    },  // env
    { .t=Opcode_T,      .x=VM_push,     .y=K_SEQ_B,     .z=OP_SEQ+6,    },  // K_SEQ_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(3),   .z=SEND_0,      },  // k-seq = (K_SEQ_B cust opnds env)

//
// Global LISP/Scheme Procedures
//

#define F_LIST (OP_SEQ+7)
#define _F_LIST TO_CAP(F_LIST)
    { .t=Actor_T,       .x=F_LIST+1,    .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=CUST_SEND,   },  // args

#define F_CONS (F_LIST+2)
#define _F_CONS TO_CAP(F_CONS)
    { .t=Actor_T,       .x=F_CONS+1,    .y=NIL,         .z=UNDEF        },  // (cust . args)
#if 1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=F_CONS+2,    },  // tail = arg2
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_CONS+3,    },  // head = arg1
#else
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_CONS+2,    },  // (head tail)
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(2),   .z=F_CONS+3,    },  // () tail head
#endif
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=CUST_SEND,   },  // (head . tail)

#define F_CAR (F_CONS+4)
#define _F_CAR TO_CAP(F_CAR)
    { .t=Actor_T,       .x=F_CAR+1,     .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_CAR+2,     },  // pair = arg1
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // car(pair)

#define F_CDR (F_CAR+3)
#define _F_CDR TO_CAP(F_CDR)
    { .t=Actor_T,       .x=F_CDR+1,     .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_CDR+2,     },  // pair = arg1
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(-1),  .z=CUST_SEND,   },  // cdr(pair)

#define F_CADR (F_CDR+3)
#define _F_CADR TO_CAP(F_CADR)
    { .t=Actor_T,       .x=F_CADR+1,    .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_CADR+2,    },  // pair = arg1
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // cadr(pair)

#define F_CADDR (F_CADR+3)
#define _F_CADDR TO_CAP(F_CADDR)
    { .t=Actor_T,       .x=F_CADDR+1,   .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_CADDR+2,   },  // pair = arg1
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(3),   .z=CUST_SEND,   },  // caddr(pair)

#define F_NTH (F_CADDR+3)
#define _F_NTH TO_CAP(F_NTH)
    { .t=Actor_T,       .x=F_NTH+1,     .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=F_NTH+2,     },  // msg = (cust . args)

    { .t=Opcode_T,      .x=VM_push,     .y=Opcode_T,    .z=F_NTH+3,     },  // Opcode_T
    { .t=Opcode_T,      .x=VM_push,     .y=VM_nth,      .z=F_NTH+4,     },  // VM_nth
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_NTH+5,     },  // index = arg1
    { .t=Opcode_T,      .x=VM_push,     .y=CUST_SEND,   .z=F_NTH+6,     },  // CUST_SEND
    { .t=Opcode_T,      .x=VM_cell,     .y=TO_FIX(4),   .z=F_NTH+7,     },  // beh = {t:Opcode_T,x:VM_nth,y:index,z:CUST_SEND}

    { .t=Opcode_T,      .x=VM_push,     .y=Opcode_T,    .z=F_NTH+8,     },  // Opcode_T
    { .t=Opcode_T,      .x=VM_push,     .y=VM_msg,      .z=F_NTH+9,     },  // VM_msg
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX(3),   .z=F_NTH+10,    },  // 3
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(4),   .z=F_NTH+11,    },  // beh
    { .t=Opcode_T,      .x=VM_cell,     .y=TO_FIX(4),   .z=F_NTH+12,    },  // beh' = {t:Opcode_T,x:VM_msg,y:3,z:beh}

    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(0),   .z=SEND_0,      },  // (k_nth cust . args)

#define F_NULL_P (F_NTH+13)
#define _F_NULL_P TO_CAP(F_NULL_P)
    { .t=Actor_T,       .x=F_NULL_P+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NULL_P+2,  },  // args
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NULL_P+3,  },  // args args
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NULL_P+4,  },  // args has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NULL_P+5,  .z=RV_TRUE,     },
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NULL_P+6,  },  // rest first
    { .t=Opcode_T,      .x=VM_eq,       .y=NIL,         .z=F_NULL_P+7,  },  // first == NIL
    { .t=Opcode_T,      .x=VM_if,       .y=F_NULL_P+2,  .z=RV_FALSE,    },

#define F_TYPE_P (F_NULL_P+8)
//  { .t=Opcode_T,      .x=VM_push,     .y=_type_,      .z=F_TYPE_P+0,  },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_TYPE_P+1,  },  // args
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_TYPE_P+2,  },  // args args
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_TYPE_P+3,  },  // args has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_TYPE_P+4,  .z=RV_TRUE,     },
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_TYPE_P+5,  },  // rest first
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_T,       .z=F_TYPE_P+6,  },  // get_t(first)
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=F_TYPE_P+7,  },  // type
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_EQ,      .z=F_TYPE_P+8,  },  // get_t(first) == type
    { .t=Opcode_T,      .x=VM_if,       .y=F_TYPE_P+1,  .z=RV_FALSE,    },

#define F_PAIR_P (F_TYPE_P+9)
#define _F_PAIR_P TO_CAP(F_PAIR_P)
    { .t=Actor_T,       .x=F_PAIR_P+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_push,     .y=Pair_T,      .z=F_TYPE_P,    },  // type = Pair_T

#define F_BOOL_P (F_PAIR_P+2)
#define _F_BOOL_P TO_CAP(F_BOOL_P)
    { .t=Actor_T,       .x=F_BOOL_P+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_BOOL_P+2,  },  // args
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_BOOL_P+3,  },  // args args
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_BOOL_P+4,  },  // args has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_BOOL_P+5,  .z=RV_TRUE,     },
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_BOOL_P+6,  },  // rest first
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_BOOL_P+7,  },  // first first
    { .t=Opcode_T,      .x=VM_eq,       .y=FALSE,       .z=F_BOOL_P+8,  },  // first == FALSE
    { .t=Opcode_T,      .x=VM_if,       .y=F_BOOL_P+9,  .z=F_BOOL_P+10, },
    { .t=Opcode_T,      .x=VM_drop,     .y=TO_FIX(1),   .z=F_BOOL_P+2,  },  // rest
    { .t=Opcode_T,      .x=VM_eq,       .y=TRUE,        .z=F_BOOL_P+11, },  // first == TRUE
    { .t=Opcode_T,      .x=VM_if,       .y=F_BOOL_P+2,  .z=RV_FALSE,    },

#define F_NUM_P (F_BOOL_P+12)
#define _F_NUM_P TO_CAP(F_NUM_P)
    { .t=Actor_T,       .x=F_NUM_P+1,   .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_P+2,   },  // args
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_P+3,   },  // args args
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_P+4,   },  // args has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_P+5,   .z=RV_TRUE,     },
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_P+6,   },  // rest first
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_P+7,   },  // first has type Fixnum_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_P+2,   .z=RV_FALSE,    },

#define F_SYM_P (F_NUM_P+8)
#define _F_SYM_P TO_CAP(F_SYM_P)
    { .t=Actor_T,       .x=F_SYM_P+1,   .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_push,     .y=Symbol_T,    .z=F_TYPE_P,    },  // type = Symbol_T

#define F_ACT_P (F_SYM_P+2)
#define _F_ACT_P TO_CAP(F_ACT_P)
    { .t=Actor_T,       .x=F_ACT_P+1,   .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_ACT_P+2,   },  // args
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_ACT_P+3,   },  // args args
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_ACT_P+4,   },  // args has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_ACT_P+5,   .z=RV_TRUE,     },
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_ACT_P+6,   },  // rest first
    { .t=Opcode_T,      .x=VM_typeq,    .y=Actor_T,     .z=F_ACT_P+7,   },  // first has type Actor_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_ACT_P+2,   .z=RV_FALSE,    },

#define F_EQ_P (F_ACT_P+8)
#define _F_EQ_P TO_CAP(F_EQ_P)
    { .t=Actor_T,       .x=F_EQ_P+1,    .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=F_EQ_P+2,    },  // rest = cdr(args)
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_EQ_P+3,    },  // rest rest
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_EQ_P+4,    },  // rest has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_EQ_P+5,    .z=RV_TRUE,     },
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_EQ_P+6,    },  // rest first
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_EQ_P+7,    },  // car(args)
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_EQ,      .z=F_EQ_P+8,    },  // first == car(args)
    { .t=Opcode_T,      .x=VM_if,       .y=F_EQ_P+2,    .z=RV_FALSE,    },

#define F_NUM_EQ (F_EQ_P+9)
#define _F_NUM_EQ TO_CAP(F_NUM_EQ)
    { .t=Actor_T,       .x=F_NUM_EQ+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_EQ+2,  },  // args
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_EQ+3,  },  // args args
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_EQ+4,  },  // args has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_EQ+5,  .z=RV_TRUE,     },

    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_EQ+6,  },  // rest first
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_EQ+7,  },  // rest first first
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_EQ+8,  },  // first has type Fixnum_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_EQ+9,  .z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_EQ+10, },  // rest
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_EQ+11, },  // rest has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_EQ+12, .z=RV_TRUE,     },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_EQ+13, },  // first rest
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_EQ+14, },  // first rest second
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_EQ+15, },  // second second
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_EQ+16, },  // second has type Fixnum_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_EQ+17, .z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_EQ+18, },  // rest second first
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_EQ+19, },  // rest second first second
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_EQ,      .z=F_NUM_EQ+20, },  // first == second
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_EQ+9,  .z=RV_FALSE,    },

#define F_NUM_LT (F_NUM_EQ+21)
#define _F_NUM_LT TO_CAP(F_NUM_LT)
    { .t=Actor_T,       .x=F_NUM_LT+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_LT+2,  },  // args
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_LT+3,  },  // args args
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_LT+4,  },  // args has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_LT+5,  .z=RV_TRUE,     },

    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_LT+6,  },  // rest first
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_LT+7,  },  // rest first first
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_LT+8,  },  // first has type Fixnum_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_LT+9,  .z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_LT+10, },  // rest
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_LT+11, },  // rest has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_LT+12, .z=RV_TRUE,     },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_LT+13, },  // first rest
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_LT+14, },  // first rest second
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_LT+15, },  // second second
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_LT+16, },  // second has type Fixnum_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_LT+17, .z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_LT+18, },  // rest second first
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_LT+19, },  // rest second first second
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_LT,      .z=F_NUM_LT+20, },  // first < second
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_LT+9,  .z=RV_FALSE,    },

#define F_NUM_LE (F_NUM_LT+21)
#define _F_NUM_LE TO_CAP(F_NUM_LE)
    { .t=Actor_T,       .x=F_NUM_LE+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_LE+2,  },  // args
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_LE+3,  },  // args args
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_LE+4,  },  // args has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_LE+5,  .z=RV_TRUE,     },

    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_LE+6,  },  // rest first
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_LE+7,  },  // rest first first
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_LE+8,  },  // first has type Fixnum_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_LE+9,  .z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_LE+10, },  // rest
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_LE+11, },  // rest has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_LE+12, .z=RV_TRUE,     },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_LE+13, },  // first rest
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_LE+14, },  // first rest second
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_LE+15, },  // second second
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_LE+16, },  // second has type Fixnum_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_LE+17, .z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_LE+18, },  // rest second first
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_LE+19, },  // rest second first second
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_LE,      .z=F_NUM_LE+20, },  // first <= second
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_LE+9,  .z=RV_FALSE,    },

#define F_NUM_ADD (F_NUM_LE+21)
#define _F_NUM_ADD TO_CAP(F_NUM_ADD)
    { .t=Actor_T,       .x=F_NUM_ADD+1, .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_ADD+2, },  // args
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_ADD+3, },  // args args
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_ADD+4, },  // args has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_ADD+5, .z=RV_ZERO,     },

    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_ADD+6, },  // rest first
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_ADD+7, },  // rest first first
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_ADD+8, },  // first has type Fixnum_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_ADD+9, .z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_ADD+10,},  // rest
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_ADD+11,},  // rest has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_ADD+12,.z=CUST_SEND,   },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_ADD+13,},  // first rest
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_ADD+14,},  // first rest second
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_ADD+15,},  // second second
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_ADD+16,},  // second has type Fixnum_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_ADD+17,.z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_ADD+18,},  // rest second first
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_ADD+19,},  // rest first second
    { .t=Opcode_T,      .x=VM_alu,      .y=ALU_ADD,     .z=F_NUM_ADD+9, },  // first + second

#define F_NUM_SUB (F_NUM_ADD+20)
#define _F_NUM_SUB TO_CAP(F_NUM_SUB)
    { .t=Actor_T,       .x=F_NUM_SUB+1, .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_SUB+2, },  // args
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_SUB+3, },  // args args
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_SUB+4, },  // args has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_SUB+5, .z=RV_ZERO,     },

    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_SUB+6, },  // rest first
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_SUB+7, },  // rest first first
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_SUB+8, },  // first has type Fixnum_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_SUB+9, .z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_SUB+10,},  // rest
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_SUB+11,},  // rest has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_SUB+15,.z=F_NUM_SUB+12,},

    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX(0),   .z=F_NUM_SUB+13,},  // +0
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_SUB+14,},  // +0 first
    { .t=Opcode_T,      .x=VM_alu,      .y=ALU_SUB,     .z=CUST_SEND,   },  // +0 - first

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_SUB+16,},  // first rest
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_SUB+17,},  // first rest second
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_SUB+18,},  // second second
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_SUB+19,},  // second has type Fixnum_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_SUB+20,.z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_SUB+21,},  // rest second first
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_SUB+22,},  // rest first second
    { .t=Opcode_T,      .x=VM_alu,      .y=ALU_SUB,     .z=F_NUM_SUB+23,},  // first - second

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_SUB+24,},  // rest
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_SUB+25,},  // rest has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_SUB+15,.z=CUST_SEND,   },

#define F_NUM_MUL (F_NUM_SUB+26)
#define _F_NUM_MUL TO_CAP(F_NUM_MUL)
    { .t=Actor_T,       .x=F_NUM_MUL+1, .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_MUL+2, },  // args
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_MUL+3, },  // args args
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_MUL+4, },  // args has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_MUL+5, .z=RV_ONE,      },

    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_MUL+6, },  // rest first
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_MUL+7, },  // rest first first
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_MUL+8, },  // first has type Fixnum_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_MUL+9, .z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_MUL+10,},  // rest
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_MUL+11,},  // rest has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_MUL+12,.z=CUST_SEND,   },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_MUL+13,},  // first rest
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_MUL+14,},  // first rest second
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_MUL+15,},  // second second
    { .t=Opcode_T,      .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_MUL+16,},  // second has type Fixnum_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_NUM_MUL+17,.z=RV_UNDEF,    },

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_MUL+18,},  // rest second first
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_MUL+19,},  // rest first second
    { .t=Opcode_T,      .x=VM_alu,      .y=ALU_MUL,     .z=F_NUM_MUL+9, },  // first * second

#define F_LST_NUM (F_NUM_MUL+20)
#define _F_LST_NUM TO_CAP(F_LST_NUM)
    { .t=Actor_T,       .x=F_LST_NUM+1, .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_LST_NUM+2, },  // chars = arg1
    { .t=Opcode_T,      .x=VM_cvt,      .y=CVT_LST_NUM, .z=CUST_SEND,   },  // lst_num(chars)

#define F_LST_SYM (F_LST_NUM+3)
#define _F_LST_SYM TO_CAP(F_LST_SYM)
    { .t=Actor_T,       .x=F_LST_SYM+1, .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_LST_SYM+2, },  // chars = arg1
    { .t=Opcode_T,      .x=VM_cvt,      .y=CVT_LST_SYM, .z=CUST_SEND,   },  // lst_sym(chars)

#define F_PRINT (F_LST_SYM+3)
#define _F_PRINT TO_CAP(F_PRINT)
    { .t=Actor_T,       .x=F_PRINT+1,   .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_PRINT+2,   },
    { .t=Opcode_T,      .x=VM_debug,    .y=TO_FIX(555), .z=F_PRINT+3,   },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=CUST_SEND,   },

#if SCM_ASM_TOOLS
//
// Assembly-language Tools
//

#define F_CELL (F_PRINT+4)
#define _F_CELL TO_CAP(F_CELL)
    { .t=Actor_T,       .x=F_CELL+1,    .y=NIL,         .z=UNDEF        },  // (cell <T> <X> <Y> <Z>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_CELL+2,    },  // T = arg1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=F_CELL+3,    },  // X = arg2
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(4),   .z=F_CELL+4,    },  // Y = arg3
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(5),   .z=F_CELL+5,    },  // Z = arg4
    { .t=Opcode_T,      .x=VM_cell,     .y=TO_FIX(4),   .z=CUST_SEND,   },  // cell(T, X, Y, Z)

#define F_GET_T (F_CELL+6)
#define _F_GET_T TO_CAP(F_GET_T)
    { .t=Actor_T,       .x=F_GET_T+1,   .y=NIL,         .z=UNDEF        },  // (get-t <cell>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_GET_T+2,   },  // cell = arg1
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_T,       .z=CUST_SEND,   },  // get-t(cell)

#define F_GET_X (F_GET_T+3)
#define _F_GET_X TO_CAP(F_GET_X)
    { .t=Actor_T,       .x=F_GET_X+1,   .y=NIL,         .z=UNDEF        },  // (get-x <cell>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_GET_X+2,   },  // cell = arg1
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_X,       .z=CUST_SEND,   },  // get-x(cell)

#define F_GET_Y (F_GET_X+3)
#define _F_GET_Y TO_CAP(F_GET_Y)
    { .t=Actor_T,       .x=F_GET_Y+1,   .y=NIL,         .z=UNDEF        },  // (get-y <cell>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_GET_Y+2,   },  // cell = arg1
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_Y,       .z=CUST_SEND,   },  // get-y(cell)

#define F_GET_Z (F_GET_Y+3)
#define _F_GET_Z TO_CAP(F_GET_Z)
    { .t=Actor_T,       .x=F_GET_Z+1,   .y=NIL,         .z=UNDEF        },  // (get-z <cell>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_GET_Z+2,   },  // cell = arg1
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_Z,       .z=CUST_SEND,   },  // get-z(cell)

#define F_SET_T (F_GET_Z+3)
#define _F_SET_T TO_CAP(F_SET_T)
    { .t=Actor_T,       .x=F_SET_T+1,   .y=NIL,         .z=UNDEF        },  // (set-t <cell> <T>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_SET_T+2,   },  // cell = arg1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=F_SET_T+3,   },  // T = arg2
    { .t=Opcode_T,      .x=VM_set,      .y=FLD_T,       .z=CUST_SEND,   },  // set-t(cell, T)

#define F_SET_X (F_SET_T+4)
#define _F_SET_X TO_CAP(F_SET_X)
    { .t=Actor_T,       .x=F_SET_X+1,   .y=NIL,         .z=UNDEF        },  // (set-x <cell> <X>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_SET_X+2,   },  // cell = arg1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=F_SET_X+3,   },  // X = arg2
    { .t=Opcode_T,      .x=VM_set,      .y=FLD_X,       .z=CUST_SEND,   },  // set-x(cell, X)

#define F_SET_Y (F_SET_X+4)
#define _F_SET_Y TO_CAP(F_SET_Y)
    { .t=Actor_T,       .x=F_SET_Y+1,   .y=NIL,         .z=UNDEF        },  // (set-y <cell> <Y>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_SET_Y+2,   },  // cell = arg1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=F_SET_Y+3,   },  // Y = arg2
    { .t=Opcode_T,      .x=VM_set,      .y=FLD_Y,       .z=CUST_SEND,   },  // set-y(cell, Y)

#define F_SET_Z (F_SET_Y+4)
#define _F_SET_Z TO_CAP(F_SET_Z)
    { .t=Actor_T,       .x=F_SET_Z+1,   .y=NIL,         .z=UNDEF        },  // (set-z <cell> <Z>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_SET_Z+2,   },  // cell = arg1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=F_SET_Z+3,   },  // Z = arg2
    { .t=Opcode_T,      .x=VM_set,      .y=FLD_Z,       .z=CUST_SEND,   },  // set-z(cell, Z)

#define ASM_END (F_SET_Z+4)
#else // !SCM_ASM_TOOLS
#define ASM_END (F_PRINT+4)
#endif // SCM_ASM_TOOLS

#if META_ACTORS
//
// Meta-Actor Procedures for LISP/Scheme
//

#define S_SEND (ASM_END+0)
    { .t=Symbol_T,      .x=0,           .y=S_SEND+1,    .z=UNDEF,       },
    { .t=Pair_T,        .x=TO_FIX('S'), .y=S_SEND+2,    .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('E'), .y=S_SEND+3,    .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('N'), .y=S_SEND+4,    .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('D'), .y=NIL,         .z=UNDEF        },

#define S_BECOME (S_SEND+5)
    { .t=Symbol_T,      .x=0,           .y=S_BECOME+1,  .z=UNDEF,       },
    { .t=Pair_T,        .x=TO_FIX('B'), .y=S_BECOME+2,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('E'), .y=S_BECOME+3,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('C'), .y=S_BECOME+4,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('O'), .y=S_BECOME+5,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('M'), .y=S_BECOME+6,  .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('E'), .y=NIL,         .z=UNDEF        },

#define S_SELF (S_BECOME+7)
    { .t=Symbol_T,      .x=0,           .y=S_SELF+1,    .z=UNDEF,       },
    { .t=Pair_T,        .x=TO_FIX('S'), .y=S_SELF+2,    .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('E'), .y=S_SELF+3,    .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('L'), .y=S_SELF+4,    .z=UNDEF        },
    { .t=Pair_T,        .x=TO_FIX('F'), .y=NIL,         .z=UNDEF        },

/*
(define meta-actor-beh
  (lambda (beh)
    (BEH msg
      (define txn (cell Fexpr_T SELF () beh))
      (SEND beh (cons txn msg))
      (BECOME (meta-busy-beh txn ())) )))
*/
#define M_ACTOR_B (S_SELF+5)
#define M_BUSY_B (M_ACTOR_B+13)
//  { .t=Opcode_T,      .x=VM_push,     .y=_beh_,       .z=M_ACTOR_B+0, },
    { .t=Opcode_T,      .x=VM_push,     .y=Fexpr_T,     .z=M_ACTOR_B+1, },  // T = Fexpr_T
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=M_ACTOR_B+2, },  // X = SELF
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=M_ACTOR_B+3, },  // Y = ()
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(4),   .z=M_ACTOR_B+4, },  // Z = beh
    { .t=Opcode_T,      .x=VM_cell,     .y=TO_FIX(4),   .z=M_ACTOR_B+5, },  // txn = cell(T, X, Y, Z)

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=M_ACTOR_B+6, },  // txn txn
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=M_ACTOR_B+7, },  // pending = ()
    { .t=Opcode_T,      .x=VM_push,     .y=M_BUSY_B,    .z=M_ACTOR_B+8, },  // M_BUSY_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=M_ACTOR_B+9, },  // BECOME (M_BUSY_B txn pending)

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=M_ACTOR_B+10,},  // msg
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=M_ACTOR_B+11,},  // txn
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_ACTOR_B+12,},  // (txn . msg)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // beh

/*
(define meta-busy-beh
  (lambda (txn pending)
    (BEH msg
      (if (eq? msg txn)                 ; end txn
        (seq
          (define beh (get-z msg))
          (define outbox (get-y msg))
          (map (lambda (x) (SEND (car x) (cdr x))) outbox)  ; (send-msgs outbox)
          (if (pair? pending)
            (seq
              (define txn (cell Fexpr_T SELF () beh))
              (SEND beh (cons txn (car pending)))
              (BECOME (meta-busy-beh txn (cdr pending))) )
            (BECOME (meta-actor-beh beh)) ))
        (BECOME (meta-busy-beh txn (cons msg pending))) ))))
*/
//  { .t=Opcode_T,      .x=VM_push,     .y=_txn_,       .z=M_BUSY_B-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_pending_,   .z=M_BUSY_B+0,  },
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=M_BUSY_B+1,  },  // txn
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=M_BUSY_B+2,  },  // msg
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_EQ,      .z=M_BUSY_B+3,  },  // (msg == txn)
    { .t=Opcode_T,      .x=VM_if,       .y=M_BUSY_B+8,  .z=M_BUSY_B+4,  },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=M_BUSY_B+5,  },  // msg
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_BUSY_B+6,  },  // (msg . pending)
    { .t=Opcode_T,      .x=VM_push,     .y=M_BUSY_B,    .z=M_BUSY_B+7,  },  // M_BUSY_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=COMMIT,      },  // BECOME (M_BUSY_B txn (msg . pending))

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=M_BUSY_B+9,  },  // msg
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_Y,       .z=M_BUSY_B+10, },  // outbox

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=M_BUSY_B+11, },  // outbox outbox
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=M_BUSY_B+12, },  // outbox has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_BUSY_B+13, .z=M_BUSY_B+16, },

    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=M_BUSY_B+14, },  // rest first
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=M_BUSY_B+15, },  // rest msg actor
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(0),   .z=M_BUSY_B+10, },  // (actor . msg)

    { .t=Opcode_T,      .x=VM_drop,     .y=TO_FIX(1),   .z=M_BUSY_B+17, },  // txn pending
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=M_BUSY_B+18, },  // msg
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_Z,       .z=M_BUSY_B+19, },  // beh'
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=M_BUSY_B+20, },  // txn pending beh' pending
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=M_BUSY_B+21, },  // pending has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=M_BUSY_B+24, .z=M_BUSY_B+22, },

    { .t=Opcode_T,      .x=VM_push,     .y=M_ACTOR_B,   .z=M_BUSY_B+23, },  // M_ACTOR_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(1),   .z=COMMIT,      },  // BECOME (M_ACTOR_B beh')

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=M_BUSY_B+25, },  // beh' pending
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=M_BUSY_B+26, },  // beh' tail head

    { .t=Opcode_T,      .x=VM_push,     .y=Fexpr_T,     .z=M_BUSY_B+27, },  // T = Fexpr_T
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=M_BUSY_B+28, },  // X = SELF
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=M_BUSY_B+29, },  // Y = ()
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(6),   .z=M_BUSY_B+30, },  // Z = beh'
    { .t=Opcode_T,      .x=VM_cell,     .y=TO_FIX(4),   .z=M_BUSY_B+31, },  // txn' = cell(T, X, Y, Z)

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=M_BUSY_B+32, },  // beh' tail txn' head
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=M_BUSY_B+33, },  // beh' tail txn' head txn'
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_BUSY_B+34, },  // beh' tail txn' (txn' . head)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(4),   .z=M_BUSY_B+35, },  // tail txn' (txn' . head) beh'
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(0),   .z=M_BUSY_B+36, },  // (beh' . (txn' . head))

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=M_BUSY_B+37, },  // txn' tail
    { .t=Opcode_T,      .x=VM_push,     .y=M_BUSY_B,    .z=M_BUSY_B+38, },  // M_BUSY_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=COMMIT,      },  // BECOME (M_BUSY_B txn' tail)

/*
(define meta-SEND                       ; (SEND actor message)
  (lambda (txn)
    (lambda (actor msg)
      (set-y txn (cons (cons actor msg) (get-y txn))) )))
*/
#define M_SEND (M_BUSY_B+39)
//  { .t=Opcode_T,      .x=VM_push,     .y=_txn_,       .z=M_SEND+0,    },
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=M_SEND+1,    },  // txn txn
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=M_SEND+2,    },  // txn txn txn
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_Y,       .z=M_SEND+3,    },  // outbox = get_y(txn)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=M_SEND+4,    },  // msg = arg2
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_SEND+5,    },  // actor = arg1
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_SEND+6,    },  // (actor . msg)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=M_SEND+7,    },  // outbox' = ((actor . msg) . outbox)
    { .t=Opcode_T,      .x=VM_set,      .y=FLD_Y,       .z=RV_UNIT,     },  // set_y(txn, outbox')

/*
(define meta-BECOME                     ; (BECOME behavior)
  (lambda (txn)
    (lambda (beh)
      (set-z txn beh) )))
*/
#define M_BECOME (M_SEND+8)
//  { .t=Opcode_T,      .x=VM_push,     .y=_txn_,       .z=M_BECOME+0,  },
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=M_BECOME+1,  },  // txn txn
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=M_BECOME+2,  },  // beh = arg1
    { .t=Opcode_T,      .x=VM_set,      .y=FLD_Z,       .z=RV_UNIT,     },  // set_z(txn, beh)

/*
(define actor-env                       ; extend environment with actor primitives
  (lambda (txn env)
    (zip '(SEND BECOME SELF)
      ((CREATE (meta-SEND txn)) (CREATE (meta-BECOME txn)) (get-x txn))
      env)))
(define a-meta-beh                      ; actor meta-behavior
  (lambda (frml body env)
    (BEH (txn . msg)
      (define aenv (scope (actor-env txn env)))
      (evbody #unit body (zip frml msg aenv))
      (SEND (get-x txn) txn) )))
*/
#define A_META_B (M_BECOME+3)
#define A_EXEC_B (A_META_B+27)
#define A_COMMIT_B (A_EXEC_B+9)
//  { .t=Opcode_T,      .x=VM_push,     .y=_frml_,      .z=A_META_B-2,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_body_,      .z=A_META_B-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_env_,       .z=A_META_B+0,  },
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=A_META_B+1,  },  // env

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=A_META_B+2,  },  // txn
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_X,       .z=A_META_B+3,  },  // get_x(txn)
    { .t=Opcode_T,      .x=VM_push,     .y=S_SELF,      .z=A_META_B+4,  },  // 'SELF
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=A_META_B+5,  },  // ('SELF . get_x(txn))

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=A_META_B+6,  },  // txn
    { .t=Opcode_T,      .x=VM_push,     .y=M_BECOME,    .z=A_META_B+7,  },  // M_BECOME
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=A_META_B+8,  },  // m-become
    { .t=Opcode_T,      .x=VM_push,     .y=S_BECOME,    .z=A_META_B+9,  },  // 'BECOME
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=A_META_B+10, },  // ('BECOME . m-become)

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=A_META_B+11, },  // txn
    { .t=Opcode_T,      .x=VM_push,     .y=M_SEND,      .z=A_META_B+12, },  // M_SEND
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=A_META_B+13, },  // m-send
    { .t=Opcode_T,      .x=VM_push,     .y=S_SEND,      .z=A_META_B+14, },  // 'SEND
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=A_META_B+15, },  // ('SEND . m-send)

    { .t=Opcode_T,      .x=VM_push,     .y=UNDEF,       .z=A_META_B+16, },  // #?
    { .t=Opcode_T,      .x=VM_push,     .y=S_IGNORE,    .z=A_META_B+17, },  // '_
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=A_META_B+18, },  // ('_ . #?)

    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(4),   .z=A_META_B+19, },  // aenv
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=A_META_B+20, },  // msg
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(5),   .z=A_META_B+21, },  // frml

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=A_META_B+22, },  // txn
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(6),   .z=A_META_B+23, },  // body
    { .t=Opcode_T,      .x=VM_push,     .y=A_EXEC_B,    .z=A_META_B+24, },  // A_EXEC_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=A_META_B+25, },  // k_exec = (A_EXEC_B txn body)

    { .t=Opcode_T,      .x=VM_push,     .y=_M_ZIP,      .z=A_META_B+26, },  // M_ZIP
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(4),   .z=COMMIT,      },  // (M_ZIP k_exec frml msg aenv)

//      (evbody #unit body (zip frml msg aenv))

//  { .t=Opcode_T,      .x=VM_push,     .y=_txn_,       .z=A_EXEC_B-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_body_,      .z=A_EXEC_B+0,  },
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=A_EXEC_B+1,  },  // body txn
    { .t=Opcode_T,      .x=VM_push,     .y=A_COMMIT_B,  .z=A_EXEC_B+2,  },  // A_COMMIT_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(1),   .z=A_EXEC_B+3,  },  // BECOME (A_COMMIT_B txn)

    { .t=Opcode_T,      .x=VM_push,     .y=UNIT,        .z=A_EXEC_B+4,  },  // #unit
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=A_EXEC_B+5,  },  // SELF
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=A_EXEC_B+6,  },  // #unit SELF body

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=A_EXEC_B+7,  },  // env
    { .t=Opcode_T,      .x=VM_push,     .y=K_SEQ_B,     .z=A_EXEC_B+8,  },  // K_SEQ_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(3),   .z=SEND_0,      },  // k-seq = (K_SEQ_B SELF body env)

//      (SEND (get-x txn) txn) )))

//  { .t=Opcode_T,      .x=VM_push,     .y=_txn_,       .z=A_COMMIT_B+0,},
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=A_COMMIT_B+1,},  // txn txn
    { .t=Opcode_T,      .x=VM_get,      .y=FLD_X,       .z=RELEASE_0,   },  // txn get-x(txn)

/*
(define meta-BEH                        ; (BEH <frml> . <body>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (CREATE (a-meta-beh (car opnds) (cdr opnds) env))
      ))))
*/
#define FX_M_BEH (A_COMMIT_B+2)
#define OP_M_BEH (FX_M_BEH+1)
#define _OP_M_BEH TO_CAP(OP_M_BEH)
    { .t=Fexpr_T,       .x=_OP_M_BEH,   .y=UNDEF,       .z=UNDEF,       },  // (BEH <frml> . <body>)

    { .t=Actor_T,       .x=OP_M_BEH+1,  .y=NIL,         .z=UNDEF        },  // (cust opnds env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_M_BEH+2,  },  // opnds
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=OP_M_BEH+3,  },  // frml = car(opnds)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_M_BEH+4,  },  // opnds
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(-1),  .z=OP_M_BEH+5,  },  // body = cdr(opnds)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=OP_M_BEH+6,  },  // env
    { .t=Opcode_T,      .x=VM_push,     .y=A_META_B,    .z=OP_M_BEH+7,  },  // A_META_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(3),   .z=CUST_SEND,   },  // closure = (A_META_B frml body env)

/*
(define meta-CREATE                     ; (CREATE behavior)
  (CREATE
    (BEH (cust . args)
      (SEND cust (CREATE (meta-actor-beh (car args)))) )))
*/
#define F_CREATE (OP_M_BEH+8)
#define _F_CREATE TO_CAP(F_CREATE)
    { .t=Actor_T,       .x=F_CREATE+1,  .y=NIL,         .z=UNDEF        },  // (CREATE <behavior>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_CREATE+2,  },  // beh = arg1
    { .t=Opcode_T,      .x=VM_push,     .y=M_ACTOR_B,   .z=F_CREATE+3,  },  // M_ACTOR_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // actor = (M_ACTOR_B beh)

#define F_SEND (F_CREATE+4)
#define _F_SEND TO_CAP(F_SEND)
    { .t=Actor_T,       .x=F_SEND+1,    .y=NIL,         .z=UNDEF        },  // (SEND <actor> <message>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=F_SEND+2,    },  // msg = arg2
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_SEND+3,    },  // actor = arg1
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(0),   .z=RV_UNIT,     },  // (actor . msg)

#define F_CALL (F_SEND+4)
#define _F_CALL TO_CAP(F_CALL)
    { .t=Actor_T,       .x=F_CALL+1,    .y=NIL,         .z=UNDEF        },  // (CALL <actor> <args>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=F_CALL+2,    },  // args = arg2
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=F_CALL+3,    },  // cust = arg0
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=F_CALL+4,    },  // (cust . args)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=SEND_0,      },  // actor = arg1

#define ACTOR_END (F_CALL+5)
#else // !META_ACTORS
#define ACTOR_END (ASM_END+0)
#endif // META_ACTORS

//
// Parsing Expression Grammar (PEG) behaviors
//

#define G_EMPTY (ACTOR_END+0)
#define _G_EMPTY TO_CAP(G_EMPTY)
    { .t=Actor_T,       .x=G_EMPTY+1,   .y=NIL,         .z=UNDEF        },
#define G_EMPTY_B (G_EMPTY+1)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=G_EMPTY+2,   },  // in
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=G_EMPTY+3,   },  // ()
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_EMPTY+4,   },  // (() . in)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=G_EMPTY+5,   },  // custs = (ok . fail)
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=SEND_0,      },  // ok = car(custs)

#define G_FAIL (G_EMPTY+6)
#define _G_FAIL TO_CAP(G_FAIL)
    { .t=Actor_T,       .x=G_FAIL+1,    .y=NIL,         .z=UNDEF        },
#define G_FAIL_B (G_FAIL+1)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=G_FAIL+2,    },  // in
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=G_FAIL+3,    },  // custs = (ok . fail)
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(-1),  .z=SEND_0,      },  // fail = cdr(custs)

#define G_NEXT_K (G_FAIL+4)
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=G_NEXT_K-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_value_,     .z=G_NEXT_K+0,  },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=G_NEXT_K+1,  },  // in
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=G_NEXT_K+2,  },  // value
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_NEXT_K+3,  },  // (value . in)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // cust

#define G_ANY (G_NEXT_K+4)
#define _G_ANY TO_CAP(G_ANY)
    { .t=Actor_T,       .x=G_ANY+1,     .y=NIL,         .z=UNDEF        },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=G_ANY+2,     },  // custs = (ok . fail)
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_ANY+3,     },  // fail ok
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=G_ANY+4,     },  // in
    { .t=Opcode_T,      .x=VM_eq,       .y=NIL,         .z=G_ANY+5,     },  // in == ()
    { .t=Opcode_T,      .x=VM_if,       .y=G_ANY+13,    .z=G_ANY+6,     },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=G_ANY+7,     },  // in
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_ANY+8,     },  // next token
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=G_ANY+9,     },  // ok
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=G_ANY+10,    },  // token
    { .t=Opcode_T,      .x=VM_push,     .y=G_NEXT_K,    .z=G_ANY+11,    },  // G_NEXT_K
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=G_ANY+12,    },  // k_next
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // next

    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=G_ANY+14,    },  // ()
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // fail

#define G_EQ_B (G_ANY+15)
//  { .t=Opcode_T,      .x=VM_push,     .y=_value_,     .z=G_EQ_B+0,    },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=G_EQ_B+1,    },  // custs = (ok . fail)
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_EQ_B+2,    },  // fail ok
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=G_EQ_B+3,    },  // in
    { .t=Opcode_T,      .x=VM_eq,       .y=NIL,         .z=G_EQ_B+4,    },  // in == ()
    { .t=Opcode_T,      .x=VM_if,       .y=G_EQ_B+17,   .z=G_EQ_B+5,    },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=G_EQ_B+6,    },  // in
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_EQ_B+7,    },  // next token
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=G_EQ_B+8,    },  // token token
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(6),   .z=G_EQ_B+9,    },  // value
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_NE,      .z=G_EQ_B+10,   },  // token != value
    { .t=Opcode_T,      .x=VM_if,       .y=G_EQ_B+16,   .z=G_EQ_B+11,   },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=G_EQ_B+12,   },  // ok
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=G_EQ_B+13,   },  // token
    { .t=Opcode_T,      .x=VM_push,     .y=G_NEXT_K,    .z=G_EQ_B+14,   },  // G_NEXT_K
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=G_EQ_B+15,   },  // k_next
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // next

    { .t=Opcode_T,      .x=VM_drop,     .y=TO_FIX(2),   .z=G_EQ_B+17,   },  // fail ok

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=G_EQ_B+18,   },  // in
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // fail

#define G_FAIL_K (G_EQ_B+19)
//  { .t=Opcode_T,      .x=VM_push,     .y=_msg_,       .z=G_FAIL_K-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=G_FAIL_K+0,  },
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(0),   .z=RELEASE,     },  // (cust . msg)

#define G_OR_B (G_FAIL_K+1)
//  { .t=Opcode_T,      .x=VM_push,     .y=_first_,     .z=G_OR_B-1,    },
//  { .t=Opcode_T,      .x=VM_push,     .y=_rest_,      .z=G_OR_B+0,    },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=G_OR_B+1,    },  // resume = (value . in)

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=G_OR_B+2,    },  // msg = (custs value . in)
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=G_OR_B+3,    },  // cust = rest
    { .t=Opcode_T,      .x=VM_push,     .y=G_FAIL_K,    .z=G_OR_B+4,    },  // G_FAIL_K
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=G_OR_B+5,    },  // or_fail

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=G_OR_B+6,    },  // custs
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=G_OR_B+7,    },  // ok = car(custs)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_OR_B+8,    },  // (ok . or_fail)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_OR_B+9,    },  // ((ok . or_fail) . resume)

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // first

#define G_AND_PR (G_OR_B+10)
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=G_AND_PR-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_head_,      .z=G_AND_PR+0,  },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=G_AND_PR+1,  },  // (value . in)
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_AND_PR+2,  },  // in tail
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=G_AND_PR+3,  },  // head
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_AND_PR+4,  },  // (head . tail)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_AND_PR+5,  },  // ((head . tail) . in)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // cust
#define G_AND_OK (G_AND_PR+6)
//  { .t=Opcode_T,      .x=VM_push,     .y=_rest_,      .z=G_AND_OK-2,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_and_fail_,  .z=G_AND_OK-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_ok_,        .z=G_AND_OK+0,  },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=G_AND_OK+1,  },  // head = value
    { .t=Opcode_T,      .x=VM_push,     .y=G_AND_PR,    .z=G_AND_OK+2,  },  // G_AND_PR
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=G_AND_OK+3,  },  // BECOME (G_AND_PR ok value)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=G_AND_OK+4,  },  // resume = (value . in)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=G_AND_OK+5,  },  // and_fail
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=G_AND_OK+6,  },  // and_pair = SELF
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_AND_OK+7,  },  // (and_pair . and_fail)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_AND_OK+8,  },  // ((and_pair . and_fail) . resume)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // rest
#define G_AND_B (G_AND_OK+9)
//  { .t=Opcode_T,      .x=VM_push,     .y=_first_,     .z=G_AND_B-1,   },
//  { .t=Opcode_T,      .x=VM_push,     .y=_rest_,      .z=G_AND_B+0,   },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=G_AND_B+1,   },  // resume = (value . in)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=G_AND_B+2,   },  // custs
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(-1),  .z=G_AND_B+3,   },  // fail = cdr(custs)

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=G_AND_B+4,   },  // rest

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=G_AND_B+5,   },  // msg = in
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=G_AND_B+6,   },  // cust = fail
    { .t=Opcode_T,      .x=VM_push,     .y=G_FAIL_K,    .z=G_AND_B+7,   },  // G_FAIL_K
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=G_AND_B+8,   },  // and_fail = (G_FAIL_K in fail)

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=G_AND_B+9,   },  // custs
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=G_AND_B+10,  },  // ok = car(custs)
    { .t=Opcode_T,      .x=VM_push,     .y=G_AND_OK,    .z=G_AND_B+11,  },  // G_AND_OK
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(3),   .z=G_AND_B+12,  },  // and_ok = (G_AND_OK rest and_fail ok)

    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_AND_B+13,  },  // (and_ok . fail)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_AND_B+14,  },  // ((and_ok . fail) . resume)
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // first

#define G_NOT_B (G_AND_B+15)
//  { .t=Opcode_T,      .x=VM_push,     .y=_ptrn_,      .z=G_NOT_B+0,   },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=G_NOT_B+1,   },  // custs
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_NOT_B+2,   },  // fail ok

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=G_NOT_B+3,   },  // in
    { .t=Opcode_T,      .x=VM_push,     .y=UNIT,        .z=G_NOT_B+4,   },  // value = UNIT
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_NOT_B+5,   },  // ctx = (#unit . in)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=G_NOT_B+6,   },  // ok
    { .t=Opcode_T,      .x=VM_push,     .y=RELEASE_0,   .z=G_NOT_B+7,   },  // RELEASE_0
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=G_NOT_B+8,   },  // fail' = (RELEASE_0 ctx ok)

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=G_NOT_B+9,   },  // in
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=G_NOT_B+10,  },  // fail
    { .t=Opcode_T,      .x=VM_push,     .y=RELEASE_0,   .z=G_NOT_B+11,  },  // RELEASE_0
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=G_NOT_B+12,  },  // ok' = (RELEASE_0 in fail)

    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_NOT_B+13,  },  // custs' = (ok' . fail')
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=G_NOT_B+14,  },  // ctx = (value . in)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=G_NOT_B+15,  },  // ctx custs'
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_NOT_B+16,  },  // msg = (custs' value . in)
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=SEND_0,      },  // ptrn

/*
Optional(pattern) = Or(And(pattern, Empty), Empty)
Plus(pattern) = And(pattern, Star(pattern))
Star(pattern) = Or(Plus(pattern), Empty)
*/
#define G_OPT_B (G_NOT_B+17)
#define G_PLUS_B (G_OPT_B+6)
#define G_STAR_B (G_PLUS_B+5)
//  { .t=Opcode_T,      .x=VM_push,     .y=_ptrn_,      .z=G_OPT_B+0,   },
    { .t=Opcode_T,      .x=VM_push,     .y=_G_EMPTY,    .z=G_OPT_B+1,   },  // G_EMPTY
    { .t=Opcode_T,      .x=VM_push,     .y=G_AND_B,     .z=G_OPT_B+2,   },  // G_AND_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=G_OPT_B+3,   },  // ptrn' = (And ptrn Empty)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_EMPTY,    .z=G_OPT_B+4,   },  // G_EMPTY
    { .t=Opcode_T,      .x=VM_push,     .y=G_OR_B,      .z=G_OPT_B+5,   },  // G_OR_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=RESEND,      },  // BECOME (Or ptrn' Empty)

//  { .t=Opcode_T,      .x=VM_push,     .y=_ptrn_,      .z=G_PLUS_B+0,  },
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=G_PLUS_B+1,  },  // ptrn
    { .t=Opcode_T,      .x=VM_push,     .y=G_STAR_B,    .z=G_PLUS_B+2,  },  // G_STAR_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=G_PLUS_B+3,  },  // star = (Star ptrn)
    { .t=Opcode_T,      .x=VM_push,     .y=G_AND_B,     .z=G_PLUS_B+4,  },  // G_AND_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=RESEND,      },  // BECOME (And ptrn star)

//  { .t=Opcode_T,      .x=VM_push,     .y=_ptrn_,      .z=G_STAR_B+0,  },
    { .t=Opcode_T,      .x=VM_push,     .y=G_PLUS_B,    .z=G_STAR_B+1,  },  // G_PLUS_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=G_STAR_B+2,  },  // plus = (Plus ptrn)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_EMPTY,    .z=G_STAR_B+3,  },  // G_EMPTY
    { .t=Opcode_T,      .x=VM_push,     .y=G_OR_B,      .z=G_STAR_B+4,  },  // G_OR_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=RESEND,      },  // BECOME (Or plus Empty)

#define G_ALT_B (G_STAR_B+5)
//  { .t=Opcode_T,      .x=VM_push,     .y=_ptrns_,     .z=G_ALT_B+0,   },
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=G_ALT_B+1,   },  // ptrns
    { .t=Opcode_T,      .x=VM_eq,       .y=NIL,         .z=G_ALT_B+2,   },  // ptrns == ()
    { .t=Opcode_T,      .x=VM_if,       .y=G_ALT_B+13,  .z=G_ALT_B+3,   },

    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_ALT_B+4,   },  // tail head
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=G_ALT_B+5,   },  // tail
    { .t=Opcode_T,      .x=VM_eq,       .y=NIL,         .z=G_ALT_B+6,   },  // tail == ()
    { .t=Opcode_T,      .x=VM_if,       .y=G_ALT_B+10,  .z=G_ALT_B+7,   },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=G_ALT_B+8,   },  // tail
    { .t=Opcode_T,      .x=VM_push,     .y=G_ALT_B,     .z=G_ALT_B+9,   },  // G_ALT_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=G_ALT_B+11,  },  // rest = (Alt tail)

    { .t=Opcode_T,      .x=VM_push,     .y=_G_FAIL,     .z=G_ALT_B+11,  },  // rest = G_FAIL
    { .t=Opcode_T,      .x=VM_push,     .y=G_OR_B,      .z=G_ALT_B+12,  },  // G_OR_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=RESEND,      },  // BECOME

    { .t=Opcode_T,      .x=VM_push,     .y=G_FAIL_B,    .z=G_ALT_B+14,  },  // G_FAIL_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(0),   .z=RESEND,      },  // BECOME

#define G_SEQ_B (G_ALT_B+15)
//  { .t=Opcode_T,      .x=VM_push,     .y=_ptrns_,     .z=G_SEQ_B+0,   },
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=G_SEQ_B+1,   },  // ptrns
    { .t=Opcode_T,      .x=VM_eq,       .y=NIL,         .z=G_SEQ_B+2,   },  // ptrns == ()
    { .t=Opcode_T,      .x=VM_if,       .y=G_SEQ_B+13,  .z=G_SEQ_B+3,   },

    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_SEQ_B+4,   },  // tail head
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=G_SEQ_B+5,   },  // tail
    { .t=Opcode_T,      .x=VM_eq,       .y=NIL,         .z=G_SEQ_B+6,   },  // tail == ()
    { .t=Opcode_T,      .x=VM_if,       .y=G_SEQ_B+10,  .z=G_SEQ_B+7,   },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=G_SEQ_B+8,   },  // tail
    { .t=Opcode_T,      .x=VM_push,     .y=G_SEQ_B,     .z=G_SEQ_B+9,   },  // G_SEQ_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=G_SEQ_B+11,  },  // rest = (Seq tail)

    { .t=Opcode_T,      .x=VM_push,     .y=_G_EMPTY,    .z=G_SEQ_B+11,  },  // rest = G_EMPTY
    { .t=Opcode_T,      .x=VM_push,     .y=G_AND_B,     .z=G_SEQ_B+12,  },  // G_AND_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=RESEND,      },  // BECOME

    { .t=Opcode_T,      .x=VM_push,     .y=G_EMPTY_B,   .z=G_SEQ_B+14,  },  // G_EMPTY_B
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(0),   .z=RESEND,      },  // BECOME

#define G_CLS_B (G_SEQ_B+15)
//  { .t=Opcode_T,      .x=VM_push,     .y=_class_,     .z=G_CLS_B+0,   },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=G_CLS_B+1,   },  // custs = (ok . fail)
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_CLS_B+2,   },  // fail ok
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=G_CLS_B+3,   },  // in
    { .t=Opcode_T,      .x=VM_eq,       .y=NIL,         .z=G_CLS_B+4,   },  // in == ()
    { .t=Opcode_T,      .x=VM_if,       .y=G_CLS_B+18,  .z=G_CLS_B+5,   },

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=G_CLS_B+6,   },  // in
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_CLS_B+7,   },  // next token
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=G_CLS_B+8,   },  // token token
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(6),   .z=G_CLS_B+9,   },  // class
    { .t=Opcode_T,      .x=VM_cmp,      .y=CMP_CLS,     .z=G_CLS_B+10,  },  // token in class
    { .t=Opcode_T,      .x=VM_eq,       .y=FALSE,       .z=G_CLS_B+11,  },  // token ~in class
    { .t=Opcode_T,      .x=VM_if,       .y=G_CLS_B+17,  .z=G_CLS_B+12,  },

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=G_CLS_B+13,  },  // ok
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=G_CLS_B+14,  },  // token
    { .t=Opcode_T,      .x=VM_push,     .y=G_NEXT_K,    .z=G_CLS_B+15,  },  // G_NEXT_K
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=G_CLS_B+16,  },  // k_next
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // next

    { .t=Opcode_T,      .x=VM_drop,     .y=TO_FIX(2),   .z=G_CLS_B+18,  },  // fail ok

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-2),  .z=G_CLS_B+19,  },  // in
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // fail

#define G_PRED_K (G_CLS_B+20)
//  { .t=Opcode_T,      .x=VM_push,     .y=_more_,      .z=G_PRED_K-1,  },  // (value' . in')
//  { .t=Opcode_T,      .x=VM_push,     .y=_msg0_,      .z=G_PRED_K+0,  },  // ((ok . fail) value . in)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=G_PRED_K+1,  },  // cond
    { .t=Opcode_T,      .x=VM_if,       .y=G_PRED_K+5,  .z=G_PRED_K+2,  },

    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_PRED_K+3,  },  // resume custs
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_PRED_K+4,  },  // resume fail ok
    { .t=Opcode_T,      .x=VM_drop,     .y=TO_FIX(1),   .z=RELEASE_0,   },  // resume fail

    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=G_PRED_K+6,  },  // custs = (ok . fail)
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=RELEASE_0,   },  // ok

#define G_PRED_OK (G_PRED_K+7)
//  { .t=Opcode_T,      .x=VM_push,     .y=_msg0_,      .z=G_PRED_OK-1, },
//  { .t=Opcode_T,      .x=VM_push,     .y=_pred_,      .z=G_PRED_OK+0, },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=G_PRED_OK+1, },  // value

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=G_PRED_OK+2, },  // more
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(4),   .z=G_PRED_OK+3, },  // msg0
    { .t=Opcode_T,      .x=VM_push,     .y=G_PRED_K,    .z=G_PRED_OK+4, },  // G_PRED_K
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=G_PRED_OK+5, },  // BECOME (G_PRED_K more msg0)
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=G_PRED_OK+6, },  // k_pred = SELF

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=G_PRED_OK+7, },  // pred
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(2),   .z=COMMIT,      },  // (pred k_pred value)

#define G_PRED_B (G_PRED_OK+8)
//  { .t=Opcode_T,      .x=VM_push,     .y=_pred_,      .z=G_PRED_B-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_ptrn_,      .z=G_PRED_B+0,  },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=G_PRED_B+1,  },  // (custs . resume)
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_PRED_B+2,  },  // resume custs
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_PRED_B+3,  },  // fail ok
    { .t=Opcode_T,      .x=VM_drop,     .y=TO_FIX(1),   .z=G_PRED_B+4,  },  // fail

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=G_PRED_B+5,  },  // msg0 = (custs . resume)
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(5),   .z=G_PRED_B+6,  },  // pred
    { .t=Opcode_T,      .x=VM_push,     .y=G_PRED_OK,   .z=G_PRED_B+7,  },  // G_PRED_OK
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=G_PRED_B+8,  },  // ok'

    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_PRED_B+9,  },  // custs = (ok' . fail)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_PRED_B+10, },  // msg = (custs . resume)
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=SEND_0,      },  // ptrn

#define G_XLAT_K (G_PRED_B+11)
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=G_XLAT_K-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_in_,        .z=G_XLAT_K+0,  },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=G_XLAT_K+1,  },  // value
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_XLAT_K+2,  },  // (value . in)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // cust

#define G_XLAT_OK (G_XLAT_K+3)
//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=G_XLAT_OK-1, },
//  { .t=Opcode_T,      .x=VM_push,     .y=_func_,      .z=G_XLAT_OK+0, },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=G_XLAT_OK+1, },  // value

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=G_XLAT_OK+2, },  // cust
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=G_XLAT_OK+3, },  // in
    { .t=Opcode_T,      .x=VM_push,     .y=G_XLAT_K,    .z=G_XLAT_OK+4, },  // G_XLAT_K
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=G_XLAT_OK+5, },  // BECOME (G_XLAT_K cust in)
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=G_XLAT_OK+6, },  // k_xlat = SELF

    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=G_XLAT_OK+7, },  // func
    { .t=Opcode_T,      .x=VM_send,     .y=TO_FIX(2),   .z=COMMIT,      },  // (func k_xlat value)

#define G_XLAT_B (G_XLAT_OK+8)
//  { .t=Opcode_T,      .x=VM_push,     .y=_func_,      .z=G_XLAT_B+0,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_ptrn_,      .z=G_XLAT_B-1,  },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=G_XLAT_B+1,  },  // (custs . resume)
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_XLAT_B+2,  },  // resume custs
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=G_XLAT_B+3,  },  // fail ok

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(5),   .z=G_XLAT_B+4,  },  // func
    { .t=Opcode_T,      .x=VM_push,     .y=G_XLAT_OK,   .z=G_XLAT_B+5,  },  // G_XLAT_OK
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=G_XLAT_B+6,  },  // ok'

    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_XLAT_B+7,  },  // custs = (ok' . fail)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=G_XLAT_B+8,  },  // msg = (custs . resume)
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(2),   .z=SEND_0,      },  // ptrn

#define S_CHAIN (G_XLAT_B+9)
#define S_BUSY_C (S_CHAIN+11)
#define S_NEXT_C (S_BUSY_C+17)
//  { .t=Opcode_T,      .x=VM_push,     .y=_ptrn_,      .z=S_CHAIN-1,   },
//  { .t=Opcode_T,      .x=VM_push,     .y=_src_,       .z=S_CHAIN+0,   },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=S_CHAIN+1,   },  // cust
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=S_CHAIN+2,   },  // ptrn
    { .t=Opcode_T,      .x=VM_push,     .y=S_BUSY_C,    .z=S_CHAIN+3,   },  // S_BUSY_C
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=S_CHAIN+4,   },  // BECOME (S_BUSY_C cust ptrn)

    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=S_CHAIN+5,   },  // fail = SELF
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=S_CHAIN+6,   },  // ok = SELF
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=S_CHAIN+7,   },  // custs = (ok . fail)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=S_CHAIN+8,   },  // ptrn
    { .t=Opcode_T,      .x=VM_push,     .y=G_START,     .z=S_CHAIN+9,   },  // G_START
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=S_CHAIN+10,  },  // start = (G_START custs ptrn)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // src

//  { .t=Opcode_T,      .x=VM_push,     .y=_cust_,      .z=S_BUSY_C-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_ptrn_,      .z=S_BUSY_C+0,  },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=S_BUSY_C+1,  },  // msg
    { .t=Opcode_T,      .x=VM_typeq,    .y=Actor_T,     .z=S_BUSY_C+2,  },  // msg has type Actor_T
    { .t=Opcode_T,      .x=VM_if,       .y=RESEND,      .z=S_BUSY_C+3,  },  // defer "get" requests

    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=S_BUSY_C+4,  },  // cdr(msg)
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=S_BUSY_C+5,  },  // cdr(msg) has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=S_BUSY_C+6,  .z=S_BUSY_C+12, },  // treat failure as end

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=S_BUSY_C+7,  },  // ptrn
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=S_BUSY_C+8,  },  // in
    { .t=Opcode_T,      .x=VM_push,     .y=S_NEXT_C,    .z=S_BUSY_C+9,  },  // S_NEXT_C
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=S_BUSY_C+10, },  // next = (S_NEXT_C ptrn in)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=S_BUSY_C+11, },  // token = value
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=S_BUSY_C+13, },  // in = (token . next)

    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=S_BUSY_C+13, },  // in = ()

    { .t=Opcode_T,      .x=VM_push,     .y=S_VALUE,     .z=S_BUSY_C+14, },  // S_VALUE
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(1),   .z=S_BUSY_C+15, },  // BECOME (S_VALUE in)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=S_BUSY_C+16, },  // cust
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=SEND_0,      },  // (SELF . cust)

//  { .t=Opcode_T,      .x=VM_push,     .y=_ptrn_,      .z=S_NEXT_C-1,  },
//  { .t=Opcode_T,      .x=VM_push,     .y=_in_,        .z=S_NEXT_C+0,  },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=S_NEXT_C+1,  },  // cust
    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(3),   .z=S_NEXT_C+2,  },  // ptrn
    { .t=Opcode_T,      .x=VM_push,     .y=S_BUSY_C,    .z=S_NEXT_C+3,  },  // S_BUSY_C
    { .t=Opcode_T,      .x=VM_beh,      .y=TO_FIX(2),   .z=S_NEXT_C+4,  },  // BECOME (S_BUSY_C cust ptrn)

    { .t=Opcode_T,      .x=VM_push,     .y=UNDEF,       .z=S_NEXT_C+5,  },  // value = UNDEF
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=S_NEXT_C+6,  },  // fail = SELF
    { .t=Opcode_T,      .x=VM_self,     .y=UNDEF,       .z=S_NEXT_C+7,  },  // ok = SELF
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=S_NEXT_C+8,  },  // custs = (ok . fail)
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(2),   .z=S_NEXT_C+9,  },  // (custs value . in)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // ptrn

//
// PEG tools
//

#if SCM_PEG_TOOLS
#define F_G_EQ (S_NEXT_C+10)
#define _F_G_EQ TO_CAP(F_G_EQ)
    { .t=Actor_T,       .x=F_G_EQ+1,    .y=NIL,         .z=UNDEF        },  // (peg-eq <token>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_EQ+2,    },  // token = arg1
    { .t=Opcode_T,      .x=VM_push,     .y=G_EQ_B,      .z=F_G_EQ+3,    },  // G_EQ_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_EQ_B token)

#define F_G_OR (F_G_EQ+4)
#define _F_G_OR TO_CAP(F_G_OR)
    { .t=Actor_T,       .x=F_G_OR+1,    .y=NIL,         .z=UNDEF        },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_OR+2,    },  // first = arg1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=F_G_OR+3,    },  // rest = arg2
    { .t=Opcode_T,      .x=VM_push,     .y=G_OR_B,      .z=F_G_OR+4,    },  // G_OR_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // (G_OR_B first rest)

#define F_G_AND (F_G_OR+5)
#define _F_G_AND TO_CAP(F_G_AND)
    { .t=Actor_T,       .x=F_G_AND+1,   .y=NIL,         .z=UNDEF        },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_AND+2,   },  // first = arg1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=F_G_AND+3,   },  // rest = arg2
    { .t=Opcode_T,      .x=VM_push,     .y=G_AND_B,     .z=F_G_AND+4,   },  // G_AND_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // (G_AND_B first rest)

#define F_G_NOT (F_G_AND+5)
#define _F_G_NOT TO_CAP(F_G_NOT)
    { .t=Actor_T,       .x=F_G_NOT+1,   .y=NIL,         .z=UNDEF        },  // (peg-not <peg>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_NOT+2,   },  // peg = arg1
    { .t=Opcode_T,      .x=VM_push,     .y=G_NOT_B,     .z=F_G_NOT+3,   },  // G_NOT_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_NOT_B peg)

#define F_G_CLS (F_G_NOT+4)
#define _F_G_CLS TO_CAP(F_G_CLS)
    { .t=Actor_T,       .x=F_G_CLS+1,   .y=NIL,         .z=UNDEF        },  // (peg-class . <classes>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=F_G_CLS+2,   },
    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_G_CLS+3,   },  // args cust
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX(0),   .z=F_G_CLS+4,   },  // mask = +0
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=F_G_CLS+5,   },  // cust mask args

    { .t=Opcode_T,      .x=VM_pick,     .y=TO_FIX(1),   .z=F_G_CLS+6,   },  // args args
    { .t=Opcode_T,      .x=VM_typeq,    .y=Pair_T,      .z=F_G_CLS+7,   },  // args has type Pair_T
    { .t=Opcode_T,      .x=VM_if,       .y=F_G_CLS+8,   .z=F_G_CLS+12,  },

    { .t=Opcode_T,      .x=VM_part,     .y=TO_FIX(1),   .z=F_G_CLS+9,   },  // tail head
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(3),   .z=F_G_CLS+10,  },  // tail head mask
    { .t=Opcode_T,      .x=VM_alu,      .y=ALU_OR,      .z=F_G_CLS+11,  },  // mask |= head
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=F_G_CLS+5,   },  // mask tail

    { .t=Opcode_T,      .x=VM_drop,     .y=TO_FIX(1),   .z=F_G_CLS+13,  },  // cust mask
    { .t=Opcode_T,      .x=VM_push,     .y=G_CLS_B,     .z=F_G_CLS+14,  },  // G_CLS_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=F_G_CLS+15,  },  // ptrn = (G_CLS_B mask)
    { .t=Opcode_T,      .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // ptrn cust

#define F_G_OPT (F_G_CLS+16)
#define _F_G_OPT TO_CAP(F_G_OPT)
    { .t=Actor_T,       .x=F_G_OPT+1,   .y=NIL,         .z=UNDEF        },  // (peg-opt <peg>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_OPT+2,   },  // peg = arg1
    { .t=Opcode_T,      .x=VM_push,     .y=G_OPT_B,     .z=F_G_OPT+3,   },  // G_OPT_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_OPT_B peg)

#define F_G_PLUS (F_G_OPT+4)
#define _F_G_PLUS TO_CAP(F_G_PLUS)
    { .t=Actor_T,       .x=F_G_PLUS+1,  .y=NIL,         .z=UNDEF        },  // (peg-plus <peg>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_PLUS+2,  },  // peg = arg1
    { .t=Opcode_T,      .x=VM_push,     .y=G_PLUS_B,    .z=F_G_PLUS+3,  },  // G_PLUS_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_PLUS_B peg)

#define F_G_STAR (F_G_PLUS+4)
#define _F_G_STAR TO_CAP(F_G_STAR)
    { .t=Actor_T,       .x=F_G_STAR+1,  .y=NIL,         .z=UNDEF        },  // (peg-star <peg>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_STAR+2,  },  // peg = arg1
    { .t=Opcode_T,      .x=VM_push,     .y=G_STAR_B,    .z=F_G_STAR+3,  },  // G_STAR_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_STAR_B peg)

#define F_G_ALT (F_G_STAR+4)
#define _F_G_ALT TO_CAP(F_G_ALT)
    { .t=Actor_T,       .x=F_G_ALT+1,   .y=NIL,         .z=UNDEF        },  // (peg-alt . <pegs>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_G_ALT+2,   },  // pegs = args
    { .t=Opcode_T,      .x=VM_push,     .y=G_ALT_B,     .z=F_G_ALT+3,   },  // G_ALT_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_ALT_B pegs)

#define F_G_SEQ (F_G_ALT+4)
#define _F_G_SEQ TO_CAP(F_G_SEQ)
    { .t=Actor_T,       .x=F_G_SEQ+1,   .y=NIL,         .z=UNDEF        },  // (peg-seq . <pegs>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(-1),  .z=F_G_SEQ+2,   },  // pegs = args
    { .t=Opcode_T,      .x=VM_push,     .y=G_SEQ_B,     .z=F_G_SEQ+3,   },  // G_SEQ_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_SEQ_B pegs)

#define FX_G_CALL (F_G_SEQ+4)
#define OP_G_CALL (FX_G_CALL+1)
#define _OP_G_CALL TO_CAP(OP_G_CALL)
    { .t=Fexpr_T,       .x=_OP_G_CALL,  .y=UNDEF,       .z=UNDEF,       },  // (peg-call <name>)

    { .t=Actor_T,       .x=OP_G_CALL+1, .y=NIL,         .z=UNDEF        },  // (cust opnds env)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=OP_G_CALL+2, },  // opnds
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(1),   .z=OP_G_CALL+3, },  // name = car(opnds)
    { .t=Opcode_T,      .x=VM_push,     .y=G_CALL_B,    .z=OP_G_CALL+4, },  // G_CALL_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_CALL_B name)

#define F_G_PRED (OP_G_CALL+5)
#define _F_G_PRED TO_CAP(F_G_PRED)
    { .t=Actor_T,       .x=F_G_PRED+1,  .y=NIL,         .z=UNDEF        },  // (peg-pred <pred> <peg>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_PRED+2,  },  // pred = arg1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=F_G_PRED+3,  },  // peg = arg2
    { .t=Opcode_T,      .x=VM_push,     .y=G_PRED_B,    .z=F_G_PRED+4,  },  // G_PRED_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // (G_PRED_B pred peg)

#define F_G_XFORM (F_G_PRED+5)
#define _F_G_XFORM TO_CAP(F_G_XFORM)
    { .t=Actor_T,       .x=F_G_XFORM+1, .y=NIL,         .z=UNDEF        },  // (peg-xform func peg)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_XFORM+2, },  // func = arg1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=F_G_XFORM+3, },  // peg = arg2
    { .t=Opcode_T,      .x=VM_push,     .y=G_XLAT_B,    .z=F_G_XFORM+4, },  // G_XLAT_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // (G_XLAT_B func peg)

#define F_S_LIST (F_G_XFORM+5)
#define _F_S_LIST TO_CAP(F_S_LIST)
    { .t=Actor_T,       .x=F_S_LIST+1,  .y=NIL,         .z=UNDEF        },  // (peg-source <list>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_S_LIST+2,  },  // list = arg1
    { .t=Opcode_T,      .x=VM_push,     .y=S_LIST_B,    .z=F_S_LIST+3,  },  // S_LIST_B
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // src

#define F_G_START (F_S_LIST+4)
#define _F_G_START TO_CAP(F_G_START)
    { .t=Actor_T,       .x=F_G_START+1, .y=NIL,         .z=UNDEF        },  // (peg-start <peg> <src>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=F_G_START+2, },  // fail = cust
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(1),   .z=F_G_START+3, },  // ok = cust
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(1),   .z=F_G_START+4, },  // custs = (ok . fail)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_START+5, },  // peg = arg1
    { .t=Opcode_T,      .x=VM_push,     .y=G_START,     .z=F_G_START+6, },  // G_START
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=F_G_START+7, },  // start
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=SEND_0,      },  // src = arg2

#define F_S_CHAIN (F_G_START+8)
#define _F_S_CHAIN TO_CAP(F_S_CHAIN)
    { .t=Actor_T,       .x=F_S_CHAIN+1, .y=NIL,         .z=UNDEF        },  // (peg-chain <peg> <src>)
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_S_CHAIN+2, },  // peg = arg1
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(3),   .z=F_S_CHAIN+3, },  // src = arg2
    { .t=Opcode_T,      .x=VM_push,     .y=S_CHAIN,     .z=F_S_CHAIN+4, },  // S_CHAIN
    { .t=Opcode_T,      .x=VM_new,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // (S_CHAIN peg src)

//
// Pre-defined PEGs
//

/*
(define peg-end (peg-not peg-any))  ; end of input
*/
#define G_END (F_S_CHAIN+5)
#else // !SCM_PEG_TOOLS
#define G_END (S_NEXT_C+10)
#endif // SCM_PEG_TOOLS
#define _G_END TO_CAP(G_END)
    { .t=Actor_T,       .x=G_END+1,     .y=NIL,         .z=UNDEF        },  // (peg-not peg-any)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_ANY,      .z=G_NOT_B,     },

/*
(define lex-eol (peg-eq 10))  ; end of line
*/
#define G_EOL (G_END+2)
#define _G_EOL TO_CAP(G_EOL)
    { .t=Actor_T,       .x=G_EOL+1,     .y=NIL,         .z=UNDEF        },  // (peg-eq 10)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('\n'),.z=G_EQ_B,      },  // value = '\n' = 10

/*
(define lex-optwsp (peg-star (peg-class WSP)))
*/
#define G_WSP (G_EOL+2)
#define _G_WSP TO_CAP(G_WSP)
    { .t=Actor_T,       .x=G_WSP+1,     .y=NIL,         .z=UNDEF        },  // (peg-class WSP)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX(WSP), .z=G_CLS_B,     },
#define G_WSP_S (G_WSP+2)
#define _G_WSP_S TO_CAP(G_WSP_S)
    { .t=Actor_T,       .x=G_WSP_S+1,   .y=NIL,         .z=UNDEF        },  // (peg-star (peg-class WSP))
    { .t=Opcode_T,      .x=VM_push,     .y=_G_WSP,      .z=G_STAR_B,    },

/*
(define scm-to-eol (peg-or lex-eol (peg-and peg-any (peg-call scm-to-eol))))
*/
#define G_TO_EOL (G_WSP_S+2)
#define _G_TO_EOL TO_CAP(G_TO_EOL)
#define _G_TO_EOL2 TO_CAP(G_TO_EOL+3)
    { .t=Actor_T,       .x=G_TO_EOL+1,  .y=NIL,         .z=UNDEF        },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_EOL,      .z=G_TO_EOL+2,  },  // first = lex-eol
    { .t=Opcode_T,      .x=VM_push,     .y=_G_TO_EOL2,  .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_TO_EOL+4,  .y=NIL,         .z=UNDEF        },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_ANY,      .z=G_TO_EOL+5,  },  // first = peg-any
    { .t=Opcode_T,      .x=VM_push,     .y=_G_TO_EOL,   .z=G_AND_B,     },  // rest = scm-to-eol

/*
(define scm-comment (peg-and (peg-eq 59) scm-to-eol))
*/
#define G_SEMIC (G_TO_EOL+6)
#define _G_SEMIC TO_CAP(G_SEMIC)
    { .t=Actor_T,       .x=G_SEMIC+1,   .y=NIL,         .z=UNDEF        },  // (peg-eq 59)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX(';'), .z=G_EQ_B,      },  // value = ';' = 59
#define G_COMMENT (G_SEMIC+2)
#define _G_COMMENT TO_CAP(G_COMMENT)
    { .t=Actor_T,       .x=G_COMMENT+1, .y=NIL,         .z=UNDEF        },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_SEMIC,    .z=G_COMMENT+2, },  // first = (peg-eq 59)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_TO_EOL,   .z=G_AND_B,     },  // rest = scm-to-eol

/*
(define scm-optwsp (peg-star (peg-or scm-comment (peg-class WSP))))
*/
#define G_OPTWSP (G_COMMENT+3)
#define _G_OPTWSP TO_CAP(G_OPTWSP)
#define _G_OPTWSP2 TO_CAP(G_OPTWSP+2)
    { .t=Actor_T,       .x=G_OPTWSP+1,  .y=NIL,         .z=UNDEF        },  // (peg-star <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_OPTWSP2,  .z=G_STAR_B,    },  // ptrn

    { .t=Actor_T,       .x=G_OPTWSP+3,  .y=NIL,         .z=UNDEF        },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_COMMENT,  .z=G_OPTWSP+4,  },  // first = scm-comment
    { .t=Opcode_T,      .x=VM_push,     .y=_G_WSP,      .z=G_OR_B,      },  // rest = (peg-class WSP)

/*
(define lex-eot (peg-not (peg-class DGT UPR LWR SYM)))  ; end of token
*/
#define G_PRT (G_OPTWSP+5)
#define _G_PRT TO_CAP(G_PRT)
    { .t=Actor_T,       .x=G_PRT+1,     .y=NIL,         .z=UNDEF        },  // (peg-class DGT UPR LWR SYM)
    { .t=Opcode_T, .x=VM_push, .y=TO_FIX(DGT|UPR|LWR|SYM), .z=G_CLS_B,  },
#define G_EOT (G_PRT+2)
#define _G_EOT TO_CAP(G_EOT)
    { .t=Actor_T,       .x=G_EOT+1,     .y=NIL,         .z=UNDEF        },  // (peg-not (peg-class DGT UPR LWR SYM))
    { .t=Opcode_T,      .x=VM_push,     .y=_G_PRT,      .z=G_NOT_B,     },

#define G_UNDER (G_EOT+2)
#define _G_UNDER TO_CAP(G_UNDER)
    { .t=Actor_T,       .x=G_UNDER+1,   .y=NIL,         .z=UNDEF        },  // (peg-eq 95)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('_'), .z=G_EQ_B,      },  // value = '_' = 95

/*
(define lex-sign (peg-or (peg-eq 45) (peg-eq 43)))  ; [-+]
*/
#define G_M_SGN (G_UNDER+2)
#define _G_M_SGN TO_CAP(G_M_SGN)
    { .t=Actor_T,       .x=G_M_SGN+1,   .y=NIL,         .z=UNDEF        },  // (peg-eq 45)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('-'), .z=G_EQ_B,      },  // value = '-' = 45
#define G_P_SGN (G_M_SGN+2)
#define _G_P_SGN TO_CAP(G_P_SGN)
    { .t=Actor_T,       .x=G_P_SGN+1,   .y=NIL,         .z=UNDEF        },  // (peg-eq 43)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('+'), .z=G_EQ_B,      },  // value = '+' = 43
#define G_SIGN (G_P_SGN+2)
#define _G_SIGN TO_CAP(G_SIGN)
    { .t=Actor_T,       .x=G_SIGN+1,    .y=NIL,         .z=UNDEF        },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_M_SGN,    .z=G_SIGN+2,    },  // first = (peg-eq 45)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_P_SGN,    .z=G_OR_B,      },  // rest = (peg-eq 43)

/*
(define lex-digit (peg-or (peg-class DGT) (peg-eq 95)))  ; [0-9_]
*/
#define G_DGT (G_SIGN+3)
#define _G_DGT TO_CAP(G_DGT)
    { .t=Actor_T,       .x=G_DGT+1,     .y=NIL,         .z=UNDEF        },  // (peg-class DGT)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX(DGT), .z=G_CLS_B,     },  // class = [0-9]
#define G_DIGIT (G_DGT+2)
#define _G_DIGIT TO_CAP(G_DIGIT)
    { .t=Actor_T,       .x=G_DIGIT+1,   .y=NIL,         .z=UNDEF        },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_DGT,      .z=G_DIGIT+2,   },  // first = (peg-class DGT)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_UNDER,    .z=G_OR_B,      },  // rest = (peg-eq 95)

/*
(define lex-digits (peg-xform car (peg-and (peg-plus lex-digit) lex-eot)))
*/
#define G_DIGITS (G_DIGIT+3)
#define _G_DIGITS TO_CAP(G_DIGITS)
#define _G_DIGITS2 TO_CAP(G_DIGITS+3)
#define _G_DIGITS3 TO_CAP(G_DIGITS+6)
    { .t=Actor_T,       .x=G_DIGITS+1,  .y=NIL,         .z=UNDEF        },  // (peg-xform car <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_CAR,      .z=G_DIGITS+2,  },  // func = F_CAR
    { .t=Opcode_T,      .x=VM_push,     .y=_G_DIGITS2,  .z=G_XLAT_B,    },  // ptrn = (peg-and (peg-plus lex-digit) lex-eot)

    { .t=Actor_T,       .x=G_DIGITS+4,  .y=NIL,         .z=UNDEF        },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_DIGITS3,  .z=G_DIGITS+5,  },  // first = (peg-plus lex-digit)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_EOT,      .z=G_AND_B,     },  // rest = lex-eot

    { .t=Actor_T,       .x=G_DIGITS+7,  .y=NIL,         .z=UNDEF        },  // (peg-plus <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_DIGIT,    .z=G_PLUS_B,    },  // ptrn = lex-digit

/*
(define lex-number (peg-xform list->number (peg-or (peg-and lex-sign lex-digits) lex-digits)))
*/
#define G_NUMBER (G_DIGITS+8)
#define _G_NUMBER TO_CAP(G_NUMBER)
#define _G_NUMBER2 TO_CAP(G_NUMBER+3)
#define _G_NUMBER3 TO_CAP(G_NUMBER+6)
    { .t=Actor_T,       .x=G_NUMBER+1,  .y=NIL,         .z=UNDEF        },  // (peg-xform list->number <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_LST_NUM,  .z=G_NUMBER+2,  },  // func = F_LST_NUM
    { .t=Opcode_T,      .x=VM_push,     .y=_G_NUMBER2,  .z=G_XLAT_B,    },  // ptrn = (peg-or (peg-and lex-sign lex-digits) lex-digits)

    { .t=Actor_T,       .x=G_NUMBER+4,  .y=NIL,         .z=UNDEF        },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_NUMBER3,  .z=G_NUMBER+5,  },  // first = (peg-and lex-sign lex-digits)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_DIGITS,   .z=G_OR_B,      },  // rest = lex-digits

    { .t=Actor_T,       .x=G_NUMBER+7,  .y=NIL,         .z=UNDEF        },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_SIGN,     .z=G_NUMBER+8,  },  // first = lex-sign
    { .t=Opcode_T,      .x=VM_push,     .y=_G_DIGITS,   .z=G_AND_B,     },  // rest = lex-digits

/*
(define scm-ignore (peg-xform (lambda _ '_) (peg-and (peg-plus (peg-eq 95)) lex-eot)))
*/
#define F_IGN (G_NUMBER+9)
#define _F_IGN TO_CAP(F_IGN)
    { .t=Actor_T,       .x=F_IGN+1,     .y=NIL,         .z=UNDEF        },  // (lambda _ '_)
    { .t=Opcode_T,      .x=VM_push,     .y=S_IGNORE,    .z=CUST_SEND,   },
#define G_IGN (F_IGN+2)
#define _G_IGN TO_CAP(G_IGN)
#define _G_IGN2 TO_CAP(G_IGN+3)
#define _G_IGN3 TO_CAP(G_IGN+6)
    { .t=Actor_T,       .x=G_IGN+1,     .y=NIL,         .z=UNDEF        },  // (peg-xform (lambda _ '_) <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_IGN,      .z=G_IGN+2,     },  // func = F_IGN
    { .t=Opcode_T,      .x=VM_push,     .y=_G_IGN2,     .z=G_XLAT_B,    },  // ptrn = ...

    { .t=Actor_T,       .x=G_IGN+4,     .y=NIL,         .z=UNDEF        },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_IGN3,     .z=G_IGN+5,     },  // first = (peg-plus (peg-eq 95))
    { .t=Opcode_T,      .x=VM_push,     .y=_G_EOT,      .z=G_AND_B,     },  // rest = lex-eot

    { .t=Actor_T,       .x=G_IGN+7,     .y=NIL,         .z=UNDEF        },  // (peg-plus (peg-eq 95))
    { .t=Opcode_T,      .x=VM_push,     .y=_G_UNDER,    .z=G_PLUS_B,    },  // ptrn = (peg-eq 95)

/*
(define scm-const (peg-xform cadr (peg-seq
  (peg-eq 35)
  (peg-alt
    (peg-xform (lambda _ #f) (peg-eq 102))
    (peg-xform (lambda _ #t) (peg-eq 116))
    (peg-xform (lambda _ #?) (peg-eq 63))
    (peg-xform (lambda _ #unit) (peg-seq (peg-eq 117) (peg-eq 110) (peg-eq 105) (peg-eq 116))))
  lex-eot)))
*/
#define G_HASH (G_IGN+8)
#define _G_HASH TO_CAP(G_HASH)
    { .t=Actor_T,       .x=G_HASH+1,    .y=NIL,         .z=UNDEF,       },  // (peg-eq 35)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('#'), .z=G_EQ_B,      },  // value = '#' = 35
#define G_LWR_U (G_HASH+2)
#define _G_LWR_U TO_CAP(G_LWR_U)
    { .t=Actor_T,       .x=G_LWR_U+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 117)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('u'), .z=G_EQ_B,      },  // value = 'u' = 117
#define G_LWR_N (G_LWR_U+2)
#define _G_LWR_N TO_CAP(G_LWR_N)
    { .t=Actor_T,       .x=G_LWR_N+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 110)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('n'), .z=G_EQ_B,      },  // value = 'n' = 110
#define G_LWR_I (G_LWR_N+2)
#define _G_LWR_I TO_CAP(G_LWR_I)
    { .t=Actor_T,       .x=G_LWR_I+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 105)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('i'), .z=G_EQ_B,      },  // value = 'i' = 105
#define G_LWR_T (G_LWR_I+2)
#define _G_LWR_T TO_CAP(G_LWR_T)
    { .t=Actor_T,       .x=G_LWR_T+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 116)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('t'), .z=G_EQ_B,      },  // value = 't' = 116
#define G_LWR_F (G_LWR_T+2)
#define _G_LWR_F TO_CAP(G_LWR_F)
    { .t=Actor_T,       .x=G_LWR_F+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 102)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('f'), .z=G_EQ_B,      },  // value = 'f' = 102
#define G_QMARK (G_LWR_F+2)
#define _G_QMARK TO_CAP(G_QMARK)
    { .t=Actor_T,       .x=G_QMARK+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 63)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('?'), .z=G_EQ_B,      },  // value = '?' = 63

#define F_FALSE (G_QMARK+2)
#define _F_FALSE TO_CAP(F_FALSE)
    { .t=Actor_T,       .x=RV_FALSE,    .y=NIL,         .z=UNDEF,       },  // (lambda _ #f)
#define G_FALSE (F_FALSE+1)
#define _G_FALSE TO_CAP(G_FALSE)
    { .t=Actor_T,       .x=G_FALSE+1,   .y=NIL,         .z=UNDEF,       },  // (peg-xform (lambda _ #f) (peg-eq 102))
    { .t=Opcode_T,      .x=VM_push,     .y=_F_FALSE,    .z=G_FALSE+2,   },  // func = F_FALSE
    { .t=Opcode_T,      .x=VM_push,     .y=_G_LWR_F,    .z=G_XLAT_B,    },  // ptrn = (peg-eq 102)

#define F_TRUE (G_FALSE+3)
#define _F_TRUE TO_CAP(F_TRUE)
    { .t=Actor_T,       .x=RV_TRUE,     .y=NIL,         .z=UNDEF,       },  // (lambda _ #t)
#define G_TRUE (F_TRUE+1)
#define _G_TRUE TO_CAP(G_TRUE)
    { .t=Actor_T,       .x=G_TRUE+1,    .y=NIL,         .z=UNDEF,       },  // (peg-xform (lambda _ #t) (peg-eq 116))
    { .t=Opcode_T,      .x=VM_push,     .y=_F_TRUE,     .z=G_TRUE+2,    },  // func = F_TRUE
    { .t=Opcode_T,      .x=VM_push,     .y=_G_LWR_T,    .z=G_XLAT_B,    },  // ptrn = (peg-eq 116)

#define F_UNDEF (G_TRUE+3)
#define _F_UNDEF TO_CAP(F_UNDEF)
    { .t=Actor_T,       .x=RV_UNDEF,    .y=NIL,         .z=UNDEF,       },  // (lambda _ #?)
#define G_UNDEF (F_UNDEF+1)
#define _G_UNDEF TO_CAP(G_UNDEF)
    { .t=Actor_T,       .x=G_UNDEF+1,   .y=NIL,         .z=UNDEF,       },  // (peg-xform (lambda _ #?) (peg-eq 63))
    { .t=Opcode_T,      .x=VM_push,     .y=_F_UNDEF,    .z=G_UNDEF+2,   },  // func = F_UNDEF
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QMARK,    .z=G_XLAT_B,    },  // ptrn = G_QMARK

#define F_UNIT (G_UNDEF+3)
#define _F_UNIT TO_CAP(F_UNIT)
    { .t=Actor_T,       .x=RV_UNIT,     .y=NIL,         .z=UNDEF,       },  // (lambda _ #unit)
#define G_UNIT (F_UNIT+1)
#define _G_UNIT TO_CAP(G_UNIT)
#define _G_UNIT2 TO_CAP(G_UNIT+3)
#define _G_UNIT3 TO_CAP(G_UNIT+6)
#define _G_UNIT4 TO_CAP(G_UNIT+9)
    { .t=Actor_T,       .x=G_UNIT+1,    .y=NIL,         .z=UNDEF,       },  // (peg-xform (lambda _ #unit) <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_UNIT,     .z=G_UNIT+2,    },  // func = F_UNIT
    { .t=Opcode_T,      .x=VM_push,     .y=_G_UNIT2,    .z=G_XLAT_B,    },  // ptrn = (peg-seq (peg-eq 117) (peg-eq 110) (peg-eq 105) (peg-eq 116))

    { .t=Actor_T,       .x=G_UNIT+4,    .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_LWR_U,    .z=G_UNIT+5,    },  // first = (peg-eq 117)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_UNIT3,    .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_UNIT+7,    .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_LWR_N,    .z=G_UNIT+8,    },  // first = (peg-eq 110)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_UNIT4,    .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_UNIT+10,   .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_LWR_I,    .z=G_UNIT+11,   },  // first = (peg-eq 105)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_LWR_T,    .z=G_AND_B,     },  // rest = (peg-eq 116)

#define G_CONST (G_UNIT+12)
#define _G_CONST TO_CAP(G_CONST)
#define _G_CONST2 TO_CAP(G_CONST+3)
#define _G_CONST3 TO_CAP(G_CONST+6)
#define _G_CONST4 TO_CAP(G_CONST+9)
#define _G_CONST5 TO_CAP(G_CONST+12)
#define _G_CONST6 TO_CAP(G_CONST+15)
    { .t=Actor_T,       .x=G_CONST+1,   .y=NIL,         .z=UNDEF,       },  // (peg-xform cadr <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_CADR,     .z=G_CONST+2,   },  // func = F_CADR
    { .t=Opcode_T,      .x=VM_push,     .y=_G_CONST2,   .z=G_XLAT_B,    },  // ptrn = (peg-seq (peg-eq 35) (peg-alt ...) lex-eot)

    { .t=Actor_T,       .x=G_CONST+4,   .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_HASH,     .z=G_CONST+5,   },  // first = (peg-eq 35)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_CONST3,   .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_CONST+7,   .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_CONST4,   .z=G_CONST+8,   },  // first = (peg-alt G_FALSE G_TRUE G_UNDEF G_UNIT)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_EOT,      .z=G_AND_B,     },  // rest = lex-eot

    { .t=Actor_T,       .x=G_CONST+10,  .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_FALSE,    .z=G_CONST+11,  },  // first = G_FALSE
    { .t=Opcode_T,      .x=VM_push,     .y=_G_CONST5,   .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_CONST+13,  .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_TRUE,     .z=G_CONST+14,  },  // first = G_TRUE
    { .t=Opcode_T,      .x=VM_push,     .y=_G_CONST6,   .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_CONST+16,  .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_UNDEF,    .z=G_CONST+17,  },  // first = G_UNDEF
    { .t=Opcode_T,      .x=VM_push,     .y=_G_UNIT,     .z=G_OR_B,      },  // rest

/*
(define scm-symbol (peg-xform list->symbol (peg-plus (peg-class DGT UPR LWR SYM))))
*/
#define G_SYMBOL (G_CONST+18)
#define _G_SYMBOL TO_CAP(G_SYMBOL)
#define _G_SYMBOL2 TO_CAP(G_SYMBOL+3)
    { .t=Actor_T,       .x=G_SYMBOL+1,  .y=NIL,         .z=UNDEF,       },  // (peg-xform list->symbol <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_LST_SYM,  .z=G_SYMBOL+2,  },  // func = F_LST_SYM
    { .t=Opcode_T,      .x=VM_push,     .y=_G_SYMBOL2,  .z=G_XLAT_B,    },  // ptrn = (peg-plus (peg-class DGT UPR LWR SYM))

    { .t=Actor_T,       .x=G_SYMBOL+4,  .y=NIL,         .z=UNDEF,       },  // (peg-plus <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_PRT,      .z=G_PLUS_B,    },  // ptrn = (peg-class DGT UPR LWR SYM)

#define G_OPEN (G_SYMBOL+5)
#define _G_OPEN TO_CAP(G_OPEN)
    { .t=Actor_T,       .x=G_OPEN+1,    .y=NIL,         .z=UNDEF,       },  // (peg-eq 40)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('('), .z=G_EQ_B,      },  // value = '(' = 40
#define G_DOT (G_OPEN+2)
#define _G_DOT TO_CAP(G_DOT)
    { .t=Actor_T,       .x=G_DOT+1,     .y=NIL,         .z=UNDEF,       },  // (peg-eq 46)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('.'), .z=G_EQ_B,      },  // value = '.' = 46
#define G_CLOSE (G_DOT+2)
#define _G_CLOSE TO_CAP(G_CLOSE)
    { .t=Actor_T,       .x=G_CLOSE+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 41)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX(')'), .z=G_EQ_B,      },  // value = ')' = 41
#define G_QUOTE (G_CLOSE+2)
#define _G_QUOTE TO_CAP(G_QUOTE)
    { .t=Actor_T,       .x=G_QUOTE+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 39)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('\''),.z=G_EQ_B,      },  // value = '\'' = 39
#define G_BQUOTE (G_QUOTE+2)
#define _G_BQUOTE TO_CAP(G_BQUOTE)
    { .t=Actor_T,       .x=G_BQUOTE+1,  .y=NIL,         .z=UNDEF,       },  // (peg-eq 96)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('`'), .z=G_EQ_B,      },  // value = '`' = 96
#define G_COMMA (G_BQUOTE+2)
#define _G_COMMA TO_CAP(G_COMMA)
    { .t=Actor_T,       .x=G_COMMA+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 44)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX(','), .z=G_EQ_B,      },  // value = ',' = 44
#define G_AT (G_COMMA+2)
#define _G_AT TO_CAP(G_AT)
    { .t=Actor_T,       .x=G_AT+1,      .y=NIL,         .z=UNDEF,       },  // (peg-eq 64)
    { .t=Opcode_T,      .x=VM_push,     .y=TO_FIX('@'), .z=G_EQ_B,      },  // value = '@' = 64

/*
(define scm-quoted (peg-alt
  (peg-xform (lambda (x) (list 'quote (cdr x)))
    (peg-and (peg-eq 39) (peg-call scm-expr)))
  (peg-xform (lambda (x) (list 'quasiquote (cdr x)))
    (peg-and (peg-eq 96) (peg-call scm-expr)))
  (peg-xform (lambda (x) (list 'unquote-splicing (cddr x)))
    (peg-and (peg-eq 44) (peg-and (peg-eq 64) (peg-call scm-expr))))
  (peg-xform (lambda (x) (list 'unquote (cdr x)))
    (peg-and (peg-eq 44) (peg-call scm-expr)))
  (peg-xform (lambda (x) (list 'placeholder (cdr x)))
    (peg-and (peg-eq 63) (peg-call scm-expr)))
  ))
*/
#define F_QUOTED (G_AT+2)
#define _F_QUOTED TO_CAP(F_QUOTED)
    { .t=Actor_T,       .x=F_QUOTED+1,  .y=NIL,         .z=UNDEF,       },  // (lambda (x) (list 'quote (cdr x)))
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=F_QUOTED+2,  },  // ()
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_QUOTED+3,  },  // arg1
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(-1),  .z=F_QUOTED+4,  },  // value = cdr(arg1)
    { .t=Opcode_T,      .x=VM_push,     .y=S_QUOTE,     .z=F_QUOTED+5,  },  // S_QUOTE
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // (S_QUOTE value)
#define F_QQUOTED (F_QUOTED+6)
#define _F_QQUOTED TO_CAP(F_QQUOTED)
    { .t=Actor_T,       .x=F_QQUOTED+1, .y=NIL,         .z=UNDEF,       },  // (lambda (x) (list 'quasiquote (cdr x)))
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=F_QQUOTED+2, },  // ()
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_QQUOTED+3, },  // arg1
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(-1),  .z=F_QQUOTED+4, },  // value = cdr(arg1)
    { .t=Opcode_T,      .x=VM_push,     .y=S_QQUOTE,    .z=F_QQUOTED+5, },  // S_QQUOTE
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // (S_QQUOTE value)
#define F_UNQUOTED (F_QQUOTED+6)
#define _F_UNQUOTED TO_CAP(F_UNQUOTED)
    { .t=Actor_T,       .x=F_UNQUOTED+1,.y=NIL,         .z=UNDEF,       },  // (lambda (x) (list 'unquote (cdr x)))
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=F_UNQUOTED+2,},  // ()
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_UNQUOTED+3,},  // arg1
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(-1),  .z=F_UNQUOTED+4,},  // value = cdr(arg1)
    { .t=Opcode_T,      .x=VM_push,     .y=S_UNQUOTE,   .z=F_UNQUOTED+5,},  // S_UNQUOTE
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // (S_UNQUOTE value)
#define F_QSPLICED (F_UNQUOTED+6)
#define _F_QSPLICED TO_CAP(F_QSPLICED)
    { .t=Actor_T,       .x=F_QSPLICED+1,.y=NIL,         .z=UNDEF,       },  // (lambda (x) (list 'unquote-splicing (cddr x)))
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=F_QSPLICED+2,},  // ()
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_QSPLICED+3,},  // arg1
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(-2),  .z=F_QSPLICED+4,},  // value = cddr(arg1)
    { .t=Opcode_T,      .x=VM_push,     .y=S_QSPLICE,   .z=F_QSPLICED+5,},  // S_QSPLICE
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // (S_QSPLICE value)
#define F_PLACEHD (F_QSPLICED+6)
#define _F_PLACEHD TO_CAP(F_PLACEHD)
    { .t=Actor_T,       .x=F_PLACEHD+1, .y=NIL,         .z=UNDEF,       },  // (lambda (x) (list 'placeholder (cdr x)))
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=F_PLACEHD+2, },  // ()
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(2),   .z=F_PLACEHD+3, },  // arg1
    { .t=Opcode_T,      .x=VM_nth,      .y=TO_FIX(-1),  .z=F_PLACEHD+4, },  // value = cdr(arg1)
    { .t=Opcode_T,      .x=VM_push,     .y=S_PLACEH,    .z=F_PLACEHD+5, },  // S_PLACEH
    { .t=Opcode_T,      .x=VM_pair,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // (S_PLACEH value)
#define F_NIL (F_PLACEHD+6)
#define _F_NIL TO_CAP(F_NIL)
    { .t=Actor_T,       .x=RV_NIL,      .y=NIL,         .z=UNDEF,       },  // (lambda _ ())

#define G_QUOTED (F_NIL+1)
#define _G_QUOTED TO_CAP(G_QUOTED)
#define _G_QUOTED2 TO_CAP(G_QUOTED+3)
#define _G_QUOTED3 TO_CAP(G_QUOTED+6)
#define _G_QUOTED4 TO_CAP(G_QUOTED+9)
#define _G_QUOTED5 TO_CAP(G_QUOTED+12)
#define _G_QUOTED6 TO_CAP(G_QUOTED+15)
#define _G_QUOTED7 TO_CAP(G_QUOTED+18)
#define _G_QUOTED8 TO_CAP(G_QUOTED+21)
#define _G_QUOTED9 TO_CAP(G_QUOTED+24)
#define _G_QUOTED10 TO_CAP(G_QUOTED+27)
#define _G_QUOTED11 TO_CAP(G_QUOTED+30)
#define _G_QUOTED12 TO_CAP(G_QUOTED+33)
#define _G_QUOTED13 TO_CAP(G_QUOTED+36)
#define _G_QUOTED14 TO_CAP(G_QUOTED+39)
#define _G_QUOTED15 TO_CAP(G_QUOTED+42)
#define G_DOTTED (G_QUOTED+45)
#define _G_DOTTED TO_CAP(G_DOTTED)
#define _G_DOTTED2 TO_CAP(G_DOTTED+3)
#define _G_DOTTED3 TO_CAP(G_DOTTED+6)
#define _G_DOTTED4 TO_CAP(G_DOTTED+9)
#define _G_DOTTED5 TO_CAP(G_DOTTED+12)
#define G_TAIL (G_DOTTED+15)
#define _G_TAIL TO_CAP(G_TAIL)
#define _G_TAIL2 TO_CAP(G_TAIL+3)
#define _G_TAIL3 TO_CAP(G_TAIL+6)
#define _G_TAIL4 TO_CAP(G_TAIL+9)
#define _G_TAIL5 TO_CAP(G_TAIL+12)
#define _G_TAIL6 TO_CAP(G_TAIL+15)
#define G_LIST (G_TAIL+18)
#define _G_LIST TO_CAP(G_LIST)
#define _G_LIST2 TO_CAP(G_LIST+3)
#define G_EXPR (G_LIST+6)
#define _G_EXPR TO_CAP(G_EXPR)
#define _G_EXPR2 TO_CAP(G_EXPR+3)
#define _G_EXPR3 TO_CAP(G_EXPR+6)
#define _G_EXPR4 TO_CAP(G_EXPR+9)
#define _G_EXPR5 TO_CAP(G_EXPR+12)
#define G_SEXPR (G_EXPR+15)
#define _G_SEXPR TO_CAP(G_SEXPR)
#define _G_SEXPR2 TO_CAP(G_SEXPR+3)
    { .t=Actor_T,       .x=G_QUOTED+1,  .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED2,  .z=G_QUOTED+2,  },  // first
#if PLACEH_SYNTAX
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED13, .z=G_OR_B,      },  // rest
#else
#if QQUOTE_SYNTAX
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED4,  .z=G_OR_B,      },  // rest
#else
    { .t=Opcode_T,      .x=VM_push,     .y=_G_FAIL,     .z=G_OR_B,      },  // rest
#endif
#endif

    { .t=Actor_T,       .x=G_QUOTED+4,  .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_QUOTED,   .z=G_QUOTED+5,  },  // func
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED3,  .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_QUOTED+7,  .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTE,    .z=G_QUOTED+8,  },  // first = (peg-eq 39)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_SEXPR,    .z=G_AND_B,     },  // rest = scm-expr

    { .t=Actor_T,       .x=G_QUOTED+10, .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED5,  .z=G_QUOTED+11, },  // first
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED7,  .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_QUOTED+13, .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_QQUOTED,  .z=G_QUOTED+14, },  // func
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED6,  .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_QUOTED+16, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_BQUOTE,   .z=G_QUOTED+17, },  // first = (peg-eq 96)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_SEXPR,    .z=G_AND_B,     },  // rest = scm-expr

    { .t=Actor_T,       .x=G_QUOTED+19, .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED8,  .z=G_QUOTED+20, },  // first
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED11, .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_QUOTED+22, .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_QSPLICED, .z=G_QUOTED+23, },  // func
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED9,  .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_QUOTED+25, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_COMMA,    .z=G_QUOTED+26, },  // first = (peg-eq 44)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED10, .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_QUOTED+28, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_AT,       .z=G_QUOTED+29, },  // first = (peg-eq 64)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_SEXPR,    .z=G_AND_B,     },  // rest = scm-expr

    { .t=Actor_T,       .x=G_QUOTED+31, .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_UNQUOTED, .z=G_QUOTED+32, },  // func
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED12, .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_QUOTED+34, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_COMMA,    .z=G_QUOTED+35, },  // first = (peg-eq 44)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_SEXPR,    .z=G_AND_B,     },  // rest = scm-expr

    { .t=Actor_T,       .x=G_QUOTED+37, .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED14, .z=G_QUOTED+38, },  // first
#if QQUOTE_SYNTAX
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED4,  .z=G_OR_B,      },  // rest
#else
    { .t=Opcode_T,      .x=VM_push,     .y=_G_FAIL,     .z=G_OR_B,      },  // rest
#endif

    { .t=Actor_T,       .x=G_QUOTED+40, .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_PLACEHD,  .z=G_QUOTED+41, },  // func
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED15, .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_QUOTED+43, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QMARK,    .z=G_QUOTED+44, },  // first = (peg-eq 63)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_SEXPR,    .z=G_AND_B,     },  // rest = scm-expr

/*
(define scm-dotted (peg-xform caddr
  (peg-seq scm-optwsp (peg-eq 46) (peg-call scm-sexpr) scm-optwsp (peg-eq 41))))
*/
    { .t=Actor_T,       .x=G_DOTTED+1,  .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_CADDR,    .z=G_DOTTED+2,  },  // func = caddr
    { .t=Opcode_T,      .x=VM_push,     .y=_G_DOTTED2,  .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_DOTTED+4,  .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_OPTWSP,   .z=G_DOTTED+5,  },  // first = scm-optwsp
    { .t=Opcode_T,      .x=VM_push,     .y=_G_DOTTED3,  .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_DOTTED+7,  .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_DOT,      .z=G_DOTTED+8,  },  // first = (peg-eq 46)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_DOTTED4,  .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_DOTTED+10, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_SEXPR,    .z=G_DOTTED+11, },  // first = scm-sexpr
    { .t=Opcode_T,      .x=VM_push,     .y=_G_DOTTED5,  .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_DOTTED+13, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_OPTWSP,   .z=G_DOTTED+14, },  // first = scm-optwsp
    { .t=Opcode_T,      .x=VM_push,     .y=_G_CLOSE,    .z=G_AND_B,     },  // rest = (peg-eq 41)

/*
(define scm-tail (peg-xform cdr (peg-and
  scm-optwsp
  (peg-or
    (peg-xform (lambda _ ()) (peg-eq 41))
    (peg-and
      (peg-call scm-expr)
      (peg-or scm-dotted (peg-call scm-tail)) )) )))
*/
    { .t=Actor_T,       .x=G_TAIL+1,    .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_CDR,      .z=G_TAIL+2,    },  // func = cdr
    { .t=Opcode_T,      .x=VM_push,     .y=_G_TAIL2,    .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_TAIL+4,    .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_OPTWSP,   .z=G_TAIL+5,    },  // first = scm-optwsp
    { .t=Opcode_T,      .x=VM_push,     .y=_G_TAIL3,    .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_TAIL+7,    .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_TAIL4,    .z=G_TAIL+8,    },  // first = (peg-xform ...)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_TAIL5,    .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_TAIL+10,   .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_NIL,      .z=G_TAIL+11,   },  // func = (lambda _ ())
    { .t=Opcode_T,      .x=VM_push,     .y=_G_CLOSE,    .z=G_XLAT_B,    },  // ptrn = (peg-eq 41)

    { .t=Actor_T,       .x=G_TAIL+13,   .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_EXPR,     .z=G_TAIL+14,   },  // first = scm-expr
    { .t=Opcode_T,      .x=VM_push,     .y=_G_TAIL6,    .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_TAIL+16,   .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_DOTTED,   .z=G_TAIL+17,   },  // first = scm-dotted
    { .t=Opcode_T,      .x=VM_push,     .y=_G_TAIL,     .z=G_OR_B,      },  // rest = scm-tail

/*
(define scm-list (peg-xform cdr (peg-and (peg-eq 40) scm-tail)))
*/
    { .t=Actor_T,       .x=G_LIST+1,    .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_CDR,      .z=G_LIST+2,    },  // func = cdr
    { .t=Opcode_T,      .x=VM_push,     .y=_G_LIST2,    .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_LIST+4,    .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_OPEN,     .z=G_LIST+5,    },  // first = (peg-eq 40)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_TAIL,     .z=G_AND_B,     },  // rest = scm-tail

/*
(define scm-expr (peg-alt scm-list scm-ignore scm-const lex-number scm-quoted scm-symbol))
*/
    { .t=Actor_T,       .x=G_EXPR+1,    .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_LIST,     .z=G_EXPR+2,    },  // first = scm-list
    { .t=Opcode_T,      .x=VM_push,     .y=_G_EXPR2,    .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_EXPR+4,    .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_IGN,      .z=G_EXPR+5,    },  // first = scm-ignore
    { .t=Opcode_T,      .x=VM_push,     .y=_G_EXPR3,    .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_EXPR+7,    .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_CONST,    .z=G_EXPR+8,    },  // first = scm-const
    { .t=Opcode_T,      .x=VM_push,     .y=_G_EXPR4,    .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_EXPR+10,   .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_NUMBER,   .z=G_EXPR+11,   },  // first = lex-number
    { .t=Opcode_T,      .x=VM_push,     .y=_G_EXPR5,   .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_EXPR+13,   .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_QUOTED,   .z=G_EXPR+14,   },  // first = scm-quoted
    { .t=Opcode_T,      .x=VM_push,     .y=_G_SYMBOL,   .z=G_OR_B,      },  // rest = scm-symbol

/*
(define scm-sexpr (peg-xform cdr (peg-and scm-optwsp scm-expr)))
*/
    { .t=Actor_T,       .x=G_SEXPR+1,   .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Opcode_T,      .x=VM_push,     .y=_F_CDR,      .z=G_SEXPR+2,   },  // func = cdr
    { .t=Opcode_T,      .x=VM_push,     .y=_G_SEXPR2,   .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_SEXPR+4,   .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Opcode_T,      .x=VM_push,     .y=_G_OPTWSP,   .z=G_SEXPR+5,   },  // first = scm-optwsp
    { .t=Opcode_T,      .x=VM_push,     .y=_G_EXPR,     .z=G_AND_B,     },  // rest = scm-expr

#define S_EMPTY (G_SEXPR+6)
#define _S_EMPTY TO_CAP(S_EMPTY)
    { .t=Actor_T,       .x=S_EMPTY+1,   .y=NIL,         .z=UNDEF,       },
    { .t=Opcode_T,      .x=VM_push,     .y=NIL,         .z=S_VALUE,     },  // ()

#define A_PRINT (S_EMPTY+2)
#define _A_PRINT TO_CAP(A_PRINT)
    { .t=Actor_T,       .x=A_PRINT+1,   .y=NIL,         .z=UNDEF,       },
    { .t=Opcode_T,      .x=VM_msg,      .y=TO_FIX(0),   .z=A_PRINT+2,   },
    { .t=Opcode_T,      .x=VM_debug,    .y=TO_FIX(7331),.z=COMMIT,      },

#define A_QUIT (A_PRINT+3)
#define _A_QUIT TO_CAP(A_QUIT)
    { .t=Actor_T,       .x=A_QUIT+1,    .y=NIL,         .z=UNDEF,       },
    { .t=Opcode_T,      .x=VM_end,      .y=END_STOP,    .z=UNDEF,       },  // kill thread

#define CELL_BASE (A_QUIT+2)
};
cell_t *cell_zero = &cell_table[0];  // base for cell offsets
int_t cell_next = NIL;  // head of cell free-list (or NIL if empty)
int_t cell_top = CELL_BASE; // limit of allocated cell memory

static struct { int_t addr; char *label; } symbol_table[] = {
    { UNDEF, "UNDEF" },
    { NIL, "NIL" },
    { FALSE, "FALSE" },
    { TRUE, "TRUE" },
    { UNIT, "UNIT" },
    { Type_T, "Type_T" },
    { Event_T, "Event_T" },
    { Opcode_T, "Opcode_T" },
    { Actor_T, "Actor_T" },
    { Fixnum_T, "Fixnum_T" },
    { Symbol_T, "Symbol_T" },
    { Pair_T, "Pair_T" },
    { Fexpr_T, "Fexpr_T" },
    { Free_T, "Free_T" },
    { START, "START" },

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
    { A_BOOT, "A_BOOT" },

    { A_CLOCK, "A_CLOCK" },
    { CLOCK_BEH, "CLOCK_BEH" },

    { TAG_BEH, "TAG_BEH" },
    { K_JOIN_H, "K_JOIN_H" },
    { K_JOIN_T, "K_JOIN_T" },
    { JOIN_BEH, "JOIN_BEH" },
    { FORK_BEH, "FORK_BEH" },

    { S_IGNORE, "S_IGNORE" },
    { S_QUOTE, "S_QUOTE" },
    { S_QQUOTE, "S_QQUOTE" },
    { S_UNQUOTE, "S_UNQUOTE" },
    { S_QSPLICE, "S_QSPLICE" },
    { S_PLACEH, "S_PLACEH" },

    { M_EVAL, "M_EVAL" },
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
    { F_NUM_ADD, "F_NUM_ADD" },
    { F_NUM_SUB, "F_NUM_SUB" },
    { F_NUM_MUL, "F_NUM_MUL" },
    { F_LST_NUM, "F_LST_NUM" },
    { F_LST_SYM, "F_LST_SYM" },
    { F_PRINT, "F_PRINT" },

#if SCM_ASM_TOOLS
    { F_CELL, "F_CELL" },
    { F_GET_T, "F_GET_T" },
    { F_GET_X, "F_GET_X" },
    { F_GET_Y, "F_GET_Y" },
    { F_GET_Z, "F_GET_Z" },
    { F_SET_T, "F_SET_T" },
    { F_SET_X, "F_SET_X" },
    { F_SET_Y, "F_SET_Y" },
    { F_SET_Z, "F_SET_Z" },
#endif // SCM_ASM_TOOLS

#if META_ACTORS
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
#endif // META_ACTORS

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

#if SCM_PEG_TOOLS
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
#endif // SCM_PEG_TOOLS

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

    { S_EMPTY, "S_EMPTY" },
    { A_PRINT, "A_PRINT" },
    { A_QUIT, "A_QUIT" },
    { CELL_BASE, "CELL_BASE" },
    { -1, "" },
};
void dump_symbol_table() {
    for (int i = 0; symbol_table[i].addr >= 0; ++i) {
        fprintf(stderr, "%5"PdI": %s\n",
            symbol_table[i].addr, symbol_table[i].label);
    }
}
char *get_symbol_label(int_t addr) {
    int i = 0;
    while (symbol_table[i].addr >= 0) {
        if (addr == symbol_table[i].addr) break;
        ++i;
    }
    return symbol_table[i].label;
}

#if CONCURRENT_GC
static int_t gc_mark_cell(int_t addr);  // FORWARD DECLARATION
static int_t gc_free_cell(int_t addr);  // FORWARD DECLARATION
#define MARK_CELL(n) gc_mark_cell(n)
#define FREE_CELL(n) gc_free_cell(n)
#endif // CONCURRENT_GC

#if MARK_SWEEP_GC
#define MARK_CELL(n) (n)
#define FREE_CELL(n) (n)
#endif // MARK_SWEEP_GC

#define get_t(n) (cell_zero[(n)].t)
#define get_x(n) (cell_zero[(n)].x)
#define get_y(n) (cell_zero[(n)].y)
#define get_z(n) (cell_zero[(n)].z)

#define set_t(n,v) (cell_zero[(n)].t = MARK_CELL(v))
#define set_x(n,v) (cell_zero[(n)].x = MARK_CELL(v))
#define set_y(n,v) (cell_zero[(n)].y = MARK_CELL(v))
#define set_z(n,v) (cell_zero[(n)].z = MARK_CELL(v))

#define IS_CELL(n)  (NAT(n) < cell_top)
#define IN_HEAP(n)  (((n)>=START) && ((n)<cell_top))

#define IS_BOOL(n)  (((n) == FALSE) || ((n) == TRUE))

#define TYPEQ(t,n)  (IS_CELL(n) && (get_t(n) == (t)))
#define IS_EVENT(n) TYPEQ(Event_T,(n))
#define IS_FREE(n)  TYPEQ(Free_T,(n))
#define IS_PAIR(n)  TYPEQ(Pair_T,(n))
#define IS_ACTOR(v) (IS_CAP(v) && TYPEQ(Actor_T,TO_REF(v)))
#define IS_FEXPR(n) TYPEQ(Fexpr_T,(n))
#define IS_SYM(n)   TYPEQ(Symbol_T,(n))
#define IS_CODE(n)  TYPEQ(Opcode_T,(n))

static i32 gc_free_cnt;  // FORWARD DECLARATION

static int_t cell_new(int_t t, int_t x, int_t y, int_t z) {
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

int_t cons(int_t head, int_t tail) {
    return cell_new(Pair_T, head, tail, UNDEF);
}

#define list_0  NIL
#define list_1(v1)  cons((v1), NIL)
#define list_2(v1,v2)  cons((v1), cons((v2), NIL))
#define list_3(v1,v2,v3)  cons((v1), cons((v2), cons((v3), NIL)))
#define list_4(v1,v2,v3,v4)  cons((v1), cons((v2), cons((v3), cons((v4), NIL))))
#define list_5(v1,v2,v3,v4,v5)  cons((v1), cons((v2), cons((v3), cons((v4), cons((v5), NIL)))))
#define list_6(v1,v2,v3,v4,v5,v6)  cons((v1), cons((v2), cons((v3), cons((v4), cons((v5), cons((v6), NIL))))))

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

// WARNING! destuctive reverse-in-place and append
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

// return integer for character string
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
int_t e_queue_head;  
int_t k_queue_head;

static i32 gc_free_cnt = 0;  // number of cells in free-list
static int_t gc_root_set = NIL;
#if RUNTIME_STATS
static long gc_cycle_count = 0;
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
        if (a < START) {
            c = 't';
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
        "gc: top=%"PRId32" gen_%c=%"PRId32" gen_%c=%"PRId32" free=%"PRId32" scan=%"PRId32"\n",
        cell_top,
        mark_label[gc_prev_gen], gc_prev_cnt,
        mark_label[gc_next_gen], gc_next_cnt,
        gc_free_cnt, gc_scan_cnt);
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

static int_t gc_mark_cell(int_t addr) {  // mark cell in-use
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

static int_t gc_free_cell(int_t addr) {  // mark cell free
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
            gc_mark_cell(e_queue_head);
            gc_mark_cell(k_queue_head);
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
#define GC_RESERVED (I32(1 << GC_LO_BITS(START)) - 1)

i32 gc_bits[GC_MAX_BITS] = { GC_RESERVED };  // in-use mark bits

i32 gc_clear() {  // clear all GC bits (except RESERVED)
    i32 cnt = gc_free_cnt;
    cell_next = NIL;  // empty the free-list
    gc_free_cnt = 0;
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
        if (c != '.') {
            int_t t = get_t(a);
            if (t == Literal_T) c = 'l';// literal value
            if (t == Type_T) c = 't';   // type marker
            if (t == Event_T) c = 'E';  // Event_T
            if (t == Opcode_T) c = 'i';  // Opcode_T
            if (t == Actor_T) c = 'A';  // Actor_T
            if (t == Fixnum_T) c = '#';   // Fixnum_T <-- should not happen
            if (t == Symbol_T) c = 'S'; // Symbol_T
            if (t == Pair_T) c = 'p';   // Pair_T
            if (t == Fexpr_T) c = 'F';  // Fexpr_T
            if (t == Free_T) c = '?';   // Free_T <-- should not happen
            if (t >= START) c = 'K';    // continuation
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
        cnt += gc_mark_cells(get_z(val));   // recurse on z
        val = get_y(val);                   // iterate over y
    }
    return cnt;
}

i32 gc_mark_roots(int_t dump) {  // mark cells reachable from the root-set
    i32 cnt = START-1;
    for (int i = 0; i < 256; ++i) {
        if (sym_intern[i]) {
            cnt += gc_mark_cells(sym_intern[i]);
        }
    }
    cnt += gc_mark_cells(e_queue_head);
    cnt += gc_mark_cells(k_queue_head);
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
    if ((cell_top > (CELL_MAX - 256)) && (gc_free_cnt < 64)) {
        gc_mark_and_sweep(FALSE);  // no gc output
        //gc_mark_and_sweep(UNDEF);  // one-line gc summary
        if (gc_free_cnt < 128) {  // low-memory warning!
            gc_mark_and_sweep(UNDEF);  // one-line gc summary
        }
    }
    return gc_free_cnt;
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
#if META_ACTORS
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
    bind_global("+", _F_NUM_ADD);
    bind_global("-", _F_NUM_SUB);
    bind_global("*", _F_NUM_MUL);
    bind_global("list->number", _F_LST_NUM);
    bind_global("list->symbol", _F_LST_SYM);
    bind_global("print", _F_PRINT);

#if (SCM_PEG_TOOLS || SCM_ASM_TOOLS)
    bind_global("CTL", TO_FIX(CTL));
    bind_global("DGT", TO_FIX(DGT));
    bind_global("UPR", TO_FIX(UPR));
    bind_global("LWR", TO_FIX(LWR));
    bind_global("DLM", TO_FIX(DLM));
    bind_global("SYM", TO_FIX(SYM));
    bind_global("HEX", TO_FIX(HEX));
    bind_global("WSP", TO_FIX(WSP));
#endif

#if SCM_PEG_TOOLS
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
#endif // SCM_PEG_TOOLS

#if SCM_ASM_TOOLS
    bind_global("UNDEF", UNDEF);
    bind_global("NIL", NIL);
    bind_global("FALSE", FALSE);
    bind_global("TRUE", TRUE);
    bind_global("UNIT", UNIT);

    bind_global("Literal_T", Literal_T);
    bind_global("Type_T", Type_T);
    bind_global("Event_T", Event_T);
    bind_global("Opcode_T", Opcode_T);
    bind_global("Actor_T", Actor_T);
    bind_global("Fixnum_T", Fixnum_T);
    bind_global("Symbol_T", Symbol_T);
    bind_global("Pair_T", Pair_T);
    bind_global("Fexpr_T", Fexpr_T);
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
    bind_global("VM_self", VM_self);
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
#endif //SCM_ASM_TOOLS

#if META_ACTORS
    bind_global("BEH", FX_M_BEH);
    bind_global("CREATE", _F_CREATE);
    bind_global("SEND", _F_SEND);
    bind_global("CALL", _F_CALL);
#endif // META_ACTORS

    bind_global("a-print", _A_PRINT);
    bind_global("quit", _A_QUIT);
    return UNIT;
}

/*
 * actor event-queue
 */

int_t e_queue_head = START;
int_t e_queue_tail = START;
#if RUNTIME_STATS
static long event_count = 0;
#endif

#define event_q_empty() (!IS_EVENT(e_queue_head))

int_t event_q_put(int_t event) {
    XTRACE(debug_print("event_q_put", event));
    ASSERT(IS_EVENT(event));
    ASSERT(IS_ACTOR(get_x(event)));
    set_z(event, NIL);
    if (event_q_empty()) {
        e_queue_head = event;
    } else {
        set_z(e_queue_tail, event);
    }
    e_queue_tail = event;
    return event;
}

int_t event_q_pop() {
    if (event_q_empty()) return UNDEF; // event queue empty
    int_t event = e_queue_head;
    XTRACE(debug_print("event_q_pop", event));
    ASSERT(IS_EVENT(event));
    ASSERT(IS_ACTOR(get_x(event)));
    e_queue_head = get_z(event);
    set_z(event, NIL);
    if (event_q_empty()) {
        e_queue_tail = NIL;  // empty queue
    }
#if RUNTIME_STATS
    ++event_count;
#endif
    return event;
}

#if INCLUDE_DEBUG
static int_t event_q_dump() {
    debug_print("e_queue_head", e_queue_head);
    int_t ep = e_queue_head;
    sane = SANITY;
    while (IS_EVENT(ep)) {
        fprintf(stderr, "-> %"PdI"{act=%"PdI",msg=%"PdI"}%s",
            ep, get_x(ep), get_y(ep), ((get_z(ep)==NIL)?"\n":""));
        ep = get_z(ep);
        if (sane-- == 0) return panic("insane event_q_dump");
    }
    return UNIT;
}
#endif

/*
 * VM continuation-queue
 */

int_t k_queue_head = NIL;
int_t k_queue_tail = NIL;
#if RUNTIME_STATS
static long instruction_count = 0;
#endif

#define cont_q_empty() (!IN_HEAP(k_queue_head))

int_t cont_q_put(int_t cont) {
    //XTRACE(debug_print("cont_q_put", cont));
    ASSERT(IN_HEAP(cont));
    //XTRACE(debug_print("cont_q_put code", get_t(cont)));
    ASSERT(IS_CODE(get_t(cont)));
    set_z(cont, NIL);
    if (cont_q_empty()) {
        k_queue_head = cont;
    } else {
        set_z(k_queue_tail, cont);
    }
    k_queue_tail = cont;
    return cont;
}

int_t cont_q_pop() {
    if (cont_q_empty()) return UNDEF; // cont queue empty
    int_t cont = k_queue_head;
    //XTRACE(debug_print("cont_q_pop", cont));
    ASSERT(IN_HEAP(cont));
    k_queue_head = get_z(cont);
    set_z(cont, NIL);
    if (cont_q_empty()) {
        k_queue_tail = NIL;  // empty queue
    }
#if RUNTIME_STATS
    ++instruction_count;
#endif
    return cont;
}

#if INCLUDE_DEBUG
static int_t cont_q_dump() {
    debug_print("k_queue_head", k_queue_head);
    int_t kp = k_queue_head;
    sane = SANITY;
    while (IN_HEAP(kp)) {
        fprintf(stderr, "-> %"PdI"{ip=%"PdI",sp=%"PdI",ep=%"PdI"}%s",
            kp, get_t(kp), get_x(kp), get_y(kp), ((get_z(kp)==NIL)?"\n":""));
        kp = get_z(kp);
        if (sane-- == 0) return panic("insane cont_q_dump");
    }
    return UNIT;
}
#endif

/*
 * runtime (virtual machine engine)
 */

#if RUN_DEBUGGER
int_t runtime_trace = TRUE;
#else
int_t runtime_trace = FALSE;
#endif

#define GET_IP() get_t(k_queue_head)
#define GET_SP() get_x(k_queue_head)
#define GET_EP() get_y(k_queue_head)

#define SET_IP(v) set_t(k_queue_head,(v))
#define SET_SP(v) set_x(k_queue_head,(v))
#define SET_EP(v) set_y(k_queue_head,(v))

int_t stack_push(int_t value) {
    XTRACE(debug_print("stack push", value));
    int_t sp = GET_SP();
    sp = cons(value, sp);
    SET_SP(sp);
    return value;
}

int_t stack_pop() {
    int_t item = UNDEF;
    int_t sp = GET_SP();
    if (IS_PAIR(sp)) {
        item = car(sp);
        int_t rest = cdr(sp);
        SET_SP(rest);
        sp = XFREE(sp);
    } else {
        item = warning("stack underflow");
    }
    XTRACE(debug_print("stack pop", item));
    return item;
}

int_t stack_clear() {
    int_t ep = GET_EP();
    int_t me = get_x(ep);
    //XTRACE(debug_print("stack_clear me", me));
    ASSERT(IS_ACTOR(me));
    me = TO_REF(me);
    int_t stop = get_y(me);  // stop at new stack top
    //XTRACE(debug_print("stack_clear stop", stop));
    int_t sp = GET_SP();
    sane = SANITY;
    while ((sp != stop) && IS_PAIR(sp)) {
        int_t rest = cdr(sp);
        //XTRACE(debug_print("stack_clear free", sp));
        XFREE(sp);
        sp = rest;
        if (sane-- == 0) return panic("insane stack_clear");
    }
    return SET_SP(NIL);
}

typedef long clk_t;  // **MUST** be a _signed_ type to represent past/future
#define CLKS_PER_SEC ((clk_t)(CLOCKS_PER_SEC))
static clk_t clk_ticks() {
    return (clk_t)clock();
}
int_t clk_handler = _A_CLOCK;
clk_t clk_timeout = 0;
static int_t interrupt() {  // service interrupts (if any)
    clk_t now = clk_ticks();
    clk_t dt = (now - clk_timeout);
    XTRACE(fprintf(stderr, "clock (%ld - %ld) = %ld\n", (long)now, (long)clk_timeout, (long)dt));
    if (dt < 0) {
        return FALSE;
    }
    sane = SANITY;
    while (dt > 0) {
        XTRACE(fprintf(stderr, "clock (%ld - %ld) = %ld <%d>\n",
            (long)now, (long)clk_timeout, (long)dt, (dt > 0)));
        clk_timeout += CLKS_PER_SEC;
        dt = (now - clk_timeout);
        if (sane-- == 0) return panic("insane clk_timeout");
    }
    int_t sec = TO_FIX(now / CLKS_PER_SEC);
    if (IS_ACTOR(clk_handler)) {
        int_t ev = cell_new(Event_T, clk_handler, sec, NIL);
        DEBUG(debug_print("clock event", ev));
        event_q_put(ev);
    }
    return TRUE;
}
static int_t dispatch() {  // dispatch next event (if any)
#if CONCURRENT_GC
    gc_increment();  // perform an increment of concurrent GC
#endif
    XTRACE(event_q_dump());
    if (event_q_empty()) {
        return UNDEF;  // event queue empty
    }
    int_t event = event_q_pop();
    //XTRACE(debug_print("dispatch event", event));
    ASSERT(IS_EVENT(event));
    int_t target = get_x(event);
    XTRACE(debug_print("dispatch target", target));
    ASSERT(IS_ACTOR(target));
    target = TO_REF(target);
    if (get_z(target) != UNDEF) {  // target actor busy
#if INCLUDE_DEBUG
        if (runtime_trace != FALSE) {
            DEBUG(debug_print("dispatch busy", event));
        }
#endif
        event_q_put(event);  // re-queue event
        return FALSE;  // try busy actor later...
    }
    int_t ip = get_x(target);  // actor behavior (initial IP)
    //XTRACE(debug_print("dispatch ip", ip));
    ASSERT(IS_CODE(ip));
    int_t sp = get_y(target);  // actor state (initial SP)
    //XTRACE(debug_print("dispatch sp", sp));
    ASSERT((sp == NIL) || IS_PAIR(sp));
    // begin actor transaction
    set_z(target, NIL);  // start with empty set of new events
    // spawn new "thread" (continuation) to handle event
    int_t cont = cell_new(ip, sp, event, NIL);
    cont_q_put(cont);  // enqueue new continuation
#if INCLUDE_DEBUG
    if (runtime_trace != FALSE) {
        fprintf(stderr, "thread spawn: %"PdI"{ip=%"PdI",sp=%"PdI",ep=%"PdI"}\n",
            cont, get_t(cont), get_x(cont), get_y(cont));
    }
#endif
    return cont;
}
static int_t execute() {  // execute next VM instruction
    XTRACE(cont_q_dump());
    if (cont_q_empty()) {
        return error("no live threads");  // no more instructions to execute...
    }
    // execute next continuation
    XTRACE(debug_print("execute cont", k_queue_head));
    int_t ip = GET_IP();
    XTRACE(debug_print("execute inst", ip));
    //ASSERT(IS_CELL(ip));
    ASSERT(IS_CODE(ip));
#if INCLUDE_DEBUG
    if (debugger() == FALSE) {
        return FALSE;  // debugger quit
    }
#endif
    int_t event = GET_EP();
    int_t opcode = get_x(ip);
    nat_t ofs = NAT(TO_INT(opcode));
    if (ofs < PROC_MAX) {
        ip = (proc_table[ofs])(ip, event);
    } else {
        ip = error("opcode expected");
    }
    SET_IP(ip);  // update IP
    int_t cont = cont_q_pop();
    XTRACE(debug_print("execute done", cont));
    if (IS_CODE(ip)) {
        cont_q_put(cont);  // enqueue continuation
    } else {
        // if "thread" is dead, free cont and event
        event = XFREE(event);
        cont = XFREE(cont);
#if MARK_SWEEP_GC
        gc_safepoint();
#endif
    }
    return UNIT;
}
int_t runtime() {
    int_t rv = UNIT;
    while (rv == UNIT) {
        rv = interrupt();
        rv = dispatch();
        rv = execute();
    }
    return rv;
}

/*
 * native procedures
 */

PROC_DECL(vm_illegal) {
    return error("Illegal instruction!");
}

#define GET_IMMD() get_y(self)
#define GET_CONT() get_z(self)

PROC_DECL(vm_typeq) {
    int_t t = GET_IMMD();
    int_t v = stack_pop();
    if (t == Fixnum_T) {
        v = (IS_FIX(v) ? TRUE : FALSE);
    } else if (t == Actor_T) {
        v = (IS_ACTOR(v) ? TRUE : FALSE);
    } else if (IS_CELL(v)) {
        v = ((t == get_t(v)) ? TRUE : FALSE);
    } else {
        v = FALSE;  // _v_ out of range
    }
    stack_push(v);
    return GET_CONT();
}

PROC_DECL(vm_cell) {
    int_t n = TO_INT(GET_IMMD());
    int_t z = UNDEF;
    int_t y = UNDEF;
    int_t x = UNDEF;
    ASSERT(NAT(n) <= 4);
    if (n > 3) { z = stack_pop(); }
    if (n > 2) { y = stack_pop(); }
    if (n > 1) { x = stack_pop(); }
    int_t t = stack_pop();
    int_t v = cell_new(t, x, y, z);
    if (t == Actor_T) {
        // v = TO_CAP(v);
        return error("use vm_new to create Actors");
    }
    stack_push(v);
    return GET_CONT();
}

PROC_DECL(vm_get) {
    int_t f = GET_IMMD();
    int_t cell = stack_pop();
    int_t v = UNDEF;
    if (IS_CELL(cell)) {
        switch (f) {
            case FLD_T:     v = get_t(cell);    break;
            case FLD_X:     v = get_x(cell);    break;
            case FLD_Y:     v = get_y(cell);    break;
            case FLD_Z:     v = get_z(cell);    break;
            default:        return error("unknown field");
        }
    } else {
        v = warning("vm_get requires a cell");
    }
    stack_push(v);
    return GET_CONT();
}

PROC_DECL(vm_set) {
    int_t f = GET_IMMD();
    int_t v = stack_pop();
    int_t sp = GET_SP();
    int_t cell = car(sp);
    if ((f == FLD_T) && (v == Actor_T)) {
        return error("use vm_new to create Actors");
    }
    if (IS_CELL(cell)) {
        switch (f) {
            case FLD_T:     set_t(cell, v);     break;
            case FLD_X:     set_x(cell, v);     break;
            case FLD_Y:     set_y(cell, v);     break;
            case FLD_Z:     set_z(cell, v);     break;
            default:        return error("unknown field");
        }
    } else {
        return error("vm_set requires a cell");
    }
    return GET_CONT();
}

static int_t pop_pairs(int_t n) {
    int_t c;
    if (n > 0) {
        int_t h = stack_pop();
        int_t t = pop_pairs(n - 1);
        c = cons(h, t);
    } else {
        c = stack_pop();
    }
    return c;
}
PROC_DECL(vm_pair) {
    int_t n = TO_INT(GET_IMMD());
    int_t c = pop_pairs(n);
    stack_push(c);
    return GET_CONT();
}

static void push_parts(int_t n, int_t xs) {
    if (n > 0) {
        push_parts((n - 1), cdr(xs));
        int_t x = car(xs);
        stack_push(x);
    } else {
        stack_push(xs);
    }
}
PROC_DECL(vm_part) {
    int_t n = TO_INT(GET_IMMD());
    int_t c = stack_pop();
    push_parts(n, c);
    return GET_CONT();
}

static int_t extract_nth(int_t m, int_t n) {
    int_t v = UNDEF;
    if (n == 0) {  // entire list/message
        v = m;
    } else if (n > 0) {  // item at n-th index
        sane = SANITY;
        while (IS_PAIR(m)) {
            if (--n == 0) break;
            m = cdr(m);
            if (sane-- == 0) return panic("insane extract_nth");
        }
        if (n == 0) {
            v = car(m);
        }
    } else {  // use -n to select the n-th tail
        sane = SANITY;
        while (IS_PAIR(m)) {
            if (++n == 0) break;
            m = cdr(m);
            if (sane-- == 0) return panic("insane extract_nth");
        }
        if (n == 0) {
            v = cdr(m);
        }
    }
    return v;
}
PROC_DECL(vm_nth) {
    int_t n = TO_INT(GET_IMMD());
    int_t m = stack_pop();
    stack_push(extract_nth(m, n));
    return GET_CONT();
}

PROC_DECL(vm_push) {
    int_t v = GET_IMMD();
    stack_push(v);
    return GET_CONT();
}

PROC_DECL(vm_depth) {
    int_t n = 0;
    int_t sp = GET_SP();
    sane = SANITY;
    while (IS_PAIR(sp)) {  // count items on stack
        ++n;
        sp = cdr(sp);
        if (sane-- == 0) return panic("insane vm_depth");
    }
    stack_push(TO_FIX(n));
    return GET_CONT();
}

PROC_DECL(vm_drop) {
    int_t n = TO_INT(GET_IMMD());
    sane = SANITY;
    while (n-- > 0) {  // drop n items from stack
        stack_pop();
        if (sane-- == 0) return panic("insane vm_drop");
    }
    return GET_CONT();
}

PROC_DECL(vm_pick) {
    int_t n = TO_INT(GET_IMMD());
    int_t v = UNDEF;
    int_t sp = GET_SP();
    sane = SANITY;
    while (n-- > 0) {  // copy n-th item to top of stack
        v = car(sp);
        sp = cdr(sp);
        if (sane-- == 0) return panic("insane vm_pick");
    }
    stack_push(v);
    return GET_CONT();
}

PROC_DECL(vm_dup) {
    int_t n = TO_INT(GET_IMMD());
    int_t dup = NIL;
    int_t sp = GET_SP();
    sane = SANITY;
    while (n-- > 0) {  // copy n items from stack
        dup = cons(car(sp), dup);
        sp = cdr(sp);
        if (sane-- == 0) return panic("insane vm_dup");
    }
    SET_SP(append_reverse(dup, GET_SP()));
    return GET_CONT();
}

PROC_DECL(vm_roll) {
    int_t n = TO_INT(GET_IMMD());
    int_t sp = GET_SP();
    int_t pp = sp;
    sane = SANITY;
    if (n < 0) {  // roll top of stack to n-th item
        while (++n < 0) {
            sp = cdr(sp);
            if (sane-- == 0) return panic("insane vm_roll");
        }
        if (sp == NIL) {  // stack underflow
            stack_pop();
        } else if (sp != pp) {
            SET_SP(cdr(pp));
            set_cdr(pp, cdr(sp));
            set_cdr(sp, pp);
        }
    } else {
        while (--n > 0) {  // roll n-th item to top of stack
            pp = sp;
            sp = cdr(sp);
            if (sane-- == 0) return panic("insane vm_roll");
        }
        if (sp == NIL) {  // stack underflow
            stack_push(NIL);
        } else if (sp != pp) {
            set_cdr(pp, cdr(sp));
            set_cdr(sp, GET_SP());
            SET_SP(sp);
        }
    }
    return GET_CONT();
}

PROC_DECL(vm_alu) {
    int_t op = GET_IMMD();
    if (op == ALU_NOT) {  // special case for unary NOT
        int_t n = stack_pop();
        if (!IS_FIX(n)) return error("vm_alu requires Fixnum args");
        n = TO_INT(n);
        stack_push(TO_FIX(~n));
    } else {
        int_t m = stack_pop();
        if (!IS_FIX(m)) return error("vm_alu requires Fixnum args");
        m = TO_INT(m);
        int_t n = stack_pop();
        if (!IS_FIX(n)) return error("vm_alu requires Fixnum args");
        n = TO_INT(n);
        switch (op) {
            case ALU_AND:   stack_push(TO_FIX(n & m));  break;
            case ALU_OR:    stack_push(TO_FIX(n | m));  break;
            case ALU_XOR:   stack_push(TO_FIX(n ^ m));  break;
            case ALU_ADD:   stack_push(TO_FIX(n + m));  break;
            case ALU_SUB:   stack_push(TO_FIX(n - m));  break;
            case ALU_MUL:   stack_push(TO_FIX(n * m));  break;
            default:        return error("unknown operation");
        }
    }
    return GET_CONT();
}

PROC_DECL(vm_eq) {
    int_t n = GET_IMMD();
    int_t m = stack_pop();
    stack_push((n == m) ? TRUE : FALSE);
    return GET_CONT();
}

PROC_DECL(vm_cmp) {
    int_t rel = GET_IMMD();
    if (rel == CMP_EQ) {                // EQ works on *any* value
        int_t m = stack_pop();
        int_t n = stack_pop();
        stack_push((n == m) ? TRUE : FALSE);
    } else if (rel == CMP_NE) {         // NE works on *any* value
        int_t m = stack_pop();
        int_t n = stack_pop();
        stack_push((n != m) ? TRUE : FALSE);
    } else {                            // all other relations require numbers
        int_t m = stack_pop();
        if (!IS_FIX(m)) return error("vm_cmp relation requires Fixnum args");
        m = TO_INT(m);
        int_t n = stack_pop();
        if (!IS_FIX(n)) return error("vm_cmp relation requires Fixnum args");
        n = TO_INT(n);
        switch (rel) {
            case CMP_GE:    stack_push((n >= m) ? TRUE : FALSE);    break;
            case CMP_GT:    stack_push((n > m)  ? TRUE : FALSE);    break;
            case CMP_LT:    stack_push((n < m)  ? TRUE : FALSE);    break;
            case CMP_LE:    stack_push((n <= m) ? TRUE : FALSE);    break;
            case CMP_CLS: {  // character in class
                if (char_in_class(n, m)) {
                    stack_push(TRUE);
                } else {
                    stack_push(FALSE);
                }
                break;
            }
            default:        return error("unknown relation");
        }
    }
    return GET_CONT();
}

PROC_DECL(vm_if) {
    int_t b = stack_pop();
    //if (b == UNDEF) return error("undefined condition");
    int_t t = GET_IMMD();
    ASSERT(IS_CODE(t));
    int_t f = GET_CONT();
    ASSERT(IS_CODE(f));
    return ((b != FALSE) ? t : f);
}

PROC_DECL(vm_msg) {
    int_t n = TO_INT(GET_IMMD());
    int_t ep = GET_EP();
    int_t m = get_y(ep);
    stack_push(extract_nth(m, n));
    return GET_CONT();
}

PROC_DECL(vm_self) {
    int_t ep = GET_EP();
    int_t me = get_x(ep);
    ASSERT(IS_ACTOR(me));
    stack_push(me);
    return GET_CONT();
}

static int_t pop_list(int_t n) {
    // FIXME: repurpose cells from the stack instead of allocating new ones...
    int_t c;
    if (n > 0) {
        int_t h = stack_pop();
        int_t t = pop_list(n - 1);
        c = cons(h, t);
    } else {
        c = NIL;
    }
    return c;
}
PROC_DECL(vm_send) {
    //XTRACE(debug_print("vm_send self", self));
    int_t n = TO_INT(GET_IMMD());
    int_t ep = GET_EP();
    int_t me = get_x(ep);
    //XTRACE(debug_print("vm_send me", me));
    ASSERT(IS_ACTOR(me));
    me = TO_REF(me);
    int_t a = stack_pop();  // target
    //XTRACE(debug_print("vm_send target", a));
    if (!IS_ACTOR(a)) {
        set_y(me, UNDEF);  // abort actor transaction
        return warning("vm_send requires an Actor");
    }
    int_t m = NIL;
    if (n == 0) {
        m = stack_pop();  // message
    } else if (n > 0) {
        m = pop_list(n);  // compose message
    } else {
        return error("vm_send (n < 0) invalid");
    }
    int_t ev = cell_new(Event_T, a, m, get_z(me));
    set_z(me, ev);
    //XTRACE(debug_print("vm_send event", ev));
    return GET_CONT();
}

PROC_DECL(vm_new) {
    int_t n = TO_INT(GET_IMMD());
    if (n < 0) return error("vm_new (n < 0) invalid");
    int_t ip = stack_pop();  // behavior
    ASSERT(IS_CODE(ip));
#if 0
    while (n--) {
        // compose behavior
        int_t v = stack_pop();  // value
        ip = cell_new(Opcode_T, VM_push, v, ip);
    }
    int_t a = cell_new(Actor_T, ip, NIL, UNDEF);
#else
    int_t sp = NIL;  // initial stack state for new actor
    if (n > 0) {
        sp = GET_SP();
        int_t np = sp;
        while (--n && IS_PAIR(np)) {
            np = cdr(np);
        }
        if (IS_PAIR(np)) {
            SET_SP(cdr(np));
            set_cdr(np, NIL);
        } else {
            SET_SP(NIL);
        }
    }
    int_t a = cell_new(Actor_T, ip, sp, UNDEF);
#endif
    if (IN_HEAP(a)) {
        a = TO_CAP(a);
    }
    stack_push(a);
    return GET_CONT();
}

PROC_DECL(vm_beh) {
    int_t n = TO_INT(GET_IMMD());
    if (n < 0) return error("vm_beh (n < 0) invalid");
    int_t ep = GET_EP();
    int_t me = get_x(ep);
    //XTRACE(debug_print("vm_beh me", me));
    ASSERT(IS_ACTOR(me));
    me = TO_REF(me);
    int_t ip = stack_pop();  // behavior
    ASSERT(IS_CODE(ip));
    set_x(me, ip);
    if (n > 0) {
        int_t sp = GET_SP();
        set_y(me, sp);
        while (--n && IS_PAIR(sp)) {
            sp = cdr(sp);
        }
        if (IS_PAIR(sp)) {
            SET_SP(cdr(sp));
            set_cdr(sp, NIL);
        } else {
            SET_SP(NIL);
        }
    } else {
        set_y(me, NIL);
    }
    //XTRACE(debug_print("vm_beh me'", me));
    return GET_CONT();
}

PROC_DECL(vm_end) {
    int_t n = GET_IMMD();
    int_t m = TO_INT(n);
    int_t ep = GET_EP();
    int_t me = get_x(ep);
    //XTRACE(debug_print("vm_end me", me));
    ASSERT(IS_ACTOR(me));
    me = TO_REF(me);
    int_t rv = UNIT;  // STOP
    if (m < 0) {  // ABORT
        int_t r = stack_pop();  // reason
        DEBUG(debug_print("ABORT!", r));
        stack_clear();
        set_z(me, UNDEF);  // abort actor transaction
        rv = FALSE;
    } else if (m > 0) {  // COMMIT
        if (n == END_RELEASE) {
            set_y(me, NIL);
        }
        stack_clear();
        int_t e = get_z(me);
        sane = SANITY;
        while (IS_EVENT(e)) {
            int_t es = get_z(e);
            event_q_put(e);
            e = es;
            if (sane-- == 0) return panic("insane COMMIT");
        }
        if (n == END_RELEASE) {
            me = XFREE(me);
        } else {
            set_z(me, UNDEF);  // commit actor transaction
        }
        rv = TRUE;
    }
    return rv;  // terminate thread
}

PROC_DECL(vm_cvt) {
    int_t c = GET_IMMD();
    int_t w = stack_pop();
    int_t v = UNDEF;
    switch (c) {
        case CVT_LST_NUM:   v = fixnum(w);      break;
        case CVT_LST_SYM:   v = symbol(w);      break;
        default:            v = error("unknown conversion");
    }
    stack_push(v);
    return GET_CONT();
}

PROC_DECL(vm_putc) {
    int_t c = stack_pop();
    console_putc(c);
    return GET_CONT();
}

PROC_DECL(vm_getc) {
    int_t c = console_getc();
    stack_push(c);
    return GET_CONT();
}

PROC_DECL(vm_debug) {
    int_t x = GET_IMMD();
    int_t v = stack_pop();
    //fprintf(stderr, "[%"PdI"] ", x);
    print_word("[", x);
    fprintf(stderr, "] ");
#if 1
    print_sexpr(v);
    fprintf(stderr, "\n");
#else
#if INCLUDE_DEBUG
    //debug_print("", v);
    print_list(v);
#else
    fprintf(stderr, "%"PdI"\n", v);
#endif
#endif
    return GET_CONT();
}

/*
 * debugging tools
 */

void print_word(char* prefix, int_t word) {
    if (IS_FIX(word)) {
        fprintf(stderr, "%s%+"PdI"", prefix, TO_INT(word));
    } else if (IS_CAP(word)) {
        fprintf(stderr, "%s@%"PdI"", prefix, TO_REF(word));
    } else if (NAT(word) < START) {
        fprintf(stderr, "%s%s", prefix, cell_label(word));
    } else {
        fprintf(stderr, "%s^%"PdI"", prefix, word);
    }
}
static void print_type(char *prefix, int_t word) {
    if (word == Literal_T) {
        fprintf(stderr, "%sLiteral_T", prefix);
    } else if (NAT(word) < START) {
        fprintf(stderr, "%s%s", prefix, cell_label(word));
    } else {
        print_word(prefix, word);
    }
}
void print_quad(char* prefix, int_t quad) {
    fprintf(stderr, "%s", prefix);
    if (IS_VAL(quad)) {
        fprintf(stderr, "FIXNUM\n");
    } else {
        quad = TO_REF(quad);
        print_type("{t:", get_t(quad));
        print_word(",x:", get_x(quad));
        print_word(",y:", get_y(quad));
        print_word(",z:", get_z(quad));
        fprintf(stderr, "}\n");
    }
}

void print_sexpr(int_t x) {
    if (IS_FIX(x)) {
        fprintf(stderr, "%+"PdI"", TO_INT(x));
    } else if (NAT(x) < START) {
        fprintf(stderr, "%s", cell_label(x));
    } else if (IS_FREE(x)) {
        fprintf(stderr, "#FREE-CELL!");
    } else if (IS_SYM(x)) {
        print_symbol(x);
    } else if (IS_PAIR(x)) {
        char *s = "(";
        sane = SANITY;
        while (IS_PAIR(x)) {
            fprintf(stderr, "%s", s);
            if (sane-- == 0) {
                fprintf(stderr, "...)");
                return;
            }
            print_sexpr(car(x));
            s = " ";
            x = cdr(x);
        }
        if (x != NIL) {
            fprintf(stderr, " . ");
            print_sexpr(x);
        }
        fprintf(stderr, ")");
    } else if (IS_ACTOR(x)) {
        fprintf(stderr, "#actor@%"PdI"", TO_REF(x));
    } else if (IS_FEXPR(x)) {
        fprintf(stderr, "#fexpr@%"PdI"", x);
    } else if (IS_CODE(x)) {
        fprintf(stderr, "#code@%"PdI"", x);
    } else {
        fprintf(stderr, "^%"PdI"", x);
    }
}

#if INCLUDE_DEBUG

#if USE_INT16_T || (USE_INTPTR_T && (__SIZEOF_POINTER__ == 2))
void hexdump(char *label, int_t *addr, size_t cnt) {
    fprintf(stderr, "%s:", label);
    for (nat_t n = 0; n < cnt; ++n) {
        if ((n & 0x7) == 0x0) {
            fprintf(stderr, "\n%08"PRIxPTR":", (intptr_t)addr);
        }
        if ((n & 0x3) == 0x0) {
            fprintf(stderr, " ");
        }
        fprintf(stderr, " %04"PxI"", NAT(*addr++));
    }
    fprintf(stderr, "\n");
}
#endif
#if USE_INT32_T || (USE_INTPTR_T && (__SIZEOF_POINTER__ == 4))
void hexdump(char *label, int_t *addr, size_t cnt) {
    fprintf(stderr, "%s: %04"PxI"..", label, (NAT(addr) >> 16));
    for (nat_t n = 0; n < cnt; ++n) {
        if ((n & 0x7) == 0x0) {
            fprintf(stderr, "\n..%04"PxI":", (NAT(addr) & 0xFFFF));
        }
        fprintf(stderr, " %08"PxI"", NAT(*addr++) & 0xFFFFFFFF);
    }
    fprintf(stderr, "\n");
}
#endif
#if USE_INT64_T || (USE_INTPTR_T && (__SIZEOF_POINTER__ == 8))
void hexdump(char *label, int_t *addr, size_t cnt) {
    fprintf(stderr, "%s: %08"PxI"..", label, (NAT(addr) >> 32));
    for (nat_t n = 0; n < cnt; ++n) {
        if ((n & 0x3) == 0x0) {
            fprintf(stderr, "\n..%08"PxI":", (NAT(addr) & 0xFFFFFFFF));
        }
        fprintf(stderr, " %016"PxI"", NAT(*addr++));
    }
    fprintf(stderr, "\n");
}
#endif

void print_labelled(char *prefix, int_t addr) {
    print_word(prefix, addr);
    fprintf(stderr, "[$%"PxI"]", addr);
}
void debug_print(char *label, int_t addr) {
    fprintf(stderr, "%s: ", label);
    print_labelled("", addr);
    if (IS_CAP(addr)) {
        addr = TO_REF(addr);
    }
    if (IS_CELL(addr)) {
        fprintf(stderr, " =");
        print_labelled(" {t:", get_t(addr));
        print_labelled(", x:", get_x(addr));
        print_labelled(", y:", get_y(addr));
        print_labelled(", z:", get_z(addr));
        fprintf(stderr, "}");
    }
    fprintf(stderr, "\n");
}

void print_event(int_t ep) {
    print_word("(", get_x(ep));  // target actor
    int_t msg = get_y(ep);  // actor message
    sane = SANITY;
    while (IS_PAIR(msg)) {
        print_word(" ", car(msg));
        msg = cdr(msg);
        if (sane-- == 0) panic("insane print_event");
    }
    if (msg != NIL) {
        print_word(" . ", msg);
    }
    fprintf(stderr, ") ");
}
static void print_stack(int_t sp) {
    if (IS_PAIR(sp)) {
        print_stack(cdr(sp));
        int_t item = car(sp);
        //fprintf(stderr, " %s[%"PdI"]", cell_label(item), item);
        print_word(" ", item);
    }
}
static char *field_label(int_t f) {
    switch (f) {
        case FLD_T:     return "T";
        case FLD_X:     return "X";
        case FLD_Y:     return "Y";
        case FLD_Z:     return "Z";
    }
    return "<unknown>";
}
static char *operation_label(int_t op) {
    switch (op) {
        case ALU_NOT:   return "NOT";
        case ALU_AND:   return "AND";
        case ALU_OR:    return "OR";
        case ALU_XOR:   return "XOR";
        case ALU_ADD:   return "ADD";
        case ALU_SUB:   return "SUB";
        case ALU_MUL:   return "MUL";
    }
    return "<unknown>";
}
static char *relation_label(int_t r) {
    switch (r) {
        case CMP_EQ:    return "EQ";
        case CMP_GE:    return "GE";
        case CMP_GT:    return "GT";
        case CMP_LT:    return "LT";
        case CMP_LE:    return "LE";
        case CMP_NE:    return "NE";
        case CMP_CLS:   return "CLS";
    }
    return "<unknown>";
}
static char *end_label(int_t t) {
    switch (t) {
        case END_ABORT:     return "ABORT";
        case END_STOP:      return "STOP";
        case END_COMMIT:    return "COMMIT";
        case END_RELEASE:   return "RELEASE";
    }
    return "<unknown>";
}
static char *conversion_label(int_t f) {
    switch (f) {
        case CVT_LST_NUM:   return "LST_NUM";
        case CVT_LST_SYM:   return "LST_SYM";
    }
    return "<unknown>";
}
void print_inst(int_t ip) {
    if (!IS_CODE(ip)) {
        print_quad("", ip);
        return;
    }
    int_t op = get_x(ip);
    int_t immd = get_y(ip);
    int_t cont = get_z(ip);
    fprintf(stderr, "%s", proc_label(op));
    switch (op) {
        case VM_typeq:print_type("{t:", immd); fprintf(stderr, ",k:%"PdI"}", cont); break;
        case VM_cell: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_get:  fprintf(stderr, "{f:%s,k:%"PdI"}", field_label(immd), cont); break;
        case VM_set:  fprintf(stderr, "{f:%s,k:%"PdI"}", field_label(immd), cont); break;
        case VM_pair: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_part: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_nth:  fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_push: print_word("{v:", immd); fprintf(stderr, ",k:%"PdI"}", cont); break;
        case VM_depth:fprintf(stderr, "{k:%"PdI"}", cont); break;
        case VM_drop: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_pick: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_dup:  fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_roll: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_alu:  fprintf(stderr, "{op:%s,k:%"PdI"}", operation_label(immd), cont); break;
        case VM_eq:   print_word("{v:", immd); fprintf(stderr, ",k:%"PdI"}", cont); break;
        case VM_cmp:  fprintf(stderr, "{r:%s,k:%"PdI"}", relation_label(immd), cont); break;
        case VM_if:   fprintf(stderr, "{t:%"PdI",f:%"PdI"}", immd, cont); break;
        case VM_msg:  fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_self: fprintf(stderr, "{k:%"PdI"}", cont); break;
        case VM_send: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_new:  fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_beh:  fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_end:  fprintf(stderr, "{t:%s}", end_label(immd)); break;
        case VM_cvt:  fprintf(stderr, "{c:%s}", conversion_label(immd)); break;
        case VM_putc: fprintf(stderr, "{k:%"PdI"}", cont); break;
        case VM_getc: fprintf(stderr, "{k:%"PdI"}", cont); break;
        case VM_debug:print_word("{l:", immd); fprintf(stderr, ",k:%"PdI"}", cont); break;
        default:      fprintf(stderr, "{ILLEGAL op:%"PdI"}", op); break;
    }
    fprintf(stderr, "\n");
}
void print_list(int_t xs) {
    print_word("  ", xs);  // non-list value
    if (!IS_PAIR(xs)) {
        print_quad(" = ", xs);
        return;
    }
    print_word(" = (", car(xs));
    xs = cdr(xs);
    int limit = 8;
    while (IS_PAIR(xs)) {
        print_word(" ", car(xs));
        xs = cdr(xs);
        if (limit-- == 0) {
            fprintf(stderr, " ...)\n");
            return;
        }
    }
    if (xs != NIL) {
        print_word(" . ", xs);
    }
    fprintf(stderr, ")\n");
}
void continuation_trace() {
    print_event(GET_EP());
    fprintf(stderr, "%"PdI":", GET_IP());
    print_stack(GET_SP());
    fprintf(stderr, " ");
    print_inst(GET_IP());
}
static void print_fixed(int width, int_t value) {
    if (IS_FIX(value)) {
        fprintf(stderr, "%+*"PdI"", width, TO_INT(value));
    } else if (IS_CAP(value)) {
        fprintf(stderr, "%*"PdI"*", (width - 1), TO_REF(value));
    } else {
        fprintf(stderr, "%*"PdI"", width, value);
    }
}
void disassemble(int_t ip, int_t n) {
    sane = CELL_MAX;  // a better upper-bound than SANITY...
    while (n-- > 0) {
        char *label = get_symbol_label(ip);
        if (*label) {
            fprintf(stderr, "%s\n", label);
        }
        print_fixed(6, ip);
        fprintf(stderr, ": ");
        print_fixed(6, get_t(ip));
        fprintf(stderr, " ");
        print_fixed(6, get_x(ip));
        fprintf(stderr, " ");
        print_fixed(6, get_y(ip));
        fprintf(stderr, " ");
        print_fixed(6, get_z(ip));
        fprintf(stderr, "  ");
        print_inst(ip);
        ++ip;
        if (sane-- == 0) panic("insane disassemble");
    }
}

static char *db_cmd_token(char **pp) {
    char *p = *pp;
    while (*p > ' ') {
        ++p;
    }
    if (*p && (*p <= ' ')) {
        *p++ = '\0';
    }
    char *q = *pp;
    *pp = p;
    return q;
}
/*
static int_t db_cmd_eq(char *actual, char *expect) {
    sane = 16;
    while (*expect) {
        if (*expect++ != *actual++) return FALSE;
        if (sane-- == 0) return panic("insane db_cmd_eq");
    }
    return (*actual ? FALSE : TRUE);
}
*/
static int_t db_num_cmd(char *cmd) {
    int_t n = 0;
    nat_t d;
    sane = 16;
    while ((d = NAT(*cmd++ - '0')) < 10) {
        n = (n * 10) + d;
        if (sane-- == 0) return panic("insane db_num_cmd");
    }
    return n;
}
int_t debugger() {
#if RUN_DEBUGGER
    static int_t run = FALSE;   // single-stepping
#else
    static int_t run = TRUE;    // free-running
#endif
    static int_t bp_ip = 0;
    static int_t wp_cell = 0;
    static cell_t wp_data;
    static int_t s_cnt = 0;
    static int_t n_cnt = 0;
    static int_t n_ep = 0;
    static char buf[32];        // command buffer

    int_t skip = ((run != FALSE) ? TRUE : FALSE);
    if ((skip == FALSE) && (s_cnt > 0)) {
        if (--s_cnt) skip = TRUE;
    }
    if ((skip == FALSE) && n_ep) {
        if (n_ep != GET_EP()) {
            skip = TRUE;
        } else if (n_cnt > 0) {
            if (--n_cnt) skip = TRUE;
        }
    }
    if (GET_IP() == bp_ip) {
        skip = FALSE;
    }
    if (wp_cell) {
        if ((get_t(wp_cell) != wp_data.t)
        ||  (get_x(wp_cell) != wp_data.x)
        ||  (get_y(wp_cell) != wp_data.y)
        ||  (get_z(wp_cell) != wp_data.z)) {
            //debug_print("watchpoint", wp_cell);
            print_labelled("watchpoint: ", wp_cell);
            fprintf(stderr, " =");
            print_labelled(" {t:", wp_data.t);
            print_labelled(", x:", wp_data.x);
            print_labelled(", y:", wp_data.y);
            print_labelled(", z:", wp_data.z);
            fprintf(stderr, "}\n");
            //debug_print("changed to", wp_cell);
            debug_print("   updated", wp_cell);
            wp_data = cell_zero[wp_cell];  // update cached value
            skip = FALSE;
        }
    }
    if (skip != FALSE) {
        if (runtime_trace != FALSE) {
            continuation_trace();
        }
        return TRUE;  // continue
    }
    run = FALSE;
    s_cnt = 0;
    n_cnt = 0;
    n_ep = 0;
    while (1) {
        continuation_trace();
        fprintf(stderr, "@ ");  // debugger prompt
        char *p = fgets(buf, sizeof(buf), stdin);
        if (!p) {
            fprintf(stderr, "\n");
            return FALSE;                   // exit
        }
        char *cmd = db_cmd_token(&p);
        if (*cmd == 'q') return FALSE;      // quit
        if (*cmd == 'b') {                  // break(point)
            cmd = db_cmd_token(&p);
            int ip = GET_IP();
            if (*cmd) {
                ip = db_num_cmd(cmd);
            }
            bp_ip = ip;
            if (bp_ip) {
                fprintf(stderr, "break at ip=%"PdI"\n", bp_ip);
            } else {
                fprintf(stderr, "no breakpoint\n");
            }
            continue;
        }
        if (*cmd == 'w') {                  // watch(point)
            cmd = db_cmd_token(&p);
            int wp = wp_cell;
            if (*cmd) {
                wp = db_num_cmd(cmd);
            }
            wp_cell = wp;
            if (wp_cell) {
                wp_data = cell_zero[wp_cell];
                fprintf(stderr, "watch cell=%"PdI"\n", wp_cell);
            } else {
                fprintf(stderr, "no watch cell\n");
            }
            continue;
        }
        if (*cmd == 's') {                  // step
            cmd = db_cmd_token(&p);
            int cnt = db_num_cmd(cmd);
            s_cnt = ((cnt < 1) ? 1 : cnt);
            return TRUE;
        }
        if (*cmd == 'n') {                  // next
            cmd = db_cmd_token(&p);
            int cnt = db_num_cmd(cmd);
            n_cnt = ((cnt < 1) ? 1 : cnt);
            n_ep = GET_EP();
            return TRUE;
        }
        if (*cmd == 'd') {                  // disasm
            cmd = db_cmd_token(&p);
            int cnt = db_num_cmd(cmd);
            cnt = ((cnt < 1) ? 1 : cnt);
            cmd = db_cmd_token(&p);
            int ip = GET_IP();
            if (*cmd) {
                ip = db_num_cmd(cmd);
            }
            disassemble(ip, cnt);
            continue;
        }
        if (*cmd == 'p') {                  // print
            cmd = db_cmd_token(&p);
            int_t addr = db_num_cmd(cmd);
            print_list(addr);
            continue;
        }
        if (*cmd == 't') {                  // trace
            runtime_trace = ((runtime_trace != FALSE) ? FALSE : TRUE);
            fprintf(stderr, "instruction tracing %s\n",
                ((runtime_trace != FALSE) ? "on" : "off"));
            continue;
        }
        if (*cmd == 'i') {
            char *cmd = db_cmd_token(&p);
            if (*cmd == 'r') {              // info regs
                fprintf(stderr, "ip=%"PdI" sp=%"PdI" ep=%"PdI" free=%"PdI"\n",
                    GET_IP(), GET_SP(), GET_EP(), cell_next);
                continue;
            }
            if (*cmd == 't') {              // info threads
                cont_q_dump();
                continue;
            }
            if (*cmd == 'e') {              // info events
                event_q_dump();
                continue;
            }
#if RUNTIME_STATS
            if (*cmd == 's') {              // info statistics
                fprintf(stderr, "events=%ld instructions=%ld gc_cycles=%ld\n",
                    event_count, instruction_count, gc_cycle_count);
                // reset counters
                event_count = 0;
                instruction_count = 0;
                gc_cycle_count = 0;
                continue;
            }
            fprintf(stderr, "info: r[egs] t[hreads] e[vents] s[tats]\n");
#else
            fprintf(stderr, "info: r[egs] t[hreads] e[vents]\n");
#endif
            continue;
        }
        if (*cmd == 'c') {                  // continue
            run = TRUE;
            return TRUE;
        }
        if (*cmd == 'h') {
            char *cmd = db_cmd_token(&p);
            switch (*cmd) {
                case 'h' : fprintf(stderr, "h[elp] <command> -- get help on <command>\n"); continue;
                case 'b' : fprintf(stderr, "b[reak] <inst> -- set breakpoint at <inst> (0=none, default: IP)\n"); continue;
                case 'w' : fprintf(stderr, "w[atch] <addr> -- set watchpoint on <addr> (0=none)\n"); continue;
                case 'c' : fprintf(stderr, "c[ontinue] -- continue running freely\n"); continue;
                case 's' : fprintf(stderr, "s[tep] <n> -- step <n> instructions (default: 1)\n"); continue;
                case 'n' : fprintf(stderr, "n[ext] <n> -- next <n> instructions in thread (default: 1)\n"); continue;
                case 'd' : fprintf(stderr, "d[isasm] <n> <inst> -- disassemble <n> instructions (defaults: 1 IP)\n"); continue;
                case 'p' : fprintf(stderr, "p[rint] <addr> -- print value at <addr>\n"); continue;
                case 't' : fprintf(stderr, "t[race] -- toggle instruction tracing (default: on)\n"); continue;
                case 'i' : fprintf(stderr, "i[nfo] <topic> -- get information on <topic>\n"); continue;
                case 'q' : fprintf(stderr, "q[uit] -- quit runtime\n"); continue;
            }
        }
#if CONCURRENT_GC
        if (*cmd == 'g') {  // undocumented command to display memory map
            gc_dump_map();
            continue;
        }
#endif
#if MARK_SWEEP_GC
        if (*cmd == 'g') {  // undocumented command to perform garbage collection
            gc_mark_and_sweep(TRUE);
            continue;
        }
#endif
        //fprintf(stderr, "h[elp] b[reak] c[ontinue] s[tep] n[ext] d[isasm] p[rint] t[race] i[nfo] q[uit]\n");
        fprintf(stderr, "b[reak] w[atch] c[ontinue] s[tep] n[ext] d[isasm] p[rint] t[race] i[nfo] q[uit]\n");
    }
}
#endif // INCLUDE_DEBUG

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
" (define equal? (lambda (x y) (if (pair? x) (if (equal? (car x) (car y)) (equal? (cdr x) (cdr y)) #f) (eq? x y))))"
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
    DEBUG(fprintf(stderr, "PROC_MAX=%"PuI" CELL_MAX=%"PuI"\n", PROC_MAX, CELL_MAX));
    DEBUG(hexdump("cell memory", ((int_t *)cell_zero), 16*4));
    DEBUG(dump_symbol_table());
    init_global_env();
    gc_add_root(clk_handler);
    clk_timeout = clk_ticks();
    int_t result = runtime();
    DEBUG(debug_print("main result", result));
    DEBUG(test_symbol_intern());
    //DEBUG(hexdump("cell memory", ((int_t *)&cell_table[500]), 16*4));
#if CONCURRENT_GC
    gc_dump_map();
#endif
#if MARK_SWEEP_GC
    gc_mark_and_sweep(TRUE);
#endif // MARK_SWEEP_GC
    DEBUG(fprintf(stderr, "cell_top=%"PuI" gc_free_cnt=%"PRId32"\n", cell_top, gc_free_cnt));
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
