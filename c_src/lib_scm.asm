#ifndef LIB_SCM_BASE
#error LIB_SCM_BASE required.
#endif

//
// LISP/Scheme "Compiled" Primitives
//

#define F_LIST (LIB_SCM_BASE)
#define _F_LIST TO_CAP(F_LIST)
    { .t=Actor_T,       .x=F_LIST+1,    .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=CUST_SEND,   },  // args

#define F_CONS (F_LIST+2)
#define _F_CONS TO_CAP(F_CONS)
    { .t=Actor_T,       .x=F_CONS+1,    .y=NIL,         .z=UNDEF        },  // (cust . args)
#if 1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=F_CONS+2,    },  // tail = arg2
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_CONS+3,    },  // head = arg1
#else
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_CONS+2,    },  // (head tail)
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(2),   .z=F_CONS+3,    },  // () tail head
#endif
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=CUST_SEND,   },  // (head . tail)

#define F_CAR (F_CONS+4)
#define _F_CAR TO_CAP(F_CAR)
    { .t=Actor_T,       .x=F_CAR+1,     .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_CAR+2,     },  // pair = arg1
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // car(pair)

#define F_CDR (F_CAR+3)
#define _F_CDR TO_CAP(F_CDR)
    { .t=Actor_T,       .x=F_CDR+1,     .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_CDR+2,     },  // pair = arg1
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(-1),  .z=CUST_SEND,   },  // cdr(pair)

#define F_CADR (F_CDR+3)
#define _F_CADR TO_CAP(F_CADR)
    { .t=Actor_T,       .x=F_CADR+1,    .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_CADR+2,    },  // pair = arg1
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // cadr(pair)

#define F_CADDR (F_CADR+3)
#define _F_CADDR TO_CAP(F_CADDR)
    { .t=Actor_T,       .x=F_CADDR+1,   .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_CADDR+2,   },  // pair = arg1
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(3),   .z=CUST_SEND,   },  // caddr(pair)

#define F_NTH (F_CADDR+3)
#define _F_NTH TO_CAP(F_NTH)
    { .t=Actor_T,       .x=F_NTH+1,     .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=F_NTH+2,     },  // msg = (cust . args)

    { .t=Instr_T,       .x=VM_push,     .y=Instr_T,     .z=F_NTH+3,     },  // Instr_T
    { .t=Instr_T,       .x=VM_push,     .y=VM_nth,      .z=F_NTH+4,     },  // VM_nth
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_NTH+5,     },  // index = arg1
    { .t=Instr_T,       .x=VM_push,     .y=CUST_SEND,   .z=F_NTH+6,     },  // CUST_SEND
    { .t=Instr_T,       .x=VM_cell,     .y=TO_FIX(4),   .z=F_NTH+7,     },  // beh = {t:Instr_T,x:VM_nth,y:index,z:CUST_SEND}

    { .t=Instr_T,       .x=VM_push,     .y=Instr_T,     .z=F_NTH+8,     },  // Instr_T
    { .t=Instr_T,       .x=VM_push,     .y=VM_msg,      .z=F_NTH+9,     },  // VM_msg
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX(3),   .z=F_NTH+10,    },  // 3
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(4),   .z=F_NTH+11,    },  // beh
    { .t=Instr_T,       .x=VM_cell,     .y=TO_FIX(4),   .z=F_NTH+12,    },  // beh' = {t:Instr_T,x:VM_msg,y:3,z:beh}

    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(0),   .z=SEND_0,      },  // (k_nth cust . args)

#define F_NULL_P (F_NTH+13)
#define _F_NULL_P TO_CAP(F_NULL_P)
    { .t=Actor_T,       .x=F_NULL_P+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NULL_P+2,  },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NULL_P+3,  },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NULL_P+4,  },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NULL_P+5,  .z=RV_TRUE,     },
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NULL_P+6,  },  // rest first
    { .t=Instr_T,       .x=VM_eq,       .y=NIL,         .z=F_NULL_P+7,  },  // first == NIL
    { .t=Instr_T,       .x=VM_if,       .y=F_NULL_P+2,  .z=RV_FALSE,    },

