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
// PEG tools
//

#if SCM_PEG_TOOLS
#define F_G_EQ (ACTOR_END+0)
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
#define G_END (ACTOR_END+0)
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
