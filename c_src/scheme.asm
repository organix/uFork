#ifndef SCHEME_BASE
#error SCHEME_BASE required.
#endif

//
// Static Symbols
//

#define S_IGNORE (SCHEME_BASE)
    { .t=Symbol_T,      .x=0,           .y=S_IGNORE+1,  .z=UNDEF,       },
    { .t=Pair_T,        .x=TO_FIX('_'), .y=NIL,         .z=UNDEF        },

#define S_QUOTE (SCHEME_BASE+2)
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
#ifndef _M_EVAL
#error #define _M_EVAL TO_CAP(M_EVAL)
#endif
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
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_EVAL+2,    },  // form = arg1
    { .t=Instr_T,       .x=VM_typeq,    .y=Symbol_T,    .z=M_EVAL+3,    },  // form has type Symbol_T
    { .t=Instr_T,       .x=VM_if,       .y=M_EVAL+4,    .z=M_EVAL+6,    },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=M_EVAL+5,    },  // msg = (cust form env)
    { .t=Instr_T,       .x=VM_push,     .y=_M_LOOKUP,   .z=SEND_0,      },  // (M_LOOKUP cust key alist)

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_EVAL+7,    },  // form = arg1
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=M_EVAL+8,    },  // form has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=M_EVAL+10,   .z=M_EVAL+9,    },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=CUST_SEND,   },  // self-eval form

/*
      (if (pair? form)                  ; combination
        (let ((fn    (eval (car form) env))
              (opnds (cdr form)))
*/
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=M_EVAL+11,   },  // env
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_EVAL+12,   },  // form
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=M_EVAL+13,   },  // tail head

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=M_EVAL+14,   },  // env
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=M_EVAL+15,   },  // opnds = tail
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=M_EVAL+16,   },  // cust
    { .t=Instr_T,       .x=VM_push,     .y=K_COMBINE,   .z=M_EVAL+17,   },  // K_COMBINE
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(3),   .z=M_EVAL+18,   },  // k_combine = (K_COMBINE env tail cust)

    { .t=Instr_T,       .x=VM_push,     .y=_M_EVAL,     .z=M_EVAL+19,   },  // M_EVAL
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVAL k_combine head env)

/*
          (if (actor? fn)               ; _applicative_
            (CALL fn (evlis opnds env))
            (if (fexpr?)                ; _operative_
              (CALL (get-x fn) (list opnds env))
              #?)))
*/
//  { .t=Instr_T,       .x=VM_push,     .y=_env_,       .z=K_COMBINE-2, },
//  { .t=Instr_T,       .x=VM_push,     .y=_opnds_,     .z=K_COMBINE-1, },
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=K_COMBINE+0, },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=K_COMBINE+1, },  // fn
    { .t=Instr_T,       .x=VM_typeq,    .y=Actor_T,     .z=K_COMBINE+2, },  // fn has type Actor_T
    { .t=Instr_T,       .x=VM_if,       .y=K_COMBINE+12,.z=K_COMBINE+3, },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=K_COMBINE+4, },  // fn
    { .t=Instr_T,       .x=VM_typeq,    .y=Fexpr_T,     .z=K_COMBINE+5, },  // fn has type Fexpr_T
    { .t=Instr_T,       .x=VM_if,       .y=K_COMBINE+9, .z=K_COMBINE+6, },

    { .t=Instr_T,       .x=VM_push,     .y=UNDEF,       .z=K_COMBINE+7, },  // UNDEF
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=K_COMBINE+8, },  // UNDEF cust
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(0),   .z=RELEASE,     },  // (cust . UNDEF)

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=K_COMBINE+10,},  // env opnds cust fn
    { .t=Instr_T,       .x=VM_get,      .y=FLD_X,       .z=K_COMBINE+11,},  // oper = get_x(fn)
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=RELEASE,     },  // (oper cust args env)

// env opnds cust
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=K_COMBINE+13,},  // fn
    { .t=Instr_T,       .x=VM_push,     .y=K_APPLY_F,   .z=K_COMBINE+14,},  // K_APPLY_F
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=K_COMBINE+15,},  // k_apply = (K_APPLY_F cust fn)

#if EVLIS_IS_PAR
    { .t=Instr_T,       .x=VM_push,     .y=_OP_PAR,     .z=K_COMBINE+16,},  // OP_PAR
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=RELEASE,     },  // (OP_PAR k_apply opnds env)
#else
    { .t=Instr_T,       .x=VM_push,     .y=_M_EVLIS,    .z=K_COMBINE+16,},  // M_EVLIS
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=RELEASE,     },  // (M_EVLIS k_apply opnds env)
#endif

