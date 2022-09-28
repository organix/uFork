#ifndef PEG_SCM_BASE
#error PEG_SCM_BASE required.
#endif

//
// PEG tools
//

#define F_G_EQ (PEG_SCM_BASE)
#define _F_G_EQ TO_CAP(F_G_EQ)
    { .t=Actor_T,       .x=F_G_EQ+1,    .y=NIL,         .z=UNDEF        },  // (peg-eq <token>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_EQ+2,    },  // token = arg1
    { .t=Instr_T,       .x=VM_push,     .y=G_EQ_B,      .z=F_G_EQ+3,    },  // G_EQ_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_EQ_B token)

#define F_G_OR (F_G_EQ+4)
#define _F_G_OR TO_CAP(F_G_OR)
    { .t=Actor_T,       .x=F_G_OR+1,    .y=NIL,         .z=UNDEF        },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_OR+2,    },  // first = arg1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=F_G_OR+3,    },  // rest = arg2
    { .t=Instr_T,       .x=VM_push,     .y=G_OR_B,      .z=F_G_OR+4,    },  // G_OR_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // (G_OR_B first rest)

#define F_G_AND (F_G_OR+5)
#define _F_G_AND TO_CAP(F_G_AND)
    { .t=Actor_T,       .x=F_G_AND+1,   .y=NIL,         .z=UNDEF        },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_AND+2,   },  // first = arg1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=F_G_AND+3,   },  // rest = arg2
    { .t=Instr_T,       .x=VM_push,     .y=G_AND_B,     .z=F_G_AND+4,   },  // G_AND_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // (G_AND_B first rest)

#define F_G_NOT (F_G_AND+5)
#define _F_G_NOT TO_CAP(F_G_NOT)
    { .t=Actor_T,       .x=F_G_NOT+1,   .y=NIL,         .z=UNDEF        },  // (peg-not <peg>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_NOT+2,   },  // peg = arg1
    { .t=Instr_T,       .x=VM_push,     .y=G_NOT_B,     .z=F_G_NOT+3,   },  // G_NOT_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_NOT_B peg)

#define F_G_CLS (F_G_NOT+4)
#define _F_G_CLS TO_CAP(F_G_CLS)
    { .t=Actor_T,       .x=F_G_CLS+1,   .y=NIL,         .z=UNDEF        },  // (peg-class . <classes>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=F_G_CLS+2,   },
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_G_CLS+3,   },  // args cust
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX(0),   .z=F_G_CLS+4,   },  // mask = +0
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=F_G_CLS+5,   },  // cust mask args

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_G_CLS+6,   },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_G_CLS+7,   },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_G_CLS+8,   .z=F_G_CLS+12,  },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_G_CLS+9,   },  // tail head
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=F_G_CLS+10,  },  // tail head mask
    { .t=Instr_T,       .x=VM_alu,      .y=ALU_OR,      .z=F_G_CLS+11,  },  // mask |= head
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=F_G_CLS+5,   },  // mask tail

    { .t=Instr_T,       .x=VM_drop,     .y=TO_FIX(1),   .z=F_G_CLS+13,  },  // cust mask
    { .t=Instr_T,       .x=VM_push,     .y=G_CLS_B,     .z=F_G_CLS+14,  },  // G_CLS_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=F_G_CLS+15,  },  // ptrn = (G_CLS_B mask)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // ptrn cust

#define F_G_OPT (F_G_CLS+16)
#define _F_G_OPT TO_CAP(F_G_OPT)
    { .t=Actor_T,       .x=F_G_OPT+1,   .y=NIL,         .z=UNDEF        },  // (peg-opt <peg>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_OPT+2,   },  // peg = arg1
    { .t=Instr_T,       .x=VM_push,     .y=G_OPT_B,     .z=F_G_OPT+3,   },  // G_OPT_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_OPT_B peg)

#define F_G_PLUS (F_G_OPT+4)
#define _F_G_PLUS TO_CAP(F_G_PLUS)
    { .t=Actor_T,       .x=F_G_PLUS+1,  .y=NIL,         .z=UNDEF        },  // (peg-plus <peg>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_PLUS+2,  },  // peg = arg1
    { .t=Instr_T,       .x=VM_push,     .y=G_PLUS_B,    .z=F_G_PLUS+3,  },  // G_PLUS_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_PLUS_B peg)

#define F_G_STAR (F_G_PLUS+4)
#define _F_G_STAR TO_CAP(F_G_STAR)
    { .t=Actor_T,       .x=F_G_STAR+1,  .y=NIL,         .z=UNDEF        },  // (peg-star <peg>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_STAR+2,  },  // peg = arg1
    { .t=Instr_T,       .x=VM_push,     .y=G_STAR_B,    .z=F_G_STAR+3,  },  // G_STAR_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_STAR_B peg)

