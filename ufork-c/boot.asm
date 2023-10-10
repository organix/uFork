#ifndef START
#error START required.
#endif

#ifndef _A_BOOT
#error #define _A_BOOT TO_CAP(A_BOOT)
#endif
    { .t=Event_T,       .x=_A_BOOT,     .y=NIL,         .z=NIL          },  // START = (A_BOOT)
#define RV_SELF (START+1)
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=RV_SELF+1,   },  // value = SELF
#define CUST_SEND (RV_SELF+1)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=CUST_SEND+1, },  // cust
#define SEND_0 (CUST_SEND+1)
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(0),   .z=SEND_0+1,    },  // (cust . msg)
#define COMMIT (SEND_0+1)
    { .t=Instr_T,       .x=VM_end,      .y=END_COMMIT,  .z=UNDEF,       },  // commit actor transaction

#define RESEND (COMMIT+1)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=RESEND+1,    },  // msg
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=SEND_0,      },  // SELF

#define RELEASE_0 (RESEND+2)
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(0),   .z=RELEASE_0+1, },  // (cust . msg)
#define RELEASE (RELEASE_0+1)
    { .t=Instr_T,       .x=VM_end,      .y=END_RELEASE, .z=UNDEF,       },  // commit transaction and free actor

#define RV_FALSE (RELEASE+1)
    { .t=Instr_T,       .x=VM_push,     .y=FALSE,       .z=CUST_SEND,   },  // FALSE
#define RV_TRUE (RV_FALSE+1)
    { .t=Instr_T,       .x=VM_push,     .y=TRUE,        .z=CUST_SEND,   },  // TRUE
#define RV_NIL (RV_TRUE+1)
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=CUST_SEND,   },  // NIL
#define RV_UNDEF (RV_NIL+1)
    { .t=Instr_T,       .x=VM_push,     .y=UNDEF,       .z=CUST_SEND,   },  // UNDEF
#define RV_UNIT (RV_UNDEF+1)
    { .t=Instr_T,       .x=VM_push,     .y=UNIT,        .z=CUST_SEND,   },  // UNIT
#define RV_ZERO (RV_UNIT+1)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX(0),   .z=CUST_SEND,   },  // +0
#define RV_ONE (RV_ZERO+1)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX(1),   .z=CUST_SEND,   },  // +1

#define S_VALUE (RV_ONE+1)
//  { .t=Instr_T,       .x=VM_push,     .y=_in_,        .z=S_VALUE+0,   },  // (token . next) -or- NIL
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=S_VALUE+1,   },  // in
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=SEND_0,      },  // cust

#define S_EMPTY (S_VALUE+2)
#define _S_EMPTY TO_CAP(S_EMPTY)
    { .t=Actor_T,       .x=S_EMPTY+1,   .y=NIL,         .z=UNDEF,       },  // empty stream
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=S_VALUE,     },  // () = NIL
//  { .t=Actor_T,       .x=S_VALUE,     .y=S_EMPTY+1    .z=UNDEF,       },
//  { .t=Pair_T,        .x=NIL,         .y=NIL,         .z=UNDEF,       },

#define S_GETC (S_EMPTY+2)
#define S_END_X (S_GETC+9)
#define S_VAL_X (S_GETC+10)
    { .t=Instr_T,       .x=VM_getc,     .y=UNDEF,       .z=S_GETC+1,    },  // ch
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=S_GETC+2,    },  // ch ch
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('\0'),.z=S_GETC+3,    },
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_LT,      .z=S_GETC+4,    },  // ch < '\0'
    { .t=Instr_T,       .x=VM_if,       .y=S_END_X,     .z=S_GETC+5,    },

    { .t=Instr_T,       .x=VM_push,     .y=S_GETC,      .z=S_GETC+6,    },  // S_GETC
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(0),   .z=S_GETC+7,    },  // next
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=S_GETC+8,    },  // ch
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=S_VAL_X,     },  // in = (ch . next)

    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=S_GETC+10,   },  // in = ()

    { .t=Instr_T,       .x=VM_push,     .y=S_VALUE,     .z=S_GETC+11,   },  // S_VALUE
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(1),   .z=RESEND,      },  // BECOME (S_VALUE in)

