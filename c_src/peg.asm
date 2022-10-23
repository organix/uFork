#ifndef PEG_BASE
#error PEG_BASE required.
#endif

//
// Parsing Expression Grammar (PEG) behaviors
//

#define G_EMPTY (PEG_BASE)
#define _G_EMPTY TO_CAP(G_EMPTY)
    { .t=Actor_T,       .x=G_EMPTY+1,   .y=NIL,         .z=UNDEF        },
#define G_EMPTY_B (G_EMPTY+1)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=G_EMPTY+2,   },  // in
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=G_EMPTY+3,   },  // ()
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_EMPTY+4,   },  // (() . in)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=G_EMPTY+5,   },  // custs = (ok . fail)
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=SEND_0,      },  // ok = car(custs)

#define G_FAIL (G_EMPTY+6)
#define _G_FAIL TO_CAP(G_FAIL)
    { .t=Actor_T,       .x=G_FAIL+1,    .y=NIL,         .z=UNDEF        },
#define G_FAIL_B (G_FAIL+1)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=G_FAIL+2,    },  // in
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=G_FAIL+3,    },  // custs = (ok . fail)
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(-1),  .z=SEND_0,      },  // fail = cdr(custs)

#define G_NEXT_K (G_FAIL+4)
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=G_NEXT_K-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_value_,     .z=G_NEXT_K+0,  },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=G_NEXT_K+1,  },  // in
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=G_NEXT_K+2,  },  // value
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_NEXT_K+3,  },  // (value . in)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // cust

#define G_ANY (G_NEXT_K+4)
#define _G_ANY TO_CAP(G_ANY)
    { .t=Actor_T,       .x=G_ANY+1,     .y=NIL,         .z=UNDEF        },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=G_ANY+2,     },  // custs = (ok . fail)
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_ANY+3,     },  // fail ok
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=G_ANY+4,     },  // in
    { .t=Instr_T,       .x=VM_eq,       .y=NIL,         .z=G_ANY+5,     },  // in == ()
    { .t=Instr_T,       .x=VM_if,       .y=G_ANY+13,    .z=G_ANY+6,     },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=G_ANY+7,     },  // in
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_ANY+8,     },  // next token
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=G_ANY+9,     },  // ok
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=G_ANY+10,    },  // token
    { .t=Instr_T,       .x=VM_push,     .y=G_NEXT_K,    .z=G_ANY+11,    },  // G_NEXT_K
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=G_ANY+12,    },  // k_next
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // next

    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=G_ANY+14,    },  // ()
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // fail

#define G_EQ_B (G_ANY+15)
//  { .t=Instr_T,       .x=VM_push,     .y=_value_,     .z=G_EQ_B+0,    },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=G_EQ_B+1,    },  // custs = (ok . fail)
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_EQ_B+2,    },  // fail ok
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=G_EQ_B+3,    },  // in
    { .t=Instr_T,       .x=VM_eq,       .y=NIL,         .z=G_EQ_B+4,    },  // in == ()
    { .t=Instr_T,       .x=VM_if,       .y=G_EQ_B+17,   .z=G_EQ_B+5,    },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=G_EQ_B+6,    },  // in
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_EQ_B+7,    },  // next token
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=G_EQ_B+8,    },  // token token
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(6),   .z=G_EQ_B+9,    },  // value
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_NE,      .z=G_EQ_B+10,   },  // token != value
    { .t=Instr_T,       .x=VM_if,       .y=G_EQ_B+16,   .z=G_EQ_B+11,   },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=G_EQ_B+12,   },  // ok
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=G_EQ_B+13,   },  // token
    { .t=Instr_T,       .x=VM_push,     .y=G_NEXT_K,    .z=G_EQ_B+14,   },  // G_NEXT_K
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=G_EQ_B+15,   },  // k_next
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // next

    { .t=Instr_T,       .x=VM_drop,     .y=TO_FIX(2),   .z=G_EQ_B+17,   },  // fail ok

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=G_EQ_B+18,   },  // in
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // fail

#define G_FAIL_K (G_EQ_B+19)
//  { .t=Instr_T,       .x=VM_push,     .y=_msg_,       .z=G_FAIL_K-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=G_FAIL_K+0,  },
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(0),   .z=RELEASE,     },  // (cust . msg)