/*
            (CALL fn (evlis opnds env))
*/
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=K_APPLY_F-1, },
//  { .t=Instr_T,       .x=VM_push,     .y=_fn_,        .z=K_APPLY_F+0, },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=K_APPLY_F+1, },  // args
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=K_APPLY_F+2, },  // fn args cust
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=K_APPLY_F+3, },  // fn (cust . args)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // (cust . args) fn

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
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_APPLY+2,   },  // fn = arg1
    { .t=Instr_T,       .x=VM_typeq,    .y=Actor_T,     .z=M_APPLY+3,   },  // fn has type Actor_T
    { .t=Instr_T,       .x=VM_if,       .y=M_APPLY+4,   .z=M_APPLY+8,   },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=M_APPLY+5,   },  // args
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=M_APPLY+6,   },  // cust
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_APPLY+7,   },  // (cust . args)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=SEND_0,      },  // fn

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_APPLY+9,   },  // fn = arg1
    { .t=Instr_T,       .x=VM_typeq,    .y=Fexpr_T,     .z=M_APPLY+10,  },  // fn has type Fexpr_T
    { .t=Instr_T,       .x=VM_if,       .y=M_APPLY+11,  .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(4),   .z=M_APPLY+12,  },  // env
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=M_APPLY+13,  },  // args
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=M_APPLY+14,  },  // cust
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_APPLY+15,  },  // fn
    { .t=Instr_T,       .x=VM_get,      .y=FLD_X,       .z=M_APPLY+16,  },  // oper = get_x(fn)
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (oper cust args env)

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
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=M_LOOKUP+2,  },  // env = arg2

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=M_LOOKUP+3,  },  // env env
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=M_LOOKUP+4,  },  // env has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=M_LOOKUP+5,  .z=M_LOOKUP+11, },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=M_LOOKUP+6,  },  // tail head
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=M_LOOKUP+7,  },  // tail value name
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_LOOKUP+8,  },  // key = arg1
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_EQ,      .z=M_LOOKUP+9,  },  // (name == key)
    { .t=Instr_T,       .x=VM_if,       .y=CUST_SEND,   .z=M_LOOKUP+10, },
    { .t=Instr_T,       .x=VM_drop,     .y=TO_FIX(1),   .z=M_LOOKUP+2,  },  // env = tail

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=M_LOOKUP+12, },  // env env
    { .t=Instr_T,       .x=VM_typeq,    .y=Actor_T,     .z=M_LOOKUP+13, },  // env has type Actor_T
    { .t=Instr_T,       .x=VM_if,       .y=M_LOOKUP+14, .z=M_LOOKUP+18, },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_LOOKUP+15, },  // key = arg1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=M_LOOKUP+16, },  // cust = arg0
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_LOOKUP+17, },  // (cust . key)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // (cust . key) env

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_LOOKUP+19, },  // key = arg1
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=M_LOOKUP+20, },  // key key
    { .t=Instr_T,       .x=VM_typeq,    .y=Symbol_T,    .z=M_LOOKUP+21, },  // key has type Symbol_T
    { .t=Instr_T,       .x=VM_if,       .y=M_LOOKUP+22, .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_get,      .y=FLD_Z,       .z=CUST_SEND,   },  // global binding from Symbol_T

/*
(define evlis                           ; map `eval` over a list of operands
  (lambda (opnds env)
    (if (pair? opnds)
      (cons (eval (car opnds) env) (evlis (cdr opnds) env))
      ())))                             ; value is NIL
*/
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=M_EVLIS_P-1, },
//  { .t=Instr_T,       .x=VM_push,     .y=_head_,      .z=M_EVLIS_P+0, },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=M_EVLIS_P+1, },  // tail
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=M_EVLIS_P+2, },  // head
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_EVLIS_P+3, },  // (head . tail)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // cust