#define S_LIST_B (S_GETC+12)
//  { .t=Instr_T,       .x=VM_push,     .y=_list_,      .z=S_LIST_B+0,  },
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=S_LIST_B+1,  },  // list
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=S_LIST_B+2,  },  // list has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=S_LIST_B+3,  .z=S_END_X,     },  // list

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=S_LIST_B+4,  },  // tail head
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=S_LIST_B+5,  },  // head tail
    { .t=Instr_T,       .x=VM_push,     .y=S_LIST_B,    .z=S_LIST_B+6,  },  // S_LIST_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=S_LIST_B+7,  },  // next
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=S_LIST_B+8,  },  // head
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=S_VAL_X,     },  // in = (head . next)

#define G_START (S_LIST_B+9)
//  { .t=Instr_T,       .x=VM_push,     .y=_custs_,     .z=G_START-1,   },  // (ok . fail)
//  { .t=Instr_T,       .x=VM_push,     .y=_ptrn_,      .z=G_START+0,   },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=G_START+1,   },  // in
    { .t=Instr_T,       .x=VM_push,     .y=UNDEF,       .z=G_START+2,   },  // value = UNDEF
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(4),   .z=G_START+3,   },  // custs
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(2),   .z=G_START+4,   },  // (custs value . in)
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=SEND_0,      },  // ptrn

#define G_CALL_B (G_START+5)
//  { .t=Instr_T,       .x=VM_push,     .y=_symbol_,    .z=G_CALL_B+0,  },  // name = symbol
    { .t=Instr_T,       .x=VM_get,      .y=FLD_Z,       .z=G_CALL_B+1,  },  // ptrn = lookup(name)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=G_CALL_B+2,  },  // (custs value . in)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // (ptrn custs value . in)

#define G_LANG (G_CALL_B+3)
#define _G_LANG TO_CAP(G_LANG)
    { .t=Actor_T,       .x=G_LANG+1,    .y=NIL,         .z=UNDEF        },
    { .t=Instr_T,       .x=VM_push,     .y=UNDEF,       .z=G_CALL_B,    },  // {y:symbol} patched by A_BOOT

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
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=GLOBAL_ENV+2,},  // symbol = key
    { .t=Instr_T,       .x=VM_get,      .y=FLD_Z,       .z=CUST_SEND,   },  // get_z(symbol)

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
//  { .t=Instr_T,       .x=VM_push,     .y=_var_,       .z=BOUND_BEH-2, },
//  { .t=Instr_T,       .x=VM_push,     .y=_val_,       .z=BOUND_BEH-1, },
//  { .t=Instr_T,       .x=VM_push,     .y=_env_,       .z=BOUND_BEH+0, },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=BOUND_BEH+1, },  // key
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(4),   .z=BOUND_BEH+2, },  // var
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_EQ,      .z=BOUND_BEH+3, },  // key == var
    { .t=Instr_T,       .x=VM_if,       .y=BOUND_BEH+4, .z=BOUND_BEH+5, },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // val

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=BOUND_BEH+6, },  // msg
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=SEND_0,      },  // env