#define F_TYPE_P (F_NULL_P+8)
//  { .t=Instr_T,       .x=VM_push,     .y=_type_,      .z=F_TYPE_P+0,  },  // type not in {Fixnum_T, Actor_T}
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_TYPE_P+1,  },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_TYPE_P+2,  },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_TYPE_P+3,  },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_TYPE_P+4,  .z=RV_TRUE,     },
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_TYPE_P+5,  },  // rest first

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_TYPE_P+6,  },  // first first
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_TYPE_P+7,  },  // first has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=RV_FALSE,    .z=F_TYPE_P+8,  },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_TYPE_P+9,  },  // first first
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_TYPE_P+10, },  // first has type Actor_T
    { .t=Instr_T,       .x=VM_if,       .y=RV_FALSE,    .z=F_TYPE_P+11, },

    { .t=Instr_T,       .x=VM_get,      .y=FLD_T,       .z=F_TYPE_P+12, },  // get_t(first)
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=F_TYPE_P+13, },  // type
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_EQ,      .z=F_TYPE_P+14, },  // get_t(first) == type
    { .t=Instr_T,       .x=VM_if,       .y=F_TYPE_P+1,  .z=RV_FALSE,    },

#define F_PAIR_P (F_TYPE_P+15)
#define _F_PAIR_P TO_CAP(F_PAIR_P)
    { .t=Actor_T,       .x=F_PAIR_P+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_push,     .y=Pair_T,      .z=F_TYPE_P,    },  // type = Pair_T

#define F_BOOL_P (F_PAIR_P+2)
#define _F_BOOL_P TO_CAP(F_BOOL_P)
    { .t=Actor_T,       .x=F_BOOL_P+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_BOOL_P+2,  },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_BOOL_P+3,  },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_BOOL_P+4,  },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_BOOL_P+5,  .z=RV_TRUE,     },
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_BOOL_P+6,  },  // rest first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_BOOL_P+7,  },  // first first
    { .t=Instr_T,       .x=VM_eq,       .y=FALSE,       .z=F_BOOL_P+8,  },  // first == FALSE
    { .t=Instr_T,       .x=VM_if,       .y=F_BOOL_P+9,  .z=F_BOOL_P+10, },
    { .t=Instr_T,       .x=VM_drop,     .y=TO_FIX(1),   .z=F_BOOL_P+2,  },  // rest
    { .t=Instr_T,       .x=VM_eq,       .y=TRUE,        .z=F_BOOL_P+11, },  // first == TRUE
    { .t=Instr_T,       .x=VM_if,       .y=F_BOOL_P+2,  .z=RV_FALSE,    },

#define F_NUM_P (F_BOOL_P+12)
#define _F_NUM_P TO_CAP(F_NUM_P)
    { .t=Actor_T,       .x=F_NUM_P+1,   .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_P+2,   },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_P+3,   },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_P+4,   },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_P+5,   .z=RV_TRUE,     },
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_P+6,   },  // rest first
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_P+7,   },  // first has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_P+2,   .z=RV_FALSE,    },

#define F_SYM_P (F_NUM_P+8)
#define _F_SYM_P TO_CAP(F_SYM_P)
    { .t=Actor_T,       .x=F_SYM_P+1,   .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_push,     .y=Symbol_T,    .z=F_TYPE_P,    },  // type = Symbol_T

#define F_ACT_P (F_SYM_P+2)
#define _F_ACT_P TO_CAP(F_ACT_P)
    { .t=Actor_T,       .x=F_ACT_P+1,   .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_ACT_P+2,   },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_ACT_P+3,   },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_ACT_P+4,   },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_ACT_P+5,   .z=RV_TRUE,     },
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_ACT_P+6,   },  // rest first
    { .t=Instr_T,       .x=VM_typeq,    .y=Actor_T,     .z=F_ACT_P+7,   },  // first has type Actor_T
    { .t=Instr_T,       .x=VM_if,       .y=F_ACT_P+2,   .z=RV_FALSE,    },

#define F_EQ_P (F_ACT_P+8)
#define _F_EQ_P TO_CAP(F_EQ_P)
    { .t=Actor_T,       .x=F_EQ_P+1,    .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=F_EQ_P+2,    },  // rest = cdr(args)
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_EQ_P+3,    },  // rest rest
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_EQ_P+4,    },  // rest has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_EQ_P+5,    .z=RV_TRUE,     },
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_EQ_P+6,    },  // rest first
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_EQ_P+7,    },  // car(args)
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_EQ,      .z=F_EQ_P+8,    },  // first == car(args)
    { .t=Instr_T,       .x=VM_if,       .y=F_EQ_P+2,    .z=RV_FALSE,    },