//  { .t=Instr_T,       .x=VM_push,     .y=_env_,       .z=M_EVLIS_K-2, },
//  { .t=Instr_T,       .x=VM_push,     .y=_rest_,      .z=M_EVLIS_K-1, },
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=M_EVLIS_K+0, },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=M_EVLIS_K+1, },  // head
    { .t=Instr_T,       .x=VM_push,     .y=M_EVLIS_P,   .z=M_EVLIS_K+2, },  // M_EVLIS_P
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=M_EVLIS_K+3, },  // BECOME (M_EVLIS_P cust head)
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=M_EVLIS_K+4, },  // SELF
    { .t=Instr_T,       .x=VM_push,     .y=_M_EVLIS,    .z=M_EVLIS_K+5, },  // M_EVLIS
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVLIS SELF rest env)

    { .t=Actor_T,       .x=M_EVLIS+1,   .y=NIL,         .z=UNDEF        },  // (cust opnds env)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_EVLIS+2,   },  // opnds = arg1
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=M_EVLIS+3,   },  // opnds has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=M_EVLIS+4,   .z=RV_NIL,      },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=M_EVLIS+5,   },  // env = arg2
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_EVLIS+6,   },  // opnds = arg1
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=M_EVLIS+7,   },  // rest first

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=M_EVLIS+8,   },  // env
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=M_EVLIS+9,   },  // rest
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=M_EVLIS+10,  },  // cust
    { .t=Instr_T,       .x=VM_push,     .y=M_EVLIS_K,   .z=M_EVLIS+11,  },  // M_EVLIS_K
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(3),   .z=M_EVLIS+12,  },  // k_eval = (M_EVLIS_K env rest cust)

    { .t=Instr_T,       .x=VM_push,     .y=_M_EVAL,     .z=M_EVLIS+13,  },  // M_EVAL
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVAL k_eval first env)

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
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_PAR+2,    },  // exprs = opnds
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=OP_PAR+3,    },  // exprs has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=OP_PAR+4,    .z=RV_NIL,      },

    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=OP_PAR+5,    },  // ()
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=OP_PAR+6,    },  // env
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_PAR+7,    },  // exprs = opnds
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(-1),  .z=OP_PAR+8,    },  // cdr(exprs)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(2),   .z=OP_PAR+9,    },  // t_req = (cdr(exprs) env)

    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=OP_PAR+10,   },  // ()
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=OP_PAR+11,   },  // env
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_PAR+12,   },  // exprs = opnds
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=OP_PAR+13,   },  // car(exprs)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(2),   .z=OP_PAR+14,   },  // h_req = (car(exprs) env)

    { .t=Instr_T,       .x=VM_push,     .y=_OP_PAR,     .z=OP_PAR+15,   },  // tail = OP_PAR
    { .t=Instr_T,       .x=VM_push,     .y=_M_EVAL,     .z=OP_PAR+16,   },  // head = M_EVAL
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=OP_PAR+17,   },  // cust
    { .t=Instr_T,       .x=VM_push,     .y=FORK_BEH,    .z=OP_PAR+18,   },  // FORK_BEH
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(3),   .z=OP_PAR+19,   },  // ev_fork = (FORK_BEH OP_PAR M_EVAL cust)

    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(2),   .z=COMMIT,      },  // (ev_fork h_req t_req)

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
//  { .t=Instr_T,       .x=VM_push,     .y=_ys_,        .z=M_ZIP_IT-4,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_xs_,        .z=M_ZIP_IT-3,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_y_,         .z=M_ZIP_IT-2,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_x_,         .z=M_ZIP_IT-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_env_,       .z=M_ZIP_IT+0,  },

// ys xs y x env
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=M_ZIP_IT+1,  },  // x
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=M_ZIP_IT+2,  },  // x has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=M_ZIP_P,     .z=M_ZIP_IT+3,  },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=M_ZIP_IT+4,  },  // x
    { .t=Instr_T,       .x=VM_typeq,    .y=Symbol_T,    .z=M_ZIP_IT+5,  },  // x has type Symbol_T
    { .t=Instr_T,       .x=VM_if,       .y=M_ZIP_IT+6,  .z=M_ZIP_IT+9,  },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=M_ZIP_IT+7,  },  // x
    { .t=Instr_T,       .x=VM_eq,       .y=S_IGNORE,    .z=M_ZIP_IT+8,  },  // (x == '_)
    { .t=Instr_T,       .x=VM_if,       .y=M_ZIP_IT+9,  .z=M_ZIP_S,     },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(4),   .z=M_ZIP_IT+10, },  // xs
    { .t=Instr_T,       .x=VM_eq,       .y=NIL,         .z=M_ZIP_IT+11, },  // (xs == NIL)
    { .t=Instr_T,       .x=VM_if,       .y=CUST_SEND,   .z=M_ZIP_K,     },  // return(env)