#define F_G_ALT (F_G_STAR+4)
#define _F_G_ALT TO_CAP(F_G_ALT)
    { .t=Actor_T,       .x=F_G_ALT+1,   .y=NIL,         .z=UNDEF        },  // (peg-alt . <pegs>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_G_ALT+2,   },  // pegs = args
    { .t=Instr_T,       .x=VM_push,     .y=G_ALT_B,     .z=F_G_ALT+3,   },  // G_ALT_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_ALT_B pegs)

#define F_G_SEQ (F_G_ALT+4)
#define _F_G_SEQ TO_CAP(F_G_SEQ)
    { .t=Actor_T,       .x=F_G_SEQ+1,   .y=NIL,         .z=UNDEF        },  // (peg-seq . <pegs>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_G_SEQ+2,   },  // pegs = args
    { .t=Instr_T,       .x=VM_push,     .y=G_SEQ_B,     .z=F_G_SEQ+3,   },  // G_SEQ_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_SEQ_B pegs)

#define FX_G_CALL (F_G_SEQ+4)
#define OP_G_CALL (FX_G_CALL+1)
#define _OP_G_CALL TO_CAP(OP_G_CALL)
    { .t=Fexpr_T,       .x=_OP_G_CALL,  .y=UNDEF,       .z=UNDEF,       },  // (peg-call <name>)

    { .t=Actor_T,       .x=OP_G_CALL+1, .y=NIL,         .z=UNDEF        },  // (cust opnds env)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_G_CALL+2, },  // opnds
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=OP_G_CALL+3, },  // name = car(opnds)
    { .t=Instr_T,       .x=VM_push,     .y=G_CALL_B,    .z=OP_G_CALL+4, },  // G_CALL_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // (G_CALL_B name)

#define F_G_PRED (OP_G_CALL+5)
#define _F_G_PRED TO_CAP(F_G_PRED)
    { .t=Actor_T,       .x=F_G_PRED+1,  .y=NIL,         .z=UNDEF        },  // (peg-pred <pred> <peg>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_PRED+2,  },  // pred = arg1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=F_G_PRED+3,  },  // peg = arg2
    { .t=Instr_T,       .x=VM_push,     .y=G_PRED_B,    .z=F_G_PRED+4,  },  // G_PRED_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // (G_PRED_B pred peg)

#define F_G_XFORM (F_G_PRED+5)
#define _F_G_XFORM TO_CAP(F_G_XFORM)
    { .t=Actor_T,       .x=F_G_XFORM+1, .y=NIL,         .z=UNDEF        },  // (peg-xform func peg)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_XFORM+2, },  // func = arg1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=F_G_XFORM+3, },  // peg = arg2
    { .t=Instr_T,       .x=VM_push,     .y=G_XLAT_B,    .z=F_G_XFORM+4, },  // G_XLAT_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // (G_XLAT_B func peg)

#define F_S_LIST (F_G_XFORM+5)
#define _F_S_LIST TO_CAP(F_S_LIST)
    { .t=Actor_T,       .x=F_S_LIST+1,  .y=NIL,         .z=UNDEF        },  // (peg-source <list>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_S_LIST+2,  },  // list = arg1
    { .t=Instr_T,       .x=VM_push,     .y=S_LIST_B,    .z=F_S_LIST+3,  },  // S_LIST_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // src

#define F_G_START (F_S_LIST+4)
#define _F_G_START TO_CAP(F_G_START)
    { .t=Actor_T,       .x=F_G_START+1, .y=NIL,         .z=UNDEF        },  // (peg-start <peg> <src>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=F_G_START+2, },  // fail = cust
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=F_G_START+3, },  // ok = cust
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=F_G_START+4, },  // custs = (ok . fail)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_G_START+5, },  // peg = arg1
    { .t=Instr_T,       .x=VM_push,     .y=G_START,     .z=F_G_START+6, },  // G_START
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=F_G_START+7, },  // start
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=SEND_0,      },  // src = arg2

#define F_S_CHAIN (F_G_START+8)
#define _F_S_CHAIN TO_CAP(F_S_CHAIN)
    { .t=Actor_T,       .x=F_S_CHAIN+1, .y=NIL,         .z=UNDEF        },  // (peg-chain <peg> <src>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_S_CHAIN+2, },  // peg = arg1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=F_S_CHAIN+3, },  // src = arg2
    { .t=Instr_T,       .x=VM_push,     .y=S_CHAIN,     .z=F_S_CHAIN+4, },  // S_CHAIN
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // (S_CHAIN peg src)

#define PEG_SCM_END (F_S_CHAIN+5)
