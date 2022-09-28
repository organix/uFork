#ifndef SCM_PEG_BASE
#error SCM_PEG_BASE required.
#endif

//
// Parsing Expression Grammar (PEG) for LISP/Scheme
//

/*
(define peg-end (peg-not peg-any))  ; end of input
*/
#define G_END (SCM_PEG_BASE)
#define _G_END TO_CAP(G_END)
    { .t=Actor_T,       .x=G_END+1,     .y=NIL,         .z=UNDEF        },  // (peg-not peg-any)
    { .t=Instr_T,       .x=VM_push,     .y=_G_ANY,      .z=G_NOT_B,     },

/*
(define lex-eol (peg-eq 10))  ; end of line
*/
#define G_EOL (G_END+2)
#define _G_EOL TO_CAP(G_EOL)
    { .t=Actor_T,       .x=G_EOL+1,     .y=NIL,         .z=UNDEF        },  // (peg-eq 10)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('\n'),.z=G_EQ_B,      },  // value = '\n' = 10

/*
(define lex-optwsp (peg-star (peg-class WSP)))
*/
#define G_WSP (G_EOL+2)
#define _G_WSP TO_CAP(G_WSP)
    { .t=Actor_T,       .x=G_WSP+1,     .y=NIL,         .z=UNDEF        },  // (peg-class WSP)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX(WSP), .z=G_CLS_B,     },
#define G_WSP_S (G_WSP+2)
#define _G_WSP_S TO_CAP(G_WSP_S)
    { .t=Actor_T,       .x=G_WSP_S+1,   .y=NIL,         .z=UNDEF        },  // (peg-star (peg-class WSP))
    { .t=Instr_T,       .x=VM_push,     .y=_G_WSP,      .z=G_STAR_B,    },

/*
(define scm-to-eol (peg-or lex-eol (peg-and peg-any (peg-call scm-to-eol))))
*/
#define G_TO_EOL (G_WSP_S+2)
#define _G_TO_EOL TO_CAP(G_TO_EOL)
#define _G_TO_EOL2 TO_CAP(G_TO_EOL+3)
    { .t=Actor_T,       .x=G_TO_EOL+1,  .y=NIL,         .z=UNDEF        },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_EOL,      .z=G_TO_EOL+2,  },  // first = lex-eol
    { .t=Instr_T,       .x=VM_push,     .y=_G_TO_EOL2,  .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_TO_EOL+4,  .y=NIL,         .z=UNDEF        },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_ANY,      .z=G_TO_EOL+5,  },  // first = peg-any
    { .t=Instr_T,       .x=VM_push,     .y=_G_TO_EOL,   .z=G_AND_B,     },  // rest = scm-to-eol

/*
(define scm-comment (peg-and (peg-eq 59) scm-to-eol))
*/
#define G_SEMIC (G_TO_EOL+6)
#define _G_SEMIC TO_CAP(G_SEMIC)
    { .t=Actor_T,       .x=G_SEMIC+1,   .y=NIL,         .z=UNDEF        },  // (peg-eq 59)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX(';'), .z=G_EQ_B,      },  // value = ';' = 59
#define G_COMMENT (G_SEMIC+2)
#define _G_COMMENT TO_CAP(G_COMMENT)
    { .t=Actor_T,       .x=G_COMMENT+1, .y=NIL,         .z=UNDEF        },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_SEMIC,    .z=G_COMMENT+2, },  // first = (peg-eq 59)
    { .t=Instr_T,       .x=VM_push,     .y=_G_TO_EOL,   .z=G_AND_B,     },  // rest = scm-to-eol

/*
(define scm-optwsp (peg-star (peg-or scm-comment (peg-class WSP))))
*/
#define G_OPTWSP (G_COMMENT+3)
#define _G_OPTWSP TO_CAP(G_OPTWSP)
#define _G_OPTWSP2 TO_CAP(G_OPTWSP+2)
    { .t=Actor_T,       .x=G_OPTWSP+1,  .y=NIL,         .z=UNDEF        },  // (peg-star <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_OPTWSP2,  .z=G_STAR_B,    },  // ptrn

    { .t=Actor_T,       .x=G_OPTWSP+3,  .y=NIL,         .z=UNDEF        },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_COMMENT,  .z=G_OPTWSP+4,  },  // first = scm-comment
    { .t=Instr_T,       .x=VM_push,     .y=_G_WSP,      .z=G_OR_B,      },  // rest = (peg-class WSP)