// ys xs y x env
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-3),  .z=M_ZIP_K+1,   },  // ys xs env y x
    { .t=Instr_T,       .x=VM_drop,     .y=TO_FIX(2),   .z=M_ZIP_K+2,   },  // ys xs env
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=M_ZIP_K+3,   },  // ys xs env ()
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-4),  .z=M_ZIP_K+4,   },  // () ys xs env
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=M_ZIP_K+5,   },  // () ys xs env ()
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-4),  .z=M_ZIP_IT,    },  // () () ys xs env

/*
        (if (null? (cdr x))
          (zip-it (car x) (car y) xs ys env)
*/
// ys xs y x env
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=M_ZIP_P+1,   },  // x
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(-1),  .z=M_ZIP_P+2,   },  // cdr(x)
    { .t=Instr_T,       .x=VM_eq,       .y=NIL,         .z=M_ZIP_P+3,   },  // (cdr(x) == NIL)
    { .t=Instr_T,       .x=VM_if,       .y=M_ZIP_P+4,   .z=M_ZIP_R,     },

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=M_ZIP_P+5,   },  // ys xs x env y
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=M_ZIP_P+6,   },  // ys xs x env car(y)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=M_ZIP_P+7,   },  // ys xs env car(y) x
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=M_ZIP_P+8,   },  // ys xs env car(y) car(x)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=M_ZIP_IT,    },  // ys xs car(y) car(x) env

/*
          (zip-it (car x) (car y) (cons (cdr x) xs) (cons (cdr y) ys) env)))
*/
// ys xs y x env
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(5),   .z=M_ZIP_R+1,   },  // xs y x env ys
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(4),   .z=M_ZIP_R+2,   },  // xs x env ys y
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=M_ZIP_R+3,   },  // xs x env ys cdr(y) car(y)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-6),  .z=M_ZIP_R+4,   },  // car(y) xs x env ys cdr(y)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_ZIP_R+5,   },  // car(y) xs x env (cdr(y) . ys)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-5),  .z=M_ZIP_R+6,   },  // (cdr(y) . ys) car(y) xs x env
// ys' y' xs x env
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-3),  .z=M_ZIP_R+7,   },  // ys' y' env xs x
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=M_ZIP_R+8,   },  // ys' y' env xs cdr(x) car(x)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-4),  .z=M_ZIP_R+9,   },  // ys' y' car(x) env xs cdr(x)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_ZIP_R+10,  },  // ys' y' car(x) env (cdr(x) . xs)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-4),  .z=M_ZIP_IT,    },  // ys' (cdr(x) . xs) y' car(x) env

/*
        (zip-it xs ys () () (cons (cons x y) env)))
*/
// ys xs y x env
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-3),  .z=M_ZIP_S+1,   },  // ys xs env y x
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_ZIP_S+2,   },  // ys xs env (x . y)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_ZIP_S+3,   },  // ys xs ((x . y) . env)
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=M_ZIP_S+4,   },  // ys xs env' ()
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-4),  .z=M_ZIP_S+5,   },  // () ys xs env'
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=M_ZIP_S+6,   },  // () ys xs env' ()
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-4),  .z=M_ZIP_IT,    },  // () () ys xs env'

/*
(define zip                             ; extend `env` by binding names `x` to values `y`
  (lambda (x y env)
    (zip-it x y () () env)))
*/
    { .t=Actor_T,       .x=M_ZIP+1,     .y=NIL,         .z=UNDEF        },  // (cust x y env)
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=M_ZIP+2,     },  // ys = ()
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=M_ZIP+3,     },  // xs = ()
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=M_ZIP+4,     },  // y = arg2
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_ZIP+5,     },  // x = arg1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(4),   .z=M_ZIP_IT,    },  // env = arg3