#define G_OR_B (G_FAIL_K+1)
//  { .t=Instr_T,       .x=VM_push,     .y=_first_,     .z=G_OR_B-1,    },
//  { .t=Instr_T,       .x=VM_push,     .y=_rest_,      .z=G_OR_B+0,    },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=G_OR_B+1,    },  // resume = (value . in)

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=G_OR_B+2,    },  // msg = (custs value . in)
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=G_OR_B+3,    },  // cust = rest
    { .t=Instr_T,       .x=VM_push,     .y=G_FAIL_K,    .z=G_OR_B+4,    },  // G_FAIL_K
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=G_OR_B+5,    },  // or_fail

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=G_OR_B+6,    },  // custs
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=G_OR_B+7,    },  // ok = car(custs)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_OR_B+8,    },  // (ok . or_fail)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_OR_B+9,    },  // ((ok . or_fail) . resume)

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // first

#define G_AND_PR (G_OR_B+10)
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=G_AND_PR-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_head_,      .z=G_AND_PR+0,  },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=G_AND_PR+1,  },  // (value . in)
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_AND_PR+2,  },  // in tail
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=G_AND_PR+3,  },  // head
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_AND_PR+4,  },  // (head . tail)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_AND_PR+5,  },  // ((head . tail) . in)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // cust
#define G_AND_OK (G_AND_PR+6)
//  { .t=Instr_T,       .x=VM_push,     .y=_rest_,      .z=G_AND_OK-2,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_and_fail_,  .z=G_AND_OK-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_ok_,        .z=G_AND_OK+0,  },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=G_AND_OK+1,  },  // head = value
    { .t=Instr_T,       .x=VM_push,     .y=G_AND_PR,    .z=G_AND_OK+2,  },  // G_AND_PR
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=G_AND_OK+3,  },  // BECOME (G_AND_PR ok value)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=G_AND_OK+4,  },  // resume = (value . in)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=G_AND_OK+5,  },  // and_fail
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=G_AND_OK+6,  },  // and_pair = SELF
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_AND_OK+7,  },  // (and_pair . and_fail)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_AND_OK+8,  },  // ((and_pair . and_fail) . resume)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // rest
#define G_AND_B (G_AND_OK+9)
//  { .t=Instr_T,       .x=VM_push,     .y=_first_,     .z=G_AND_B-1,   },
//  { .t=Instr_T,       .x=VM_push,     .y=_rest_,      .z=G_AND_B+0,   },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=G_AND_B+1,   },  // resume = (value . in)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=G_AND_B+2,   },  // custs
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(-1),  .z=G_AND_B+3,   },  // fail = cdr(custs)

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=G_AND_B+4,   },  // rest

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=G_AND_B+5,   },  // msg = in
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=G_AND_B+6,   },  // cust = fail
    { .t=Instr_T,       .x=VM_push,     .y=G_FAIL_K,    .z=G_AND_B+7,   },  // G_FAIL_K
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=G_AND_B+8,   },  // and_fail = (G_FAIL_K in fail)

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=G_AND_B+9,   },  // custs
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=G_AND_B+10,  },  // ok = car(custs)
    { .t=Instr_T,       .x=VM_push,     .y=G_AND_OK,    .z=G_AND_B+11,  },  // G_AND_OK
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(3),   .z=G_AND_B+12,  },  // and_ok = (G_AND_OK rest and_fail ok)

    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_AND_B+13,  },  // (and_ok . fail)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_AND_B+14,  },  // ((and_ok . fail) . resume)
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // first

#define G_NOT_B (G_AND_B+15)
//  { .t=Instr_T,       .x=VM_push,     .y=_ptrn_,      .z=G_NOT_B+0,   },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=G_NOT_B+1,   },  // custs
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_NOT_B+2,   },  // fail ok

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=G_NOT_B+3,   },  // in
    { .t=Instr_T,       .x=VM_push,     .y=UNIT,        .z=G_NOT_B+4,   },  // value = UNIT
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_NOT_B+5,   },  // ctx = (#unit . in)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=G_NOT_B+6,   },  // ok
    { .t=Instr_T,       .x=VM_push,     .y=RELEASE_0,   .z=G_NOT_B+7,   },  // RELEASE_0
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=G_NOT_B+8,   },  // fail' = (RELEASE_0 ctx ok)

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=G_NOT_B+9,   },  // in
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=G_NOT_B+10,  },  // fail
    { .t=Instr_T,       .x=VM_push,     .y=RELEASE_0,   .z=G_NOT_B+11,  },  // RELEASE_0
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=G_NOT_B+12,  },  // ok' = (RELEASE_0 in fail)

    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_NOT_B+13,  },  // custs' = (ok' . fail')
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=G_NOT_B+14,  },  // ctx = (value . in)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=G_NOT_B+15,  },  // ctx custs'
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_NOT_B+16,  },  // msg = (custs' value . in)
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=SEND_0,      },  // ptrn