/*
(define lex-eot (peg-not (peg-class DGT UPR LWR SYM)))  ; end of token
*/
#define G_PRT (G_OPTWSP+5)
#define _G_PRT TO_CAP(G_PRT)
    { .t=Actor_T,       .x=G_PRT+1,     .y=NIL,         .z=UNDEF        },  // (peg-class DGT UPR LWR SYM)
    { .t=Instr_T,  .x=VM_push, .y=TO_FIX(DGT|UPR|LWR|SYM), .z=G_CLS_B,  },
#define G_EOT (G_PRT+2)
#define _G_EOT TO_CAP(G_EOT)
    { .t=Actor_T,       .x=G_EOT+1,     .y=NIL,         .z=UNDEF        },  // (peg-not (peg-class DGT UPR LWR SYM))
    { .t=Instr_T,       .x=VM_push,     .y=_G_PRT,      .z=G_NOT_B,     },

#define G_UNDER (G_EOT+2)
#define _G_UNDER TO_CAP(G_UNDER)
    { .t=Actor_T,       .x=G_UNDER+1,   .y=NIL,         .z=UNDEF        },  // (peg-eq 95)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('_'), .z=G_EQ_B,      },  // value = '_' = 95

/*
(define lex-sign (peg-or (peg-eq 45) (peg-eq 43)))  ; [-+]
*/
#define G_M_SGN (G_UNDER+2)
#define _G_M_SGN TO_CAP(G_M_SGN)
    { .t=Actor_T,       .x=G_M_SGN+1,   .y=NIL,         .z=UNDEF        },  // (peg-eq 45)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('-'), .z=G_EQ_B,      },  // value = '-' = 45
#define G_P_SGN (G_M_SGN+2)
#define _G_P_SGN TO_CAP(G_P_SGN)
    { .t=Actor_T,       .x=G_P_SGN+1,   .y=NIL,         .z=UNDEF        },  // (peg-eq 43)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('+'), .z=G_EQ_B,      },  // value = '+' = 43
#define G_SIGN (G_P_SGN+2)
#define _G_SIGN TO_CAP(G_SIGN)
    { .t=Actor_T,       .x=G_SIGN+1,    .y=NIL,         .z=UNDEF        },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_M_SGN,    .z=G_SIGN+2,    },  // first = (peg-eq 45)
    { .t=Instr_T,       .x=VM_push,     .y=_G_P_SGN,    .z=G_OR_B,      },  // rest = (peg-eq 43)

/*
(define lex-digit (peg-or (peg-class DGT) (peg-eq 95)))  ; [0-9_]
*/
#define G_DGT (G_SIGN+3)
#define _G_DGT TO_CAP(G_DGT)
    { .t=Actor_T,       .x=G_DGT+1,     .y=NIL,         .z=UNDEF        },  // (peg-class DGT)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX(DGT), .z=G_CLS_B,     },  // class = [0-9]
#define G_DIGIT (G_DGT+2)
#define _G_DIGIT TO_CAP(G_DIGIT)
    { .t=Actor_T,       .x=G_DIGIT+1,   .y=NIL,         .z=UNDEF        },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_DGT,      .z=G_DIGIT+2,   },  // first = (peg-class DGT)
    { .t=Instr_T,       .x=VM_push,     .y=_G_UNDER,    .z=G_OR_B,      },  // rest = (peg-eq 95)

/*
(define lex-digits (peg-xform car (peg-and (peg-plus lex-digit) lex-eot)))
*/
#define G_DIGITS (G_DIGIT+3)
#define _G_DIGITS TO_CAP(G_DIGITS)
#define _G_DIGITS2 TO_CAP(G_DIGITS+3)
#define _G_DIGITS3 TO_CAP(G_DIGITS+6)
    { .t=Actor_T,       .x=G_DIGITS+1,  .y=NIL,         .z=UNDEF        },  // (peg-xform car <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_CAR,      .z=G_DIGITS+2,  },  // func = F_CAR
    { .t=Instr_T,       .x=VM_push,     .y=_G_DIGITS2,  .z=G_XLAT_B,    },  // ptrn = (peg-and (peg-plus lex-digit) lex-eot)

    { .t=Actor_T,       .x=G_DIGITS+4,  .y=NIL,         .z=UNDEF        },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_DIGITS3,  .z=G_DIGITS+5,  },  // first = (peg-plus lex-digit)
    { .t=Instr_T,       .x=VM_push,     .y=_G_EOT,      .z=G_AND_B,     },  // rest = lex-eot

    { .t=Actor_T,       .x=G_DIGITS+7,  .y=NIL,         .z=UNDEF        },  // (peg-plus <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_DIGIT,    .z=G_PLUS_B,    },  // ptrn = lex-digit