#define REPL_R (BOUND_BEH+7)
#define REPL_E (REPL_R+8)
#define _REPL_E TO_CAP(REPL_E)
#define REPL_P (REPL_E+8)
#define _REPL_P TO_CAP(REPL_P)
#define REPL_L (REPL_P+3)
#define REPL_F (REPL_L+4)
#define _REPL_F TO_CAP(REPL_F)
    { .t=Instr_T,       .x=VM_push,     .y=_REPL_F,     .z=REPL_R+1,    },  // fail = REPL_F
    { .t=Instr_T,       .x=VM_push,     .y=_REPL_E,     .z=REPL_R+2,    },  // ok = REPL_E
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=REPL_R+3,    },  // custs = (ok . fail)
    { .t=Instr_T,       .x=VM_push,     .y=_G_LANG,     .z=REPL_R+4,    },  // ptrn = G_LANG
    { .t=Instr_T,       .x=VM_push,     .y=G_START,     .z=REPL_R+5,    },  // G_START
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=REPL_R+6,    },  // start
    { .t=Instr_T,       .x=VM_push,     .y=S_GETC,      .z=REPL_R+7,    },  // S_GETC
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(0),   .z=SEND_0,      },  // src

    { .t=Actor_T,       .x=REPL_E+1,    .y=NIL,         .z=UNDEF        },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=REPL_E+2,    },  // sexpr
    { .t=Instr_T,       .x=VM_debug,    .y=TO_FIX(888), .z=REPL_E+3,    },

    //{ .t=Instr_T,       .x=VM_push,     .y=_GLOBAL_ENV, .z=REPL_E+4,    },  // env = GLOBAL_ENV
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=REPL_E+4,    },  // env = ()
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=REPL_E+5,    },  // form = sexpr
    { .t=Instr_T,       .x=VM_push,     .y=_REPL_P,     .z=REPL_E+6,    },  // cust = REPL_P
    { .t=Instr_T,       .x=VM_push,     .y=_M_EVAL,     .z=REPL_E+7,    },  // M_EVAL
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVAL cust form env)

    { .t=Actor_T,       .x=REPL_P+1,    .y=NIL,         .z=UNDEF        },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=REPL_P+2,    },
    { .t=Instr_T,       .x=VM_debug,    .y=TO_FIX(999), .z=REPL_L,      },

    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('>'), .z=REPL_L+1,    },
    { .t=Instr_T,       .x=VM_putc,     .y=UNDEF,       .z=REPL_L+2,    },
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX(' '), .z=REPL_L+3,    },
    { .t=Instr_T,       .x=VM_putc,     .y=UNDEF,       .z=REPL_R,      },

    { .t=Actor_T,       .x=REPL_F+1,    .y=NIL,         .z=UNDEF        },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=REPL_F+2,    },
    { .t=Instr_T,       .x=VM_debug,    .y=TO_FIX(666), .z=COMMIT,      },

#define A_BOOT (REPL_F+3)
    { .t=Actor_T,       .x=A_BOOT+1,    .y=NIL,         .z=UNDEF        },
    { .t=Instr_T,       .x=VM_push,     .y=G_LANG+1,    .z=A_BOOT+2,    },  // cell to patch
    { .t=Instr_T,       .x=VM_push,     .y=A_BOOT+5,    .z=A_BOOT+3,    },  // "peg-lang" string
    { .t=Instr_T,       .x=VM_cvt,      .y=CVT_LST_SYM, .z=A_BOOT+4,    },
    { .t=Instr_T,       .x=VM_set,      .y=FLD_Y,       .z=REPL_L,      },  // set_y(symbol)

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
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX(-1),  .z=A_CLOCK+2,   },
#define CLOCK_BEH (A_CLOCK+2)
#if 0
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=A_CLOCK+3,   },
    { .t=Instr_T,       .x=VM_push,     .y=CLOCK_BEH,   .z=A_CLOCK+4,   },
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(1),   .z=COMMIT,      },
#else
    { .t=Instr_T,       .x=VM_push,     .y=A_CLOCK+1,   .z=A_CLOCK+3,   },  // address of VM_push instruction
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=A_CLOCK+4,   },  // clock value
    { .t=Instr_T,       .x=VM_set,      .y=FLD_Y,       .z=COMMIT,      },  // update stored value (WARNING! SELF-MODIFYING CODE)
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
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=TAG_BEH+0,   },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=TAG_BEH+1,   },  // msg
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=TAG_BEH+2,   },  // SELF
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=TAG_BEH+3,   },  // (SELF . msg)
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=SEND_0,      },  // cust

#define K_JOIN_H (TAG_BEH+4)
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=K_JOIN_H-2,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_head_,      .z=K_JOIN_H-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_k_tail_,    .z=K_JOIN_H+0,  },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=K_JOIN_H+1,  },  // (tag . value)
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=K_JOIN_H+2,  },  // value tag
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=K_JOIN_H+3,  },  // k_tail
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_EQ,      .z=K_JOIN_H+4,  },  // (tag == k_tail)
    { .t=Instr_T,       .x=VM_if,       .y=K_JOIN_H+5,  .z=RELEASE,     },  // WRONG TAG!
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=K_JOIN_H+6,  },  // value head
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=K_JOIN_H+7,  },  // pair = (head . value)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // pair cust