/*
(define closure-beh                     ; lexically-bound applicative procedure
  (lambda (frml body env)
    (BEH (cust . args)
      (SEND cust
        (evbody #unit body (zip frml args (scope env)))))))
*/
//  { .t=Instr_T,       .x=VM_push,     .y=_frml_,      .z=CLOSURE_B-2, },
//  { .t=Instr_T,       .x=VM_push,     .y=_body_,      .z=CLOSURE_B-1, },
//  { .t=Instr_T,       .x=VM_push,     .y=_env_,       .z=CLOSURE_B+0, },
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=CLOSURE_B+1, },  // env
    { .t=Instr_T,       .x=VM_push,     .y=UNDEF,       .z=CLOSURE_B+2, },  // #?
    { .t=Instr_T,       .x=VM_push,     .y=S_IGNORE,    .z=CLOSURE_B+3, },  // '_
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=CLOSURE_B+4, },  // ('_ . #?)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=CLOSURE_B+5, },  // env' = (('_ . #?) . env)

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=CLOSURE_B+6, },  // args
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(5),   .z=CLOSURE_B+7, },  // frml

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=CLOSURE_B+8, },  // cust
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(6),   .z=CLOSURE_B+9, },  // body
    { .t=Instr_T,       .x=VM_push,     .y=M_EVAL_B,    .z=CLOSURE_B+10,},  // M_EVAL_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=CLOSURE_B+11,},  // k_eval = (M_EVAL_B cust body)

    { .t=Instr_T,       .x=VM_push,     .y=_M_ZIP,      .z=CLOSURE_B+12,},  // M_ZIP
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(4),   .z=COMMIT,      },  // (M_ZIP k_eval frml args env')

//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=M_EVAL_B-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_body_,      .z=M_EVAL_B-0,  },
    { .t=Instr_T,       .x=VM_push,     .y=UNIT,        .z=M_EVAL_B+1,  },  // UNIT
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-3),  .z=M_EVAL_B+2,  },  // #unit cust body

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=M_EVAL_B+3,  },  // env
    { .t=Instr_T,       .x=VM_push,     .y=K_SEQ_B,     .z=M_EVAL_B+4,  },  // K_SEQ_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(3),   .z=SEND_0,      },  // k-seq = (K_SEQ_B cust body env)

/*
(define fexpr-beh                       ; lexically-bound operative procedure
  (lambda (frml body senv)
    (BEH (cust opnds denv)
      (SEND cust
        (evbody #unit body (zip frml (cons denv opnds) (scope senv)))))))
*/
//  { .t=Instr_T,       .x=VM_push,     .y=_frml_,      .z=FEXPR_B-2,   },
//  { .t=Instr_T,       .x=VM_push,     .y=_body_,      .z=FEXPR_B-1,   },
//  { .t=Instr_T,       .x=VM_push,     .y=_senv_,      .z=FEXPR_B+0,   },
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=FEXPR_B+1,   },  // senv
    { .t=Instr_T,       .x=VM_push,     .y=UNDEF,       .z=FEXPR_B+2,   },  // #?
    { .t=Instr_T,       .x=VM_push,     .y=S_IGNORE,    .z=FEXPR_B+3,   },  // '_
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=FEXPR_B+4,   },  // ('_ . #?)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=FEXPR_B+5,   },  // env' = (('_ . #?) . senv)

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=FEXPR_B+6,   },  // opnds
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=FEXPR_B+7,   },  // denv
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=FEXPR_B+8,   },  // opnds' = (denv . opnds)

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(5),   .z=FEXPR_B+9,   },  // frml'

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=FEXPR_B+10,  },  // cust
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(6),   .z=FEXPR_B+11,  },  // body
    { .t=Instr_T,       .x=VM_push,     .y=M_EVAL_B,    .z=FEXPR_B+12,  },  // M_EVAL_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=FEXPR_B+13,  },  // k_eval = (M_EVAL_B cust body)

    { .t=Instr_T,       .x=VM_push,     .y=_M_ZIP,      .z=FEXPR_B+14,  },  // M_ZIP
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(4),   .z=COMMIT,      },  // (M_ZIP k_eval frml' opnds' env')

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
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=K_SEQ_B-2,   },
//  { .t=Instr_T,       .x=VM_push,     .y=_body_,      .z=K_SEQ_B-1,   },
//  { .t=Instr_T,       .x=VM_push,     .y=_env_,       .z=K_SEQ_B+0,   },
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=K_SEQ_B+1,   },  // body
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=K_SEQ_B+2,   },  // body has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=K_SEQ_B+5,   .z=K_SEQ_B+3,   },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=K_SEQ_B+4,   },  // value
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(4),   .z=RELEASE_0,   },  // (cust . value)

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=K_SEQ_B+6,   },  // cust env body
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=K_SEQ_B+7,   },  // rest first

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=K_SEQ_B+8,   },  // env
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=K_SEQ_B+9,   },  // expr = first
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=K_SEQ_B+10,  },  // cust = SELF
    { .t=Instr_T,       .x=VM_push,     .y=_M_EVAL,     .z=K_SEQ_B+11,  },  // M_EVAL
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=K_SEQ_B+12,  },  // (M_EVAL SELF first env)

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-2),  .z=K_SEQ_B+13,  },  // cust rest env
    { .t=Instr_T,       .x=VM_push,     .y=K_SEQ_B,     .z=K_SEQ_B+14,  },  // K_SEQ_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(3),   .z=COMMIT,      },  // BECOME (K_SEQ_B cust rest env)