/*
(define lex-number (peg-xform list->number (peg-or (peg-and lex-sign lex-digits) lex-digits)))
*/
#define G_NUMBER (G_DIGITS+8)
#define _G_NUMBER TO_CAP(G_NUMBER)
#define _G_NUMBER2 TO_CAP(G_NUMBER+3)
#define _G_NUMBER3 TO_CAP(G_NUMBER+6)
    { .t=Actor_T,       .x=G_NUMBER+1,  .y=NIL,         .z=UNDEF        },  // (peg-xform list->number <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_LST_NUM,  .z=G_NUMBER+2,  },  // func = F_LST_NUM
    { .t=Instr_T,       .x=VM_push,     .y=_G_NUMBER2,  .z=G_XLAT_B,    },  // ptrn = (peg-or (peg-and lex-sign lex-digits) lex-digits)

    { .t=Actor_T,       .x=G_NUMBER+4,  .y=NIL,         .z=UNDEF        },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_NUMBER3,  .z=G_NUMBER+5,  },  // first = (peg-and lex-sign lex-digits)
    { .t=Instr_T,       .x=VM_push,     .y=_G_DIGITS,   .z=G_OR_B,      },  // rest = lex-digits

    { .t=Actor_T,       .x=G_NUMBER+7,  .y=NIL,         .z=UNDEF        },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_SIGN,     .z=G_NUMBER+8,  },  // first = lex-sign
    { .t=Instr_T,       .x=VM_push,     .y=_G_DIGITS,   .z=G_AND_B,     },  // rest = lex-digits

/*
(define scm-ignore (peg-xform (lambda _ '_) (peg-and (peg-plus (peg-eq 95)) lex-eot)))
*/
#define F_IGN (G_NUMBER+9)
#define _F_IGN TO_CAP(F_IGN)
    { .t=Actor_T,       .x=F_IGN+1,     .y=NIL,         .z=UNDEF        },  // (lambda _ '_)
    { .t=Instr_T,       .x=VM_push,     .y=S_IGNORE,    .z=CUST_SEND,   },
#define G_IGN (F_IGN+2)
#define _G_IGN TO_CAP(G_IGN)
#define _G_IGN2 TO_CAP(G_IGN+3)
#define _G_IGN3 TO_CAP(G_IGN+6)
    { .t=Actor_T,       .x=G_IGN+1,     .y=NIL,         .z=UNDEF        },  // (peg-xform (lambda _ '_) <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_IGN,      .z=G_IGN+2,     },  // func = F_IGN
    { .t=Instr_T,       .x=VM_push,     .y=_G_IGN2,     .z=G_XLAT_B,    },  // ptrn = ...

    { .t=Actor_T,       .x=G_IGN+4,     .y=NIL,         .z=UNDEF        },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_IGN3,     .z=G_IGN+5,     },  // first = (peg-plus (peg-eq 95))
    { .t=Instr_T,       .x=VM_push,     .y=_G_EOT,      .z=G_AND_B,     },  // rest = lex-eot

    { .t=Actor_T,       .x=G_IGN+7,     .y=NIL,         .z=UNDEF        },  // (peg-plus (peg-eq 95))
    { .t=Instr_T,       .x=VM_push,     .y=_G_UNDER,    .z=G_PLUS_B,    },  // ptrn = (peg-eq 95)

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
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('#'), .z=G_EQ_B,      },  // value = '#' = 35
#define G_LWR_U (G_HASH+2)
#define _G_LWR_U TO_CAP(G_LWR_U)
    { .t=Actor_T,       .x=G_LWR_U+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 117)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('u'), .z=G_EQ_B,      },  // value = 'u' = 117
#define G_LWR_N (G_LWR_U+2)
#define _G_LWR_N TO_CAP(G_LWR_N)
    { .t=Actor_T,       .x=G_LWR_N+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 110)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('n'), .z=G_EQ_B,      },  // value = 'n' = 110
#define G_LWR_I (G_LWR_N+2)
#define _G_LWR_I TO_CAP(G_LWR_I)
    { .t=Actor_T,       .x=G_LWR_I+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 105)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('i'), .z=G_EQ_B,      },  // value = 'i' = 105
#define G_LWR_T (G_LWR_I+2)
#define _G_LWR_T TO_CAP(G_LWR_T)
    { .t=Actor_T,       .x=G_LWR_T+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 116)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('t'), .z=G_EQ_B,      },  // value = 't' = 116
