#ifndef ACT_SCM_BASE
#error ACT_SCM_BASE required.
#endif

//
// Meta-Actor Procedures for LISP/Scheme
//

#define S_SEND (ACT_SCM_BASE)
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
//  { .t=Instr_T,       .x=VM_push,     .y=_beh_,       .z=M_ACTOR_B+0, },
    { .t=Instr_T,       .x=VM_push,     .y=Fexpr_T,     .z=M_ACTOR_B+1, },  // T = Fexpr_T
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=M_ACTOR_B+2, },  // X = SELF
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=M_ACTOR_B+3, },  // Y = ()
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(4),   .z=M_ACTOR_B+4, },  // Z = beh
    { .t=Instr_T,       .x=VM_cell,     .y=TO_FIX(4),   .z=M_ACTOR_B+5, },  // txn = cell(T, X, Y, Z)

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=M_ACTOR_B+6, },  // txn txn
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=M_ACTOR_B+7, },  // pending = ()
    { .t=Instr_T,       .x=VM_push,     .y=M_BUSY_B,    .z=M_ACTOR_B+8, },  // M_BUSY_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=M_ACTOR_B+9, },  // BECOME (M_BUSY_B txn pending)

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=M_ACTOR_B+10,},  // msg
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=M_ACTOR_B+11,},  // txn
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_ACTOR_B+12,},  // (txn . msg)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // beh

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
//  { .t=Instr_T,       .x=VM_push,     .y=_txn_,       .z=M_BUSY_B-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_pending_,   .z=M_BUSY_B+0,  },
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=M_BUSY_B+1,  },  // txn
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=M_BUSY_B+2,  },  // msg
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_EQ,      .z=M_BUSY_B+3,  },  // (msg == txn)
    { .t=Instr_T,       .x=VM_if,       .y=M_BUSY_B+8,  .z=M_BUSY_B+4,  },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=M_BUSY_B+5,  },  // msg
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_BUSY_B+6,  },  // (msg . pending)
    { .t=Instr_T,       .x=VM_push,     .y=M_BUSY_B,    .z=M_BUSY_B+7,  },  // M_BUSY_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=COMMIT,      },  // BECOME (M_BUSY_B txn (msg . pending))

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=M_BUSY_B+9,  },  // msg
    { .t=Instr_T,       .x=VM_get,      .y=FLD_Y,       .z=M_BUSY_B+10, },  // outbox

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=M_BUSY_B+11, },  // outbox outbox
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=M_BUSY_B+12, },  // outbox has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=M_BUSY_B+13, .z=M_BUSY_B+16, },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=M_BUSY_B+14, },  // rest first
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=M_BUSY_B+15, },  // rest msg actor
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(0),   .z=M_BUSY_B+10, },  // (actor . msg)

    { .t=Instr_T,       .x=VM_drop,     .y=TO_FIX(1),   .z=M_BUSY_B+17, },  // txn pending
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=M_BUSY_B+18, },  // msg
    { .t=Instr_T,       .x=VM_get,      .y=FLD_Z,       .z=M_BUSY_B+19, },  // beh'
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=M_BUSY_B+20, },  // txn pending beh' pending
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=M_BUSY_B+21, },  // pending has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=M_BUSY_B+24, .z=M_BUSY_B+22, },

    { .t=Instr_T,       .x=VM_push,     .y=M_ACTOR_B,   .z=M_BUSY_B+23, },  // M_ACTOR_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(1),   .z=COMMIT,      },  // BECOME (M_ACTOR_B beh')

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=M_BUSY_B+25, },  // beh' pending
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=M_BUSY_B+26, },  // beh' tail head

    { .t=Instr_T,       .x=VM_push,     .y=Fexpr_T,     .z=M_BUSY_B+27, },  // T = Fexpr_T
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=M_BUSY_B+28, },  // X = SELF
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=M_BUSY_B+29, },  // Y = ()
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(6),   .z=M_BUSY_B+30, },  // Z = beh'
    { .t=Instr_T,       .x=VM_cell,     .y=TO_FIX(4),   .z=M_BUSY_B+31, },  // txn' = cell(T, X, Y, Z)

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=M_BUSY_B+32, },  // beh' tail txn' head
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=M_BUSY_B+33, },  // beh' tail txn' head txn'
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_BUSY_B+34, },  // beh' tail txn' (txn' . head)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(4),   .z=M_BUSY_B+35, },  // tail txn' (txn' . head) beh'
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(0),   .z=M_BUSY_B+36, },  // (beh' . (txn' . head))

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=M_BUSY_B+37, },  // txn' tail
    { .t=Instr_T,       .x=VM_push,     .y=M_BUSY_B,    .z=M_BUSY_B+38, },  // M_BUSY_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=COMMIT,      },  // BECOME (M_BUSY_B txn' tail)