/*
(define evalif                          ; if `test` is #f, evaluate `altn`,
  (lambda (test cnsq altn env)          ; otherwise evaluate `cnsq`.
    (if test
      (eval cnsq env)
      (eval altn env))))
*/
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=M_IF_K-2,    },
//  { .t=Instr_T,       .x=VM_push,     .y=_env_,       .z=M_IF_K-1,    },
//  { .t=Instr_T,       .x=VM_push,     .y=_cont_,      .z=M_IF_K+0,    },  // (cnsq altn)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=M_IF_K+1,    },  // bool
    { .t=Instr_T,       .x=VM_if,       .y=M_IF_K+2,    .z=M_IF_K+3,    },

    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=M_IF_K+4,    },  // cnsq

    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(2),   .z=M_IF_K+4,    },  // altn

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=M_IF_K+5,    },  // cust
    { .t=Instr_T,       .x=VM_push,     .y=_M_EVAL,     .z=M_IF_K+6,    },  // M_EVAL
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=RELEASE,     },  // (M_EVAL cust cnsq/altn env)

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
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(4),   .z=M_BIND_E+2,  },  // env = arg3

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=M_BIND_E+3,  },  // env env
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=M_BIND_E+4,  },  // env has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=M_BIND_E+5,  .z=M_BIND_E+25, },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=M_BIND_E+6,  },  // env env
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=M_BIND_E+7,  },  // cdr(env) car(env)
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=M_BIND_E+8,  },  // car(env) car(env)
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=M_BIND_E+9,  },  // caar(env)
    { .t=Instr_T,       .x=VM_eq,       .y=S_IGNORE,    .z=M_BIND_E+10, },  // (caar(env) == '_)
    { .t=Instr_T,       .x=VM_if,       .y=M_BIND_E+11, .z=M_BIND_E+17, },

    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_BIND_E+12, },  // (car(env) . cdr(env))
    { .t=Instr_T,       .x=VM_set,      .y=FLD_Y,       .z=M_BIND_E+13, },  // set-cdr

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=M_BIND_E+14, },  // val = arg2
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_BIND_E+15, },  // key = arg1
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=M_BIND_E+16, },  // (key . val)
    { .t=Instr_T,       .x=VM_set,      .y=FLD_X,       .z=RV_UNIT,     },  // set-car

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=M_BIND_E+18, },  // car(env) car(env)
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=M_BIND_E+19, },  // caar(env)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_BIND_E+20, },  // key = arg1
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_EQ,      .z=M_BIND_E+21, },  // (caar(env) == key)
    { .t=Instr_T,       .x=VM_if,       .y=M_BIND_E+22, .z=M_BIND_E+24, },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=M_BIND_E+23, },  // val = arg2
    { .t=Instr_T,       .x=VM_set,      .y=FLD_Y,       .z=RV_UNIT,     },  // set-cdr

    { .t=Instr_T,       .x=VM_drop,     .y=TO_FIX(1),   .z=M_BIND_E+2,  },  // (bind-env key val (cdr env))

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_BIND_E+26, },  // key = arg1
    { .t=Instr_T,       .x=VM_typeq,    .y=Symbol_T,    .z=M_BIND_E+27, },  // key has type Symbol_T
    { .t=Instr_T,       .x=VM_if,       .y=M_BIND_E+28, .z=RV_UNIT,     },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=M_BIND_E+29, },  // key = arg1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=M_BIND_E+30, },  // val = arg2
    { .t=Instr_T,       .x=VM_set,      .y=FLD_Z,       .z=RV_UNIT,     },  // bind(key, val)

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
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_QUOTE+2,  },  // opnds
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=CUST_SEND,   },  // form = car(opnds)

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
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_LAMBDA+2, },  // opnds
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=OP_LAMBDA+3, },  // frml = car(opnds)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_LAMBDA+4, },  // opnds
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(-1),  .z=OP_LAMBDA+5, },  // body = cdr(opnds)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=OP_LAMBDA+6, },  // env
    { .t=Instr_T,       .x=VM_push,     .y=CLOSURE_B,   .z=OP_LAMBDA+7, },  // CLOSURE_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(3),   .z=CUST_SEND,   },  // closure = (CLOSURE_B frml body env)

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
    { .t=Instr_T,       .x=VM_push,     .y=Fexpr_T,     .z=OP_VAU+2,    },  // Fexpr_T

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_VAU+3,    },  // opnds
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=OP_VAU+4,    },  // frml = car(opnds)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_VAU+5,    },  // opnds
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(2),   .z=OP_VAU+6,    },  // evar = cadr(opnds)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=OP_VAU+7,    },  // frml' = (evar . frml)

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_VAU+8,    },  // opnds
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(-2),  .z=OP_VAU+9,    },  // body = cddr(opnds)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=OP_VAU+10,   },  // senv = env
    { .t=Instr_T,       .x=VM_push,     .y=FEXPR_B,     .z=OP_VAU+11,   },  // FEXPR_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(3),   .z=OP_VAU+12,   },  // oper = (FEXPR_B frml' body senv)

    { .t=Instr_T,       .x=VM_cell,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // fexpr = {t:Fexpr_T, x:oper}

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
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=K_DEFINE_B-2,},
//  { .t=Instr_T,       .x=VM_push,     .y=_env_,       .z=K_DEFINE_B-1,},
//  { .t=Instr_T,       .x=VM_push,     .y=_frml_,      .z=K_DEFINE_B+0,},
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=K_DEFINE_B+1,},  // ()
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=K_DEFINE_B+2,},  // value
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=K_DEFINE_B+3,},  // frml
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=K_DEFINE_B+4,},  // SELF
    { .t=Instr_T,       .x=VM_push,     .y=_M_ZIP,      .z=K_DEFINE_B+5,},  // M_ZIP
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(4),   .z=K_DEFINE_B+6,},  // (M_ZIP SELF frml value NIL)

    { .t=Instr_T,       .x=VM_push,     .y=K_DZIP_B,    .z=K_DEFINE_B+7,},  // K_DZIP_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=COMMIT,      },  // BECOME (K_DZIP_B cust env)
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
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=K_DZIP_B-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_env_,       .z=K_DZIP_B+0,  },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=K_DZIP_B+1,  },  // alist
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=K_DZIP_B+2,  },  // alist has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=K_DZIP_B+6,  .z=K_DZIP_B+3,  },

    { .t=Instr_T,       .x=VM_push,     .y=UNIT,        .z=K_DZIP_B+4,  },  // #unit
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=K_DZIP_B+5,  },  // cust
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(0),   .z=RELEASE,     },  // (cust UNIT)

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=K_DZIP_B+7,  },  // alist
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=K_DZIP_B+8,  },  // rest first
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=K_DZIP_B+9,  },  // value symbol
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(4),   .z=K_DZIP_B+10, },  // env
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-3),  .z=K_DZIP_B+11, },  // rest env value symbol
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=K_DZIP_B+12, },  // SELF
    { .t=Instr_T,       .x=VM_push,     .y=_M_BIND_E,   .z=K_DZIP_B+13, },  // M_BIND_E
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(4),   .z=K_DZIP_B+14, },  // (M_BIND_E SELF symbol value env)

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(-2),  .z=K_DZIP_B+15, },  // cust rest env
    { .t=Instr_T,       .x=VM_push,     .y=K_BIND_B,    .z=K_DZIP_B+16, },  // K_BIND_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(3),   .z=COMMIT,      },  // BECOME (K_BIND_B cust rest env)