#define G_LWR_F (G_LWR_T+2)
#define _G_LWR_F TO_CAP(G_LWR_F)
    { .t=Actor_T,       .x=G_LWR_F+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 102)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('f'), .z=G_EQ_B,      },  // value = 'f' = 102
#define G_QMARK (G_LWR_F+2)
#define _G_QMARK TO_CAP(G_QMARK)
    { .t=Actor_T,       .x=G_QMARK+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 63)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('?'), .z=G_EQ_B,      },  // value = '?' = 63

#define F_FALSE (G_QMARK+2)
#define _F_FALSE TO_CAP(F_FALSE)
    { .t=Actor_T,       .x=RV_FALSE,    .y=NIL,         .z=UNDEF,       },  // (lambda _ #f)
#define G_FALSE (F_FALSE+1)
#define _G_FALSE TO_CAP(G_FALSE)
    { .t=Actor_T,       .x=G_FALSE+1,   .y=NIL,         .z=UNDEF,       },  // (peg-xform (lambda _ #f) (peg-eq 102))
    { .t=Instr_T,       .x=VM_push,     .y=_F_FALSE,    .z=G_FALSE+2,   },  // func = F_FALSE
    { .t=Instr_T,       .x=VM_push,     .y=_G_LWR_F,    .z=G_XLAT_B,    },  // ptrn = (peg-eq 102)

#define F_TRUE (G_FALSE+3)
#define _F_TRUE TO_CAP(F_TRUE)
    { .t=Actor_T,       .x=RV_TRUE,     .y=NIL,         .z=UNDEF,       },  // (lambda _ #t)
#define G_TRUE (F_TRUE+1)
#define _G_TRUE TO_CAP(G_TRUE)
    { .t=Actor_T,       .x=G_TRUE+1,    .y=NIL,         .z=UNDEF,       },  // (peg-xform (lambda _ #t) (peg-eq 116))
    { .t=Instr_T,       .x=VM_push,     .y=_F_TRUE,     .z=G_TRUE+2,    },  // func = F_TRUE
    { .t=Instr_T,       .x=VM_push,     .y=_G_LWR_T,    .z=G_XLAT_B,    },  // ptrn = (peg-eq 116)

#define F_UNDEF (G_TRUE+3)
#define _F_UNDEF TO_CAP(F_UNDEF)
    { .t=Actor_T,       .x=RV_UNDEF,    .y=NIL,         .z=UNDEF,       },  // (lambda _ #?)
#define G_UNDEF (F_UNDEF+1)
#define _G_UNDEF TO_CAP(G_UNDEF)
    { .t=Actor_T,       .x=G_UNDEF+1,   .y=NIL,         .z=UNDEF,       },  // (peg-xform (lambda _ #?) (peg-eq 63))
    { .t=Instr_T,       .x=VM_push,     .y=_F_UNDEF,    .z=G_UNDEF+2,   },  // func = F_UNDEF
    { .t=Instr_T,       .x=VM_push,     .y=_G_QMARK,    .z=G_XLAT_B,    },  // ptrn = G_QMARK

#define F_UNIT (G_UNDEF+3)
#define _F_UNIT TO_CAP(F_UNIT)
    { .t=Actor_T,       .x=RV_UNIT,     .y=NIL,         .z=UNDEF,       },  // (lambda _ #unit)
#define G_UNIT (F_UNIT+1)
#define _G_UNIT TO_CAP(G_UNIT)
#define _G_UNIT2 TO_CAP(G_UNIT+3)
#define _G_UNIT3 TO_CAP(G_UNIT+6)
#define _G_UNIT4 TO_CAP(G_UNIT+9)
    { .t=Actor_T,       .x=G_UNIT+1,    .y=NIL,         .z=UNDEF,       },  // (peg-xform (lambda _ #unit) <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_UNIT,     .z=G_UNIT+2,    },  // func = F_UNIT
    { .t=Instr_T,       .x=VM_push,     .y=_G_UNIT2,    .z=G_XLAT_B,    },  // ptrn = (peg-seq (peg-eq 117) (peg-eq 110) (peg-eq 105) (peg-eq 116))

    { .t=Actor_T,       .x=G_UNIT+4,    .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_LWR_U,    .z=G_UNIT+5,    },  // first = (peg-eq 117)
    { .t=Instr_T,       .x=VM_push,     .y=_G_UNIT3,    .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_UNIT+7,    .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_LWR_N,    .z=G_UNIT+8,    },  // first = (peg-eq 110)
    { .t=Instr_T,       .x=VM_push,     .y=_G_UNIT4,    .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_UNIT+10,   .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_LWR_I,    .z=G_UNIT+11,   },  // first = (peg-eq 105)
    { .t=Instr_T,       .x=VM_push,     .y=_G_LWR_T,    .z=G_AND_B,     },  // rest = (peg-eq 116)