/*
Optional(pattern) = Or(And(pattern, Empty), Empty)
Plus(pattern) = And(pattern, Star(pattern))
Star(pattern) = Or(Plus(pattern), Empty)
*/
#define G_OPT_B (G_NOT_B+17)
#define G_PLUS_B (G_OPT_B+6)
#define G_STAR_B (G_PLUS_B+5)
//  { .t=Instr_T,       .x=VM_push,     .y=_ptrn_,      .z=G_OPT_B+0,   },
    { .t=Instr_T,       .x=VM_push,     .y=_G_EMPTY,    .z=G_OPT_B+1,   },  // G_EMPTY
    { .t=Instr_T,       .x=VM_push,     .y=G_AND_B,     .z=G_OPT_B+2,   },  // G_AND_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=G_OPT_B+3,   },  // ptrn' = (And ptrn Empty)
    { .t=Instr_T,       .x=VM_push,     .y=_G_EMPTY,    .z=G_OPT_B+4,   },  // G_EMPTY
    { .t=Instr_T,       .x=VM_push,     .y=G_OR_B,      .z=G_OPT_B+5,   },  // G_OR_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=RESEND,      },  // BECOME (Or ptrn' Empty)

//  { .t=Instr_T,       .x=VM_push,     .y=_ptrn_,      .z=G_PLUS_B+0,  },
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=G_PLUS_B+1,  },  // ptrn
    { .t=Instr_T,       .x=VM_push,     .y=G_STAR_B,    .z=G_PLUS_B+2,  },  // G_STAR_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=G_PLUS_B+3,  },  // star = (Star ptrn)
    { .t=Instr_T,       .x=VM_push,     .y=G_AND_B,     .z=G_PLUS_B+4,  },  // G_AND_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=RESEND,      },  // BECOME (And ptrn star)

//  { .t=Instr_T,       .x=VM_push,     .y=_ptrn_,      .z=G_STAR_B+0,  },
    { .t=Instr_T,       .x=VM_push,     .y=G_PLUS_B,    .z=G_STAR_B+1,  },  // G_PLUS_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=G_STAR_B+2,  },  // plus = (Plus ptrn)
    { .t=Instr_T,       .x=VM_push,     .y=_G_EMPTY,    .z=G_STAR_B+3,  },  // G_EMPTY
    { .t=Instr_T,       .x=VM_push,     .y=G_OR_B,      .z=G_STAR_B+4,  },  // G_OR_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=RESEND,      },  // BECOME (Or plus Empty)

#define G_ALT_B (G_STAR_B+5)
//  { .t=Instr_T,       .x=VM_push,     .y=_ptrns_,     .z=G_ALT_B+0,   },
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=G_ALT_B+1,   },  // ptrns
    { .t=Instr_T,       .x=VM_eq,       .y=NIL,         .z=G_ALT_B+2,   },  // ptrns == ()
    { .t=Instr_T,       .x=VM_if,       .y=G_ALT_B+13,  .z=G_ALT_B+3,   },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_ALT_B+4,   },  // tail head
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=G_ALT_B+5,   },  // tail
    { .t=Instr_T,       .x=VM_eq,       .y=NIL,         .z=G_ALT_B+6,   },  // tail == ()
    { .t=Instr_T,       .x=VM_if,       .y=G_ALT_B+10,  .z=G_ALT_B+7,   },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=G_ALT_B+8,   },  // tail
    { .t=Instr_T,       .x=VM_push,     .y=G_ALT_B,     .z=G_ALT_B+9,   },  // G_ALT_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=G_ALT_B+11,  },  // rest = (Alt tail)

    { .t=Instr_T,       .x=VM_push,     .y=_G_FAIL,     .z=G_ALT_B+11,  },  // rest = G_FAIL
    { .t=Instr_T,       .x=VM_push,     .y=G_OR_B,      .z=G_ALT_B+12,  },  // G_OR_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=RESEND,      },  // BECOME

    { .t=Instr_T,       .x=VM_push,     .y=G_FAIL_B,    .z=G_ALT_B+14,  },  // G_FAIL_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(0),   .z=RESEND,      },  // BECOME