/*
(define k-bind-beh
  (lambda (cust alist env)
    (BEH _
      (BECOME (k-defzip-beh cust env))
      (SEND SELF alist) )))
*/
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=K_BIND_B-2,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_alist_,     .z=K_BIND_B-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_env_,       .z=K_BIND_B+0,  },
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=K_BIND_B+1,  },  // alist
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=K_BIND_B+2,  },  // SELF
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(0),   .z=K_BIND_B+3,  },  // (SELF alist)

    { .t=Instr_T,       .x=VM_push,     .y=K_DZIP_B,    .z=K_BIND_B+4,  },  // K_DZIP_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=COMMIT,      },  // BECOME (K_DZIP_B cust env)

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
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=OP_DEFINE+2, },  // env
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_DEFINE+3, },  // opnds
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(2),   .z=OP_DEFINE+4, },  // expr = cadr(opnds)

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=OP_DEFINE+5, },  // cust
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=OP_DEFINE+6, },  // env
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_DEFINE+7, },  // opnds
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=OP_DEFINE+8, },  // frml = car(opnds)
    { .t=Instr_T,       .x=VM_push,     .y=K_DEFINE_B,  .z=OP_DEFINE+9, },  // K_DEFINE_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(3),   .z=OP_DEFINE+10,},  // k_define = (K_DEFINE_B cust env frml)

    { .t=Instr_T,       .x=VM_push,     .y=_M_EVAL,     .z=OP_DEFINE+11,},  // M_EVAL
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVAL k_define expr env)

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
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=OP_IF+2,     },  // env
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_IF+3,     },  // opnds
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=OP_IF+4,     },  // (cnsq altn) pred

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=OP_IF+5,     },  // cust
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=OP_IF+6,     },  // env
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(4),   .z=OP_IF+7,     },  // cont = (cnsq altn)
    { .t=Instr_T,       .x=VM_push,     .y=M_IF_K,      .z=OP_IF+8,     },  // M_IF_K
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(3),   .z=OP_IF+9,     },  // k_if = (M_IF_K cust env cont)

    { .t=Instr_T,       .x=VM_push,     .y=_M_EVAL,     .z=OP_IF+10,    },  // M_EVAL
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVAL k_if pred env)

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
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_COND+2,   },  // opnds
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=OP_COND+3,   },  // opnds has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=OP_COND+4,   .z=RV_UNDEF,    },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_COND+5,   },  // opnds
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=OP_COND+6,   },  // rest first
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=OP_COND+7,   },  // rest body test

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=OP_COND+8,   },  // env
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=OP_COND+9,   },  // env test

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=OP_COND+10,  },  // cust
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(4),   .z=OP_COND+11,  },  // rest env test cust body
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=OP_COND+12,  },  // env
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(6),   .z=OP_COND+13,  },  // opnds' = rest
    { .t=Instr_T,       .x=VM_push,     .y=K_COND,      .z=OP_COND+14,  },  // K_COND
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(4),   .z=OP_COND+15,  },  // k_cond = (K_COND cust body env opnds')

    { .t=Instr_T,       .x=VM_push,     .y=_M_EVAL,     .z=OP_COND+16,  },  // M_EVAL
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=COMMIT,      },  // (M_EVAL k_cond test env)