#define G_CONST (G_UNIT+12)
#define _G_CONST TO_CAP(G_CONST)
#define _G_CONST2 TO_CAP(G_CONST+3)
#define _G_CONST3 TO_CAP(G_CONST+6)
#define _G_CONST4 TO_CAP(G_CONST+9)
#define _G_CONST5 TO_CAP(G_CONST+12)
#define _G_CONST6 TO_CAP(G_CONST+15)
    { .t=Actor_T,       .x=G_CONST+1,   .y=NIL,         .z=UNDEF,       },  // (peg-xform cadr <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_CADR,     .z=G_CONST+2,   },  // func = F_CADR
    { .t=Instr_T,       .x=VM_push,     .y=_G_CONST2,   .z=G_XLAT_B,    },  // ptrn = (peg-seq (peg-eq 35) (peg-alt ...) lex-eot)

    { .t=Actor_T,       .x=G_CONST+4,   .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_HASH,     .z=G_CONST+5,   },  // first = (peg-eq 35)
    { .t=Instr_T,       .x=VM_push,     .y=_G_CONST3,   .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_CONST+7,   .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_CONST4,   .z=G_CONST+8,   },  // first = (peg-alt G_FALSE G_TRUE G_UNDEF G_UNIT)
    { .t=Instr_T,       .x=VM_push,     .y=_G_EOT,      .z=G_AND_B,     },  // rest = lex-eot

    { .t=Actor_T,       .x=G_CONST+10,  .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_FALSE,    .z=G_CONST+11,  },  // first = G_FALSE
    { .t=Instr_T,       .x=VM_push,     .y=_G_CONST5,   .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_CONST+13,  .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_TRUE,     .z=G_CONST+14,  },  // first = G_TRUE
    { .t=Instr_T,       .x=VM_push,     .y=_G_CONST6,   .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_CONST+16,  .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_UNDEF,    .z=G_CONST+17,  },  // first = G_UNDEF
    { .t=Instr_T,       .x=VM_push,     .y=_G_UNIT,     .z=G_OR_B,      },  // rest

/*
(define scm-symbol (peg-xform list->symbol (peg-plus (peg-class DGT UPR LWR SYM))))
*/
#define G_SYMBOL (G_CONST+18)
#define _G_SYMBOL TO_CAP(G_SYMBOL)
#define _G_SYMBOL2 TO_CAP(G_SYMBOL+3)
    { .t=Actor_T,       .x=G_SYMBOL+1,  .y=NIL,         .z=UNDEF,       },  // (peg-xform list->symbol <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_LST_SYM,  .z=G_SYMBOL+2,  },  // func = F_LST_SYM
    { .t=Instr_T,       .x=VM_push,     .y=_G_SYMBOL2,  .z=G_XLAT_B,    },  // ptrn = (peg-plus (peg-class DGT UPR LWR SYM))

    { .t=Actor_T,       .x=G_SYMBOL+4,  .y=NIL,         .z=UNDEF,       },  // (peg-plus <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_PRT,      .z=G_PLUS_B,    },  // ptrn = (peg-class DGT UPR LWR SYM)

#define G_OPEN (G_SYMBOL+5)
#define _G_OPEN TO_CAP(G_OPEN)
    { .t=Actor_T,       .x=G_OPEN+1,    .y=NIL,         .z=UNDEF,       },  // (peg-eq 40)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('('), .z=G_EQ_B,      },  // value = '(' = 40
#define G_DOT (G_OPEN+2)
#define _G_DOT TO_CAP(G_DOT)
    { .t=Actor_T,       .x=G_DOT+1,     .y=NIL,         .z=UNDEF,       },  // (peg-eq 46)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('.'), .z=G_EQ_B,      },  // value = '.' = 46
#define G_CLOSE (G_DOT+2)
#define _G_CLOSE TO_CAP(G_CLOSE)
    { .t=Actor_T,       .x=G_CLOSE+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 41)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX(')'), .z=G_EQ_B,      },  // value = ')' = 41