#define G_SEQ_B (G_ALT_B+15)
//  { .t=Instr_T,       .x=VM_push,     .y=_ptrns_,     .z=G_SEQ_B+0,   },
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=G_SEQ_B+1,   },  // ptrns
    { .t=Instr_T,       .x=VM_eq,       .y=NIL,         .z=G_SEQ_B+2,   },  // ptrns == ()
    { .t=Instr_T,       .x=VM_if,       .y=G_SEQ_B+13,  .z=G_SEQ_B+3,   },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_SEQ_B+4,   },  // tail head
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=G_SEQ_B+5,   },  // tail
    { .t=Instr_T,       .x=VM_eq,       .y=NIL,         .z=G_SEQ_B+6,   },  // tail == ()
    { .t=Instr_T,       .x=VM_if,       .y=G_SEQ_B+10,  .z=G_SEQ_B+7,   },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=G_SEQ_B+8,   },  // tail
    { .t=Instr_T,       .x=VM_push,     .y=G_SEQ_B,     .z=G_SEQ_B+9,   },  // G_SEQ_B
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(1),   .z=G_SEQ_B+11,  },  // rest = (Seq tail)

    { .t=Instr_T,       .x=VM_push,     .y=_G_EMPTY,    .z=G_SEQ_B+11,  },  // rest = G_EMPTY
    { .t=Instr_T,       .x=VM_push,     .y=G_AND_B,     .z=G_SEQ_B+12,  },  // G_AND_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=RESEND,      },  // BECOME

    { .t=Instr_T,       .x=VM_push,     .y=G_EMPTY_B,   .z=G_SEQ_B+14,  },  // G_EMPTY_B
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(0),   .z=RESEND,      },  // BECOME

#define G_CLS_B (G_SEQ_B+15)
//  { .t=Instr_T,       .x=VM_push,     .y=_class_,     .z=G_CLS_B+0,   },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=G_CLS_B+1,   },  // custs = (ok . fail)
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_CLS_B+2,   },  // fail ok
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=G_CLS_B+3,   },  // in
    { .t=Instr_T,       .x=VM_eq,       .y=NIL,         .z=G_CLS_B+4,   },  // in == ()
    { .t=Instr_T,       .x=VM_if,       .y=G_CLS_B+18,  .z=G_CLS_B+5,   },

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=G_CLS_B+6,   },  // in
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_CLS_B+7,   },  // next token
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=G_CLS_B+8,   },  // token token
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(6),   .z=G_CLS_B+9,   },  // class
    { .t=Instr_T,       .x=VM_cmp,      .y=CMP_CLS,     .z=G_CLS_B+10,  },  // token in class
    { .t=Instr_T,       .x=VM_eq,       .y=FALSE,       .z=G_CLS_B+11,  },  // token ~in class
    { .t=Instr_T,       .x=VM_if,       .y=G_CLS_B+17,  .z=G_CLS_B+12,  },

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=G_CLS_B+13,  },  // ok
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=G_CLS_B+14,  },  // token
    { .t=Instr_T,       .x=VM_push,     .y=G_NEXT_K,    .z=G_CLS_B+15,  },  // G_NEXT_K
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=G_CLS_B+16,  },  // k_next
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // next

    { .t=Instr_T,       .x=VM_drop,     .y=TO_FIX(2),   .z=G_CLS_B+18,  },  // fail ok

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-2),  .z=G_CLS_B+19,  },  // in
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=SEND_0,      },  // fail

#define G_PRED_K (G_CLS_B+20)
//  { .t=Instr_T,       .x=VM_push,     .y=_more_,      .z=G_PRED_K-1,  },  // (value' . in')
//  { .t=Instr_T,       .x=VM_push,     .y=_msg0_,      .z=G_PRED_K+0,  },  // ((ok . fail) value . in)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=G_PRED_K+1,  },  // cond
    { .t=Instr_T,       .x=VM_if,       .y=G_PRED_K+5,  .z=G_PRED_K+2,  },

    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_PRED_K+3,  },  // resume custs
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_PRED_K+4,  },  // resume fail ok
    { .t=Instr_T,       .x=VM_drop,     .y=TO_FIX(1),   .z=RELEASE_0,   },  // resume fail

    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=G_PRED_K+6,  },  // custs = (ok . fail)
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(1),   .z=RELEASE_0,   },  // ok

