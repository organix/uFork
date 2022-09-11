#ifndef UFORK_BASE
#error UFORK_BASE required.
#endif
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

#define UFORK_END (A_QUIT+2)