#define G_QUOTE (G_CLOSE+2)
#define _G_QUOTE TO_CAP(G_QUOTE)
    { .t=Actor_T,       .x=G_QUOTE+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 39)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('\''),.z=G_EQ_B,      },  // value = '\'' = 39
#define G_BQUOTE (G_QUOTE+2)
#define _G_BQUOTE TO_CAP(G_BQUOTE)
    { .t=Actor_T,       .x=G_BQUOTE+1,  .y=NIL,         .z=UNDEF,       },  // (peg-eq 96)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('`'), .z=G_EQ_B,      },  // value = '`' = 96
#define G_COMMA (G_BQUOTE+2)
#define _G_COMMA TO_CAP(G_COMMA)
    { .t=Actor_T,       .x=G_COMMA+1,   .y=NIL,         .z=UNDEF,       },  // (peg-eq 44)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX(','), .z=G_EQ_B,      },  // value = ',' = 44
#define G_AT (G_COMMA+2)
#define _G_AT TO_CAP(G_AT)
    { .t=Actor_T,       .x=G_AT+1,      .y=NIL,         .z=UNDEF,       },  // (peg-eq 64)
    { .t=Instr_T,       .x=VM_push,     .y=TO_FIX('@'), .z=G_EQ_B,      },  // value = '@' = 64

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
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=F_QUOTED+2,  },  // ()
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_QUOTED+3,  },  // arg1
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(-1),  .z=F_QUOTED+4,  },  // value = cdr(arg1)
    { .t=Instr_T,       .x=VM_push,     .y=S_QUOTE,     .z=F_QUOTED+5,  },  // S_QUOTE
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // (S_QUOTE value)
#define F_QQUOTED (F_QUOTED+6)
#define _F_QQUOTED TO_CAP(F_QQUOTED)
    { .t=Actor_T,       .x=F_QQUOTED+1, .y=NIL,         .z=UNDEF,       },  // (lambda (x) (list 'quasiquote (cdr x)))
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=F_QQUOTED+2, },  // ()
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_QQUOTED+3, },  // arg1
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(-1),  .z=F_QQUOTED+4, },  // value = cdr(arg1)
    { .t=Instr_T,       .x=VM_push,     .y=S_QQUOTE,    .z=F_QQUOTED+5, },  // S_QQUOTE
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // (S_QQUOTE value)
#define F_UNQUOTED (F_QQUOTED+6)
#define _F_UNQUOTED TO_CAP(F_UNQUOTED)
    { .t=Actor_T,       .x=F_UNQUOTED+1,.y=NIL,         .z=UNDEF,       },  // (lambda (x) (list 'unquote (cdr x)))
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=F_UNQUOTED+2,},  // ()
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_UNQUOTED+3,},  // arg1
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(-1),  .z=F_UNQUOTED+4,},  // value = cdr(arg1)
    { .t=Instr_T,       .x=VM_push,     .y=S_UNQUOTE,   .z=F_UNQUOTED+5,},  // S_UNQUOTE
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // (S_UNQUOTE value)
#define F_QSPLICED (F_UNQUOTED+6)
#define _F_QSPLICED TO_CAP(F_QSPLICED)
    { .t=Actor_T,       .x=F_QSPLICED+1,.y=NIL,         .z=UNDEF,       },  // (lambda (x) (list 'unquote-splicing (cddr x)))
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=F_QSPLICED+2,},  // ()
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_QSPLICED+3,},  // arg1
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(-2),  .z=F_QSPLICED+4,},  // value = cddr(arg1)
    { .t=Instr_T,       .x=VM_push,     .y=S_QSPLICE,   .z=F_QSPLICED+5,},  // S_QSPLICE
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // (S_QSPLICE value)
#define F_PLACEHD (F_QSPLICED+6)
#define _F_PLACEHD TO_CAP(F_PLACEHD)
    { .t=Actor_T,       .x=F_PLACEHD+1, .y=NIL,         .z=UNDEF,       },  // (lambda (x) (list 'placeholder (cdr x)))
    { .t=Instr_T,       .x=VM_push,     .y=NIL,         .z=F_PLACEHD+2, },  // ()
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_PLACEHD+3, },  // arg1
    { .t=Instr_T,       .x=VM_nth,      .y=TO_FIX(-1),  .z=F_PLACEHD+4, },  // value = cdr(arg1)
    { .t=Instr_T,       .x=VM_push,     .y=S_PLACEH,    .z=F_PLACEHD+5, },  // S_PLACEH
    { .t=Instr_T,       .x=VM_pair,     .y=TO_FIX(2),   .z=CUST_SEND,   },  // (S_PLACEH value)
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
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED2,  .z=G_QUOTED+2,  },  // first
#if PLACEH_SYNTAX
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED13, .z=G_OR_B,      },  // rest
#else
#if QQUOTE_SYNTAX
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED4,  .z=G_OR_B,      },  // rest
#else
    { .t=Instr_T,       .x=VM_push,     .y=_G_FAIL,     .z=G_OR_B,      },  // rest