/*
(define meta-SEND                       ; (SEND actor message)
  (lambda (txn)
    (lambda (actor msg)
      (set-y txn (cons (cons actor msg) (get-y txn))) )))
*/
#define M_SEND (M_BUSY_B+39)
//  { .t=Instr_T,       .x=VM_push,     .y=_txn_,       .z=M_SEND+0,    },
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=M_SEND+1,    },  // txn txn
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=M_SEND+2,    },  // txn txn txn
    { .t=Instr_T,       .x=VM_get,      .y=FLD_Y,       .z=M_SEND+3,    },  // outbox = get_y(txn)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=M_SEND+4,    },  // msg = arg2
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_SEND+5,    },  // actor = arg1
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_SEND+6,    },  // (actor . msg)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_SEND+7,    },  // outbox' = ((actor . msg) . outbox)
    { .t=Instr_T,       .x=VM_set,      .y=FLD_Y,       .z=RV_UNIT,     },  // set_y(txn, outbox')

/*
(define meta-BECOME                     ; (BECOME behavior)
  (lambda (txn)
    (lambda (beh)
      (set-z txn beh) )))
*/
#define M_BECOME (M_SEND+8)
//  { .t=Instr_T,       .x=VM_push,     .y=_txn_,       .z=M_BECOME+0,  },
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=M_BECOME+1,  },  // txn txn
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_BECOME+2,  },  // beh = arg1
    { .t=Instr_T,       .x=VM_set,      .y=FLD_Z,       .z=RV_UNIT,     },  // set_z(txn, beh)

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
//  { .t=Instr_T,       .x=VM_push,     .y=_frml_,      .z=A_META_B-2,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_body_,      .z=A_META_B-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_env_,       .z=A_META_B+0,  },
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=A_META_B+1,  },  // env

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=A_META_B+2,  },  // txn
    { .t=Instr_T,       .x=VM_get,      .y=FLD_X,       .z=A_META_B+3,  },  // get_x(txn)
    { .t=Instr_T,       .x=VM_push,     .y=S_SELF,      .z=A_META_B+4,  },  // 'SELF
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=A_META_B+5,  },  // ('SELF . get_x(txn))

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=A_META_B+6,  },  // txn
    { .t=Instr_T,       .x=VM_push,     .y=M_BECOME,    .z=A_META_B+7,  },  // M_BECOME
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=A_META_B+8,  },  // m-become
    { .t=Instr_T,       .x=VM_push,     .y=S_BECOME,    .z=A_META_B+9,  },  // 'BECOME
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=A_META_B+10, },  // ('BECOME . m-become)

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=A_META_B+11, },  // txn
    { .t=Instr_T,       .x=VM_push,     .y=M_SEND,      .z=A_META_B+12, },  // M_SEND
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=A_META_B+13, },  // m-send
    { .t=Instr_T,       .x=VM_push,     .y=S_SEND,      .z=A_META_B+14, },  // 'SEND
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=A_META_B+15, },  // ('SEND . m-send)

    { .t=Instr_T,       .x=VM_push,     .y=UNDEF,       .z=A_META_B+16, },  // #?
    { .t=Instr_T,       .x=VM_push,     .y=S_IGNORE,    .z=A_META_B+17, },  // '_
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=A_META_B+18, },  // ('_ . #?)

    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(4),   .z=A_META_B+19, },  // aenv
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=A_META_B+20, },  // msg
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(5),   .z=A_META_B+21, },  // frml

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=A_META_B+22, },  // txn
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(6),   .z=A_META_B+23, },  // body
    { .t=Instr_T,       .x=VM_push,     .y=A_EXEC_B,    .z=A_META_B+24, },  // A_EXEC_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=A_META_B+25, },  // k_exec = (A_EXEC_B txn body)

    { .t=Instr_T,       .x=VM_push,     .y=_M_ZIP,      .z=A_META_B+26, },  // M_ZIP
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(4),   .z=COMMIT,      },  // (M_ZIP k_exec frml msg aenv)