#define F_NUM_EQ (F_EQ_P+9)
#define _F_NUM_EQ TO_CAP(F_NUM_EQ)
    { .t=Actor_T,       .x=F_NUM_EQ+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_EQ+2,  },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_EQ+3,  },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_EQ+4,  },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_EQ+5,  .z=RV_TRUE,     },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_EQ+6,  },  // rest first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_EQ+7,  },  // rest first first
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_EQ+8,  },  // first has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_EQ+9,  .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_EQ+10, },  // rest
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_EQ+11, },  // rest has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_EQ+12, .z=RV_TRUE,     },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_EQ+13, },  // first rest
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_EQ+14, },  // first rest second
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_EQ+15, },  // second second
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_EQ+16, },  // second has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_EQ+17, .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_EQ+18, },  // rest second first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_EQ+19, },  // rest second first second
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_EQ,      .z=F_NUM_EQ+20, },  // first == second
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_EQ+9,  .z=RV_FALSE,    },

#define F_NUM_LT (F_NUM_EQ+21)
#define _F_NUM_LT TO_CAP(F_NUM_LT)
    { .t=Actor_T,       .x=F_NUM_LT+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_LT+2,  },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_LT+3,  },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_LT+4,  },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_LT+5,  .z=RV_TRUE,     },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_LT+6,  },  // rest first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_LT+7,  },  // rest first first
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_LT+8,  },  // first has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_LT+9,  .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_LT+10, },  // rest
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_LT+11, },  // rest has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_LT+12, .z=RV_TRUE,     },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_LT+13, },  // first rest
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_LT+14, },  // first rest second
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_LT+15, },  // second second
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_LT+16, },  // second has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_LT+17, .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_LT+18, },  // rest second first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_LT+19, },  // rest second first second
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_LT,      .z=F_NUM_LT+20, },  // first < second
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_LT+9,  .z=RV_FALSE,    },

#define F_NUM_LE (F_NUM_LT+21)
#define _F_NUM_LE TO_CAP(F_NUM_LE)
    { .t=Actor_T,       .x=F_NUM_LE+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_LE+2,  },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_LE+3,  },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_LE+4,  },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_LE+5,  .z=RV_TRUE,     },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_LE+6,  },  // rest first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_LE+7,  },  // rest first first
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_LE+8,  },  // first has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_LE+9,  .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_LE+10, },  // rest
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_LE+11, },  // rest has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_LE+12, .z=RV_TRUE,     },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_LE+13, },  // first rest
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_LE+14, },  // first rest second
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_LE+15, },  // second second
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_LE+16, },  // second has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_LE+17, .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_LE+18, },  // rest second first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_LE+19, },  // rest second first second
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_LE,      .z=F_NUM_LE+20, },  // first <= second
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_LE+9,  .z=RV_FALSE,    },

#define F_NUM_GE (F_NUM_LE+21)
#define _F_NUM_GE TO_CAP(F_NUM_GE)
    { .t=Actor_T,       .x=F_NUM_GE+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_GE+2,  },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_GE+3,  },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_GE+4,  },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_GE+5,  .z=RV_TRUE,     },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_GE+6,  },  // rest first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_GE+7,  },  // rest first first
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_GE+8,  },  // first has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_GE+9,  .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_GE+10, },  // rest
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_GE+11, },  // rest has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_GE+12, .z=RV_TRUE,     },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_GE+13, },  // first rest
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_GE+14, },  // first rest second
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_GE+15, },  // second second
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_GE+16, },  // second has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_GE+17, .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_GE+18, },  // rest second first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_GE+19, },  // rest second first second
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_GE,      .z=F_NUM_GE+20, },  // first >= second
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_GE+9,  .z=RV_FALSE,    },

#define F_NUM_GT (F_NUM_GE+21)
#define _F_NUM_GT TO_CAP(F_NUM_GT)
    { .t=Actor_T,       .x=F_NUM_GT+1,  .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_GT+2,  },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_GT+3,  },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_GT+4,  },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_GT+5,  .z=RV_TRUE,     },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_GT+6,  },  // rest first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_GT+7,  },  // rest first first
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_GT+8,  },  // first has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_GT+9,  .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_GT+10, },  // rest
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_GT+11, },  // rest has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_GT+12, .z=RV_TRUE,     },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_GT+13, },  // first rest
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_GT+14, },  // first rest second
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_GT+15, },  // second second
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_GT+16, },  // second has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_GT+17, .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_GT+18, },  // rest second first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_GT+19, },  // rest second first second
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_GT,      .z=F_NUM_GT+20, },  // first > second
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_GT+9,  .z=RV_FALSE,    },

