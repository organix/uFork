#ifndef UFORK_BASE
#error UFORK_BASE required.
#endif

#if SCM_ASM_TOOLS
//
// Assembly-language Tools
//

#define F_CELL (UFORK_BASE)
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
#define ASM_END (UFORK_BASE)
#endif // SCM_ASM_TOOLS

//
// PEG tools
//

#if SCM_PEG_TOOLS
#define F_G_EQ (ASM_END+0)
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

#define S_EMPTY (F_S_CHAIN+5)
#else // !SCM_PEG_TOOLS
#define S_EMPTY (ASM_END+0)
#endif // SCM_PEG_TOOLS
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

#define UFORK_END (A_QUIT+2)