//      (evbody #unit body (zip frml msg aenv))

//  { .t=Instr_T,       .x=VM_push,     .y=_txn_,       .z=A_EXEC_B-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_body_,      .z=A_EXEC_B+0,  },
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=A_EXEC_B+1,  },  // body txn
    { .t=Instr_T,       .x=VM_push,     .y=A_COMMIT_B,  .z=A_EXEC_B+2,  },  // A_COMMIT_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(1),   .z=A_EXEC_B+3,  },  // BECOME (A_COMMIT_B txn)

    { .t=Instr_T,       .x=VM_push,     .y=UNIT,        .z=A_EXEC_B+4,  },  // #unit
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=A_EXEC_B+5,  },  // SELF
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=A_EXEC_B+6,  },  // #unit SELF body

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=A_EXEC_B+7,  },  // env
    { .t=Instr_T,       .x=VM_push,     .y=K_SEQ_B,     .z=A_EXEC_B+8,  },  // K_SEQ_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(3),   .z=SEND_0,      },  // k-seq = (K_SEQ_B SELF body env)

//      (SEND (get-x txn) txn) )))

//  { .t=Instr_T,       .x=VM_push,     .y=_txn_,       .z=A_COMMIT_B+0,},
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=A_COMMIT_B+1,},  // txn txn
    { .t=Instr_T,       .x=VM_get,      .y=FLD_X,       .z=RELEASE_0,   },  // txn get-x(txn)

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
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_M_BEH+2,  },  // opnds
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=OP_M_BEH+3,  },  // frml = car(opnds)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_M_BEH+4,  },  // opnds
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(-1),  .z=OP_M_BEH+5,  },  // body = cdr(opnds)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=OP_M_BEH+6,  },  // env
    { .t=Instr_T,       .x=VM_push,     .y=A_META_B,    .z=OP_M_BEH+7,  },  // A_META_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(3),   .z=CUST_SEND,   },  // closure = (A_META_B frml body env)

/*
(define meta-CREATE                     ; (CREATE behavior)
  (CREATE
    (BEH (cust . args)
      (SEND cust (CREATE (meta-actor-beh (car args)))) )))
*/
#define F_CREATE (OP_M_BEH+8)
#define _F_CREATE TO_CAP(F_CREATE)
    { .t=Actor_T,       .x=F_CREATE+1,  .y=NIL,         .z=UNDEF        },  // (CREATE <behavior>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_CREATE+2,  },  // beh = arg1
    { .t=Instr_T,       .x=VM_push,     .y=M_ACTOR_B,   .z=F_CREATE+3,  },  // M_ACTOR_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // actor = (M_ACTOR_B beh)

#define F_SEND (F_CREATE+4)
#define _F_SEND TO_CAP(F_SEND)
    { .t=Actor_T,       .x=F_SEND+1,    .y=NIL,         .z=UNDEF        },  // (SEND <actor> <message>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=F_SEND+2,    },  // msg = arg2
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_SEND+3,    },  // actor = arg1
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(0),   .z=RV_UNIT,     },  // (actor . msg)

#define F_CALL (F_SEND+4)
#define _F_CALL TO_CAP(F_CALL)
    { .t=Actor_T,       .x=F_CALL+1,    .y=NIL,         .z=UNDEF        },  // (CALL <actor> <args>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=F_CALL+2,    },  // args = arg2
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=F_CALL+3,    },  // cust = arg0
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=F_CALL+4,    },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=SEND_0,      },  // actor = arg1

#define ACT_SCM_END (F_CALL+5)