//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=K_COND-3,    },
//  { .t=Instr_T,       .x=VM_push,     .y=_body_,      .z=K_COND-2,    },
//  { .t=Instr_T,       .x=VM_push,     .y=_env_,       .z=K_COND+0,    },
//  { .t=Instr_T,       .x=VM_push,     .y=_opnds_,     .z=K_COND-1,    },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=K_COND+1,    },  // test_result
    { .t=Instr_T,       .x=VM_if,       .y=K_COND+2,    .z=K_COND+7,    },

    { .t=Instr_T,       .x=VM_drop,     .y=TO_FIX(1),   .z=K_COND+3,    },  // cust body env
    { .t=Instr_T,       .x=VM_push,     .y=K_SEQ_B,     .z=K_COND+4,    },  // K_SEQ_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(3),   .z=K_COND+5,    },  // BECOME (K_SEQ_B cust body env)

    { .t=Instr_T,       .x=VM_push,     .y=UNIT,        .z=K_COND+6,    },  // UNIT
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=SEND_0,      },  // (SELF . UNIT)

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(4),   .z=K_COND+8,    },  // body env opnds cust
    { .t=Instr_T,       .x=VM_push,     .y=_OP_COND,    .z=K_COND+9,    },  // OP_COND
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(3),   .z=RELEASE,     },  // (OP_COND cust opnds env)

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
    { .t=Instr_T,       .x=VM_push,     .y=UNIT,        .z=OP_SEQ+2,    },  // UNIT

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=OP_SEQ+3,    },  // cust
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=OP_SEQ+4,    },  // body = opnds
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=OP_SEQ+5,    },  // env
    { .t=Instr_T,       .x=VM_push,     .y=K_SEQ_B,     .z=OP_SEQ+6,    },  // K_SEQ_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(3),   .z=SEND_0,      },  // k-seq = (K_SEQ_B cust opnds env)

#define SCHEME_END (OP_SEQ+7)