#define G_PRED_OK (G_PRED_K+7)
//  { .t=Instr_T,       .x=VM_push,     .y=_msg0_,      .z=G_PRED_OK-1, },
//  { .t=Instr_T,       .x=VM_push,     .y=_pred_,      .z=G_PRED_OK+0, },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=G_PRED_OK+1, },  // value

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=G_PRED_OK+2, },  // more
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(4),   .z=G_PRED_OK+3, },  // msg0
    { .t=Instr_T,       .x=VM_push,     .y=G_PRED_K,    .z=G_PRED_OK+4, },  // G_PRED_K
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=G_PRED_OK+5, },  // BECOME (G_PRED_K more msg0)
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=G_PRED_OK+6, },  // k_pred = SELF

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=G_PRED_OK+7, },  // pred
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(2),   .z=COMMIT,      },  // (pred k_pred value)

#define G_PRED_B (G_PRED_OK+8)
//  { .t=Instr_T,       .x=VM_push,     .y=_pred_,      .z=G_PRED_B-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_ptrn_,      .z=G_PRED_B+0,  },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=G_PRED_B+1,  },  // (custs . resume)
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_PRED_B+2,  },  // resume custs
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_PRED_B+3,  },  // fail ok
    { .t=Instr_T,       .x=VM_drop,     .y=TO_FIX(1),   .z=G_PRED_B+4,  },  // fail

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=G_PRED_B+5,  },  // msg0 = (custs . resume)
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(5),   .z=G_PRED_B+6,  },  // pred
    { .t=Instr_T,       .x=VM_push,     .y=G_PRED_OK,   .z=G_PRED_B+7,  },  // G_PRED_OK
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=G_PRED_B+8,  },  // ok'

    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_PRED_B+9,  },  // custs = (ok' . fail)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_PRED_B+10, },  // msg = (custs . resume)
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=SEND_0,      },  // ptrn

#define G_XLAT_K (G_PRED_B+11)
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=G_XLAT_K-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_in_,        .z=G_XLAT_K+0,  },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=G_XLAT_K+1,  },  // value
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_XLAT_K+2,  },  // (value . in)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=RELEASE_0,   },  // cust

#define G_XLAT_OK (G_XLAT_K+3)
//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=G_XLAT_OK-1, },
//  { .t=Instr_T,       .x=VM_push,     .y=_func_,      .z=G_XLAT_OK+0, },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=G_XLAT_OK+1, },  // value

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=G_XLAT_OK+2, },  // cust
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=G_XLAT_OK+3, },  // in
    { .t=Instr_T,       .x=VM_push,     .y=G_XLAT_K,    .z=G_XLAT_OK+4, },  // G_XLAT_K
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=G_XLAT_OK+5, },  // BECOME (G_XLAT_K cust in)
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=G_XLAT_OK+6, },  // k_xlat = SELF

    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=G_XLAT_OK+7, },  // func
    { .t=Instr_T,       .x=VM_send,     .y=TO_FIX(2),   .z=COMMIT,      },  // (func k_xlat value)

#define G_XLAT_B (G_XLAT_OK+8)
//  { .t=Instr_T,       .x=VM_push,     .y=_func_,      .z=G_XLAT_B+0,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_ptrn_,      .z=G_XLAT_B-1,  },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=G_XLAT_B+1,  },  // (custs . resume)
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_XLAT_B+2,  },  // resume custs
    { .t=Instr_T,       .x=VM_part,     .y=TO_FIX(1),   .z=G_XLAT_B+3,  },  // fail ok

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(5),   .z=G_XLAT_B+4,  },  // func
    { .t=Instr_T,       .x=VM_push,     .y=G_XLAT_OK,   .z=G_XLAT_B+5,  },  // G_XLAT_OK
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=G_XLAT_B+6,  },  // ok'

    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_XLAT_B+7,  },  // custs = (ok' . fail)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=G_XLAT_B+8,  },  // msg = (custs . resume)
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(2),   .z=SEND_0,      },  // ptrn