#define F_NUM_ADD (F_NUM_GT+21)
#define _F_NUM_ADD TO_CAP(F_NUM_ADD)
    { .t=Actor_T,       .x=F_NUM_ADD+1, .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_ADD+2, },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_ADD+3, },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_ADD+4, },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_ADD+5, .z=RV_ZERO,     },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_ADD+6, },  // rest first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_ADD+7, },  // rest first first
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_ADD+8, },  // first has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_ADD+9, .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_ADD+10,},  // rest
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_ADD+11,},  // rest has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_ADD+12,.z=CUST_SEND,   },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_ADD+13,},  // first rest
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_ADD+14,},  // first rest second
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_ADD+15,},  // second second
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_ADD+16,},  // second has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_ADD+17,.z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_ADD+18,},  // rest second first
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_ADD+19,},  // rest first second
    { .t=Instr_T,       .x=VM_alu,      .y=ALU_ADD,     .z=F_NUM_ADD+9, },  // first + second

#define F_NUM_SUB (F_NUM_ADD+20)
#define _F_NUM_SUB TO_CAP(F_NUM_SUB)
    { .t=Actor_T,       .x=F_NUM_SUB+1, .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_SUB+2, },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_SUB+3, },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_SUB+4, },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_SUB+5, .z=RV_ZERO,     },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_SUB+6, },  // rest first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_SUB+7, },  // rest first first
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_SUB+8, },  // first has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_SUB+9, .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_SUB+10,},  // rest
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_SUB+11,},  // rest has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_SUB+15,.z=F_NUM_SUB+12,},

    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX(0),   .z=F_NUM_SUB+13,},  // +0
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_SUB+14,},  // +0 first
    { .t=Instr_T,       .x=VM_alu,      .y=ALU_SUB,     .z=CUST_SEND,   },  // +0 - first

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_SUB+16,},  // first rest
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_SUB+17,},  // first rest second
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_SUB+18,},  // second second
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_SUB+19,},  // second has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_SUB+20,.z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_SUB+21,},  // rest second first
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_SUB+22,},  // rest first second
    { .t=Instr_T,       .x=VM_alu,      .y=ALU_SUB,     .z=F_NUM_SUB+23,},  // first - second

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_SUB+24,},  // rest
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_SUB+25,},  // rest has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_SUB+15,.z=CUST_SEND,   },

#define F_NUM_MUL (F_NUM_SUB+26)
#define _F_NUM_MUL TO_CAP(F_NUM_MUL)
    { .t=Actor_T,       .x=F_NUM_MUL+1, .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_NUM_MUL+2, },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_MUL+3, },  // args args
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_MUL+4, },  // args has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_MUL+5, .z=RV_ONE,      },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_MUL+6, },  // rest first
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_MUL+7, },  // rest first first
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_MUL+8, },  // first has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_MUL+9, .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=F_NUM_MUL+10,},  // rest
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=F_NUM_MUL+11,},  // rest has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_MUL+12,.z=CUST_SEND,   },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_MUL+13,},  // first rest
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=F_NUM_MUL+14,},  // first rest second
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=F_NUM_MUL+15,},  // second second
    { .t=Instr_T,       .x=VM_typeq,    .y=Fixnum_T,    .z=F_NUM_MUL+16,},  // second has type Fixnum_T
    { .t=Instr_T,       .x=VM_if,       .y=F_NUM_MUL+17,.z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=F_NUM_MUL+18,},  // rest second first
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=F_NUM_MUL+19,},  // rest first second
    { .t=Instr_T,       .x=VM_alu,      .y=ALU_MUL,     .z=F_NUM_MUL+9, },  // first * second

#define F_LST_NUM (F_NUM_MUL+20)
#define _F_LST_NUM TO_CAP(F_LST_NUM)
    { .t=Actor_T,       .x=F_LST_NUM+1, .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_LST_NUM+2, },  // chars = arg1
    { .t=Instr_T,       .x=VM_cvt,      .y=CVT_LST_NUM, .z=CUST_SEND,   },  // lst_num(chars)

#define F_LST_SYM (F_LST_NUM+3)
#define _F_LST_SYM TO_CAP(F_LST_SYM)
    { .t=Actor_T,       .x=F_LST_SYM+1, .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_LST_SYM+2, },  // chars = arg1
    { .t=Instr_T,       .x=VM_cvt,      .y=CVT_LST_SYM, .z=CUST_SEND,   },  // lst_sym(chars)

#define F_PRINT (F_LST_SYM+3)
#define _F_PRINT TO_CAP(F_PRINT)
    { .t=Actor_T,       .x=F_PRINT+1,   .y=NIL,         .z=UNDEF        },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=F_PRINT+2,   },
    { .t=Instr_T,       .x=VM_debug,    .y=TO_FIX(555), .z=F_PRINT+3,   },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=CUST_SEND,   },

#define LIB_SCM_END (F_PRINT+4)