#define K_JOIN_T (K_JOIN_H+8)
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=K_JOIN_T-2,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_tail_,      .z=K_JOIN_T-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_k_head_,    .z=K_JOIN_T+0,  },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=K_JOIN_T+1,  },  // (tag . value)
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=K_JOIN_T+2,  },  // value tag
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=K_JOIN_T+3,  },  // k_head
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_EQ,      .z=K_JOIN_T+4,  },  // (tag == k_head)
    { .t=Instr_T,       .x=VM_if,       .y=K_JOIN_T+5,  .z=RELEASE,     },  // WRONG TAG!
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=K_JOIN_T+6,  },  // pair = (value . tail)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // pair cust

/*
(define join-beh
  (lambda (cust k_head k_tail)
    (BEH (tag . value))
      ;
      ))
*/
#define JOIN_BEH (K_JOIN_T+7)
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=JOIN_BEH-2,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_k_head_,    .z=JOIN_BEH-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_k_tail_,    .z=JOIN_BEH+0,  },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=JOIN_BEH+1,  },  // (tag . value)
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=JOIN_BEH+2,  },  // value tag

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(4),   .z=JOIN_BEH+3,  },  // k_head
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=JOIN_BEH+4,  },  // tag
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_EQ,      .z=JOIN_BEH+5,  },  // (tag == k_head)
    { .t=Instr_T,       .x=VM_if,       .y=JOIN_BEH+6,  .z=JOIN_BEH+11, },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(5),   .z=JOIN_BEH+7,  },  // k_head k_tail value tag cust
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=JOIN_BEH+8,  },  // k_head k_tail tag cust value
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(4),   .z=JOIN_BEH+9,  },  // k_head tag cust value k_tail
    { .t=Instr_T,       .x=VM_push,     .y=K_JOIN_H,    .z=JOIN_BEH+10, },  // K_JOIN_H
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(3),   .z=COMMIT,      },  // BECOME (K_JOIN_H cust value k_tail)

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=JOIN_BEH+12, },  // k_tail
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=JOIN_BEH+13, },  // tag
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_EQ,      .z=JOIN_BEH+14, },  // (tag == k_tail)
    { .t=Instr_T,       .x=VM_if,       .y=JOIN_BEH+15, .z=COMMIT,      },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(5),   .z=JOIN_BEH+16, },  // k_head k_tail value tag cust
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=JOIN_BEH+17, },  // k_head k_tail tag cust value
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(5),   .z=JOIN_BEH+18, },  // k_tail tag cust value k_head
    { .t=Instr_T,       .x=VM_push,     .y=K_JOIN_T,    .z=JOIN_BEH+19, },  // K_JOIN_T
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(3),   .z=COMMIT,      },  // BECOME (K_JOIN_T cust value k_head)

/*
(define fork-beh
  (lambda (cust head tail)
    (BEH (h-req t-req))
      ;
      ))
*/
#define FORK_BEH (JOIN_BEH+20)
//  { .t=Instr_T,       .x=VM_push,     .y=_tail_,      .z=FORK_BEH-2,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_head_,      .z=FORK_BEH-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=FORK_BEH+0,  },

    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=FORK_BEH+1,  },  // self
    { .t=Instr_T,       .x=VM_push,     .y=TAG_BEH,     .z=FORK_BEH+2,  },  // TAG_BEH
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=FORK_BEH+3,  },  // k_head

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=FORK_BEH+4,  },  // h_req
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=FORK_BEH+5,  },  // k_head
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=FORK_BEH+6,  },  // msg = (k_head . h_req)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(4),   .z=FORK_BEH+7,  },  // tail cust k_head msg head
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(0),   .z=FORK_BEH+8,  },  // (head . msg)

    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=FORK_BEH+9,  },  // self
    { .t=Instr_T,       .x=VM_push,     .y=TAG_BEH,     .z=FORK_BEH+10, },  // TAG_BEH
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=FORK_BEH+11, },  // k_tail

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=FORK_BEH+12, },  // t_req
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=FORK_BEH+13, },  // k_tail
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=FORK_BEH+14, },  // msg = (k_tail . t_req)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(5),   .z=FORK_BEH+15, },  // cust k_head k_tail msg tail
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(0),   .z=FORK_BEH+16, },  // (tail . msg)

    { .t=Instr_T,       .x=VM_push,     .y=JOIN_BEH,    .z=FORK_BEH+17, },  // JOIN_BEH
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(3),   .z=COMMIT,      },  // BECOME (JOIN_BEH cust k_head k_tail)

#define BOOT_END (FORK_BEH+18)