#define S_CHAIN (G_XLAT_B+9)
#define S_BUSY_C (S_CHAIN+11)
#define S_NEXT_C (S_BUSY_C+17)
//  { .t=Instr_T,       .x=VM_push,     .y=_ptrn_,      .z=S_CHAIN-1,   },
//  { .t=Instr_T,       .x=VM_push,     .y=_src_,       .z=S_CHAIN+0,   },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=S_CHAIN+1,   },  // cust
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=S_CHAIN+2,   },  // ptrn
    { .t=Instr_T,       .x=VM_push,     .y=S_BUSY_C,    .z=S_CHAIN+3,   },  // S_BUSY_C
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=S_CHAIN+4,   },  // BECOME (S_BUSY_C cust ptrn)

    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=S_CHAIN+5,   },  // fail = SELF
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=S_CHAIN+6,   },  // ok = SELF
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=S_CHAIN+7,   },  // custs = (ok . fail)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(3),   .z=S_CHAIN+8,   },  // ptrn
    { .t=Instr_T,       .x=VM_push,     .y=G_START,     .z=S_CHAIN+9,   },  // G_START
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=S_CHAIN+10,  },  // start = (G_START custs ptrn)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // src

//  { .t=Instr_T,       .x=VM_push,     .y=_cust_,      .z=S_BUSY_C-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_ptrn_,      .z=S_BUSY_C+0,  },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=S_BUSY_C+1,  },  // msg
    { .t=Instr_T,       .x=VM_typeq,    .y=Actor_T,     .z=S_BUSY_C+2,  },  // msg has type Actor_T
    { .t=Instr_T,       .x=VM_if,       .y=RESEND,      .z=S_BUSY_C+3,  },  // defer "get" requests

    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=S_BUSY_C+4,  },  // cdr(msg)
    { .t=Instr_T,       .x=VM_typeq,    .y=Pair_T,      .z=S_BUSY_C+5,  },  // cdr(msg) has type Pair_T
    { .t=Instr_T,       .x=VM_if,       .y=S_BUSY_C+6,  .z=S_BUSY_C+12, },  // treat failure as end

    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(1),   .z=S_BUSY_C+7,  },  // ptrn
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(-1),  .z=S_BUSY_C+8,  },  // in
    { .t=Instr_T,       .x=VM_push,     .y=S_NEXT_C,    .z=S_BUSY_C+9,  },  // S_NEXT_C
    { .t=Instr_T,       .x=VM_new,      .y=TO_FIX(2),   .z=S_BUSY_C+10, },  // next = (S_NEXT_C ptrn in)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(1),   .z=S_BUSY_C+11, },  // token = value
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=S_BUSY_C+13, },  // in = (token . next)

    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=S_BUSY_C+13, },  // in = ()

    { .t=Instr_T,       .x=VM_push,     .y=S_VALUE,     .z=S_BUSY_C+14, },  // S_VALUE
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(1),   .z=S_BUSY_C+15, },  // BECOME (S_VALUE in)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=S_BUSY_C+16, },  // cust
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=SEND_0,      },  // (SELF . cust)

//  { .t=Instr_T,       .x=VM_push,     .y=_ptrn_,      .z=S_NEXT_C-1,  },
//  { .t=Instr_T,       .x=VM_push,     .y=_in_,        .z=S_NEXT_C+0,  },
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(0),   .z=S_NEXT_C+1,  },  // cust
    { .t=Instr_T,       .x=VM_pick,     .y=TO_FIX(3),   .z=S_NEXT_C+2,  },  // ptrn
    { .t=Instr_T,       .x=VM_push,     .y=S_BUSY_C,    .z=S_NEXT_C+3,  },  // S_BUSY_C
    { .t=Instr_T,       .x=VM_beh,      .y=TO_FIX(2),   .z=S_NEXT_C+4,  },  // BECOME (S_BUSY_C cust ptrn)

    { .t=Instr_T,       .x=VM_push,     .y=UNDEF,       .z=S_NEXT_C+5,  },  // value = UNDEF
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=S_NEXT_C+6,  },  // fail = SELF
    { .t=Instr_T,       .x=VM_my,       .y=MY_SELF,     .z=S_NEXT_C+7,  },  // ok = SELF
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(1),   .z=S_NEXT_C+8,  },  // custs = (ok . fail)
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(2),   .z=S_NEXT_C+9,  },  // (custs value . in)
    { .t=Instr_T,       .x=VM_roll,     .y=TO_FIX(2),   .z=SEND_0,      },  // ptrn

#define PEG_END (S_NEXT_C+10)