#endif
#endif

    { .t=Actor_T,       .x=G_QUOTED+4,  .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_QUOTED,   .z=G_QUOTED+5,  },  // func
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED3,  .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_QUOTED+7,  .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTE,    .z=G_QUOTED+8,  },  // first = (peg-eq 39)
    { .t=Instr_T,       .x=VM_push,     .y=_G_SEXPR,    .z=G_AND_B,     },  // rest = scm-expr

    { .t=Actor_T,       .x=G_QUOTED+10, .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED5,  .z=G_QUOTED+11, },  // first
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED7,  .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_QUOTED+13, .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_QQUOTED,  .z=G_QUOTED+14, },  // func
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED6,  .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_QUOTED+16, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_BQUOTE,   .z=G_QUOTED+17, },  // first = (peg-eq 96)
    { .t=Instr_T,       .x=VM_push,     .y=_G_SEXPR,    .z=G_AND_B,     },  // rest = scm-expr

    { .t=Actor_T,       .x=G_QUOTED+19, .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED8,  .z=G_QUOTED+20, },  // first
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED11, .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_QUOTED+22, .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_QSPLICED, .z=G_QUOTED+23, },  // func
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED9,  .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_QUOTED+25, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_COMMA,    .z=G_QUOTED+26, },  // first = (peg-eq 44)
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED10, .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_QUOTED+28, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_AT,       .z=G_QUOTED+29, },  // first = (peg-eq 64)
    { .t=Instr_T,       .x=VM_push,     .y=_G_SEXPR,    .z=G_AND_B,     },  // rest = scm-expr

    { .t=Actor_T,       .x=G_QUOTED+31, .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_UNQUOTED, .z=G_QUOTED+32, },  // func
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED12, .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_QUOTED+34, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_COMMA,    .z=G_QUOTED+35, },  // first = (peg-eq 44)
    { .t=Instr_T,       .x=VM_push,     .y=_G_SEXPR,    .z=G_AND_B,     },  // rest = scm-expr

    { .t=Actor_T,       .x=G_QUOTED+37, .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED14, .z=G_QUOTED+38, },  // first
#if QQUOTE_SYNTAX
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED4,  .z=G_OR_B,      },  // rest
#else
    { .t=Instr_T,       .x=VM_push,     .y=_G_FAIL,     .z=G_OR_B,      },  // rest
#endif

    { .t=Actor_T,       .x=G_QUOTED+40, .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_PLACEHD,  .z=G_QUOTED+41, },  // func
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED15, .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_QUOTED+43, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_QMARK,    .z=G_QUOTED+44, },  // first = (peg-eq 63)
    { .t=Instr_T,       .x=VM_push,     .y=_G_SEXPR,    .z=G_AND_B,     },  // rest = scm-expr

/*
(define scm-dotted (peg-xform caddr
  (peg-seq scm-optwsp (peg-eq 46) (peg-call scm-sexpr) scm-optwsp (peg-eq 41))))
*/
    { .t=Actor_T,       .x=G_DOTTED+1,  .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_CADDR,    .z=G_DOTTED+2,  },  // func = caddr
    { .t=Instr_T,       .x=VM_push,     .y=_G_DOTTED2,  .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_DOTTED+4,  .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_OPTWSP,   .z=G_DOTTED+5,  },  // first = scm-optwsp
    { .t=Instr_T,       .x=VM_push,     .y=_G_DOTTED3,  .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_DOTTED+7,  .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_DOT,      .z=G_DOTTED+8,  },  // first = (peg-eq 46)
    { .t=Instr_T,       .x=VM_push,     .y=_G_DOTTED4,  .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_DOTTED+10, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_SEXPR,    .z=G_DOTTED+11, },  // first = scm-sexpr
    { .t=Instr_T,       .x=VM_push,     .y=_G_DOTTED5,  .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_DOTTED+13, .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_OPTWSP,   .z=G_DOTTED+14, },  // first = scm-optwsp
    { .t=Instr_T,       .x=VM_push,     .y=_G_CLOSE,    .z=G_AND_B,     },  // rest = (peg-eq 41)

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
    { .t=Instr_T,       .x=VM_push,     .y=_F_CDR,      .z=G_TAIL+2,    },  // func = cdr
    { .t=Instr_T,       .x=VM_push,     .y=_G_TAIL2,    .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_TAIL+4,    .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_OPTWSP,   .z=G_TAIL+5,    },  // first = scm-optwsp
    { .t=Instr_T,       .x=VM_push,     .y=_G_TAIL3,    .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_TAIL+7,    .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_TAIL4,    .z=G_TAIL+8,    },  // first = (peg-xform ...)
    { .t=Instr_T,       .x=VM_push,     .y=_G_TAIL5,    .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_TAIL+10,   .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_NIL,      .z=G_TAIL+11,   },  // func = (lambda _ ())
    { .t=Instr_T,       .x=VM_push,     .y=_G_CLOSE,    .z=G_XLAT_B,    },  // ptrn = (peg-eq 41)

    { .t=Actor_T,       .x=G_TAIL+13,   .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_EXPR,     .z=G_TAIL+14,   },  // first = scm-expr
    { .t=Instr_T,       .x=VM_push,     .y=_G_TAIL6,    .z=G_AND_B,     },  // rest

    { .t=Actor_T,       .x=G_TAIL+16,   .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_DOTTED,   .z=G_TAIL+17,   },  // first = scm-dotted
    { .t=Instr_T,       .x=VM_push,     .y=_G_TAIL,     .z=G_OR_B,      },  // rest = scm-tail

/*
(define scm-list (peg-xform cdr (peg-and (peg-eq 40) scm-tail)))
*/
    { .t=Actor_T,       .x=G_LIST+1,    .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_CDR,      .z=G_LIST+2,    },  // func = cdr
    { .t=Instr_T,       .x=VM_push,     .y=_G_LIST2,    .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_LIST+4,    .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_OPEN,     .z=G_LIST+5,    },  // first = (peg-eq 40)
    { .t=Instr_T,       .x=VM_push,     .y=_G_TAIL,     .z=G_AND_B,     },  // rest = scm-tail

/*
(define scm-expr (peg-alt scm-list scm-ignore scm-const lex-number scm-quoted scm-symbol))
*/
    { .t=Actor_T,       .x=G_EXPR+1,    .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_LIST,     .z=G_EXPR+2,    },  // first = scm-list
    { .t=Instr_T,       .x=VM_push,     .y=_G_EXPR2,    .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_EXPR+4,    .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_IGN,      .z=G_EXPR+5,    },  // first = scm-ignore
    { .t=Instr_T,       .x=VM_push,     .y=_G_EXPR3,    .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_EXPR+7,    .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_CONST,    .z=G_EXPR+8,    },  // first = scm-const
    { .t=Instr_T,       .x=VM_push,     .y=_G_EXPR4,    .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_EXPR+10,   .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_NUMBER,   .z=G_EXPR+11,   },  // first = lex-number
    { .t=Instr_T,       .x=VM_push,     .y=_G_EXPR5,   .z=G_OR_B,      },  // rest

    { .t=Actor_T,       .x=G_EXPR+13,   .y=NIL,         .z=UNDEF,       },  // (peg-or <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_QUOTED,   .z=G_EXPR+14,   },  // first = scm-quoted
    { .t=Instr_T,       .x=VM_push,     .y=_G_SYMBOL,   .z=G_OR_B,      },  // rest = scm-symbol

/*
(define scm-sexpr (peg-xform cdr (peg-and scm-optwsp scm-expr)))
*/
    { .t=Actor_T,       .x=G_SEXPR+1,   .y=NIL,         .z=UNDEF,       },  // (peg-xform <func> <ptrn>)
    { .t=Instr_T,       .x=VM_push,     .y=_F_CDR,      .z=G_SEXPR+2,   },  // func = cdr
    { .t=Instr_T,       .x=VM_push,     .y=_G_SEXPR2,   .z=G_XLAT_B,    },  // ptrn

    { .t=Actor_T,       .x=G_SEXPR+4,   .y=NIL,         .z=UNDEF,       },  // (peg-and <first> <rest>)
    { .t=Instr_T,       .x=VM_push,     .y=_G_OPTWSP,   .z=G_SEXPR+5,   },  // first = scm-optwsp
    { .t=Instr_T,       .x=VM_push,     .y=_G_EXPR,     .z=G_AND_B,     },  // rest = scm-expr

#define SCM_PEG_END (G_SEXPR+6)
