#ifndef ASM_SCM_BASE
#error ASM_SCM_BASE required.
#endif

//
// Assembly-language Tools
//

#define F_CELL (ASM_SCM_BASE)
#define _F_CELL TO_CAP(F_CELL)
    { .t=Actor_T,       .x=F_CELL+1,    .y=NIL,         .z=UNDEF        },  // (cell <T> <X> <Y> <Z>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_CELL+2,    },  // T = arg1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=F_CELL+3,    },  // X = arg2
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(4),   .z=F_CELL+4,    },  // Y = arg3
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(5),   .z=F_CELL+5,    },  // Z = arg4
    { .t=Instr_T,       .x=VM_cell,     .y=TO_FIX(4),   .z=CUST_SEND,   },  // cell(T, X, Y, Z)

#define F_GET_T (F_CELL+6)
#define _F_GET_T TO_CAP(F_GET_T)
    { .t=Actor_T,       .x=F_GET_T+1,   .y=NIL,         .z=UNDEF        },  // (get-t <cell>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_GET_T+2,   },  // cell = arg1
    { .t=Instr_T,       .x=VM_get,      .y=FLD_T,       .z=CUST_SEND,   },  // get-t(cell)

#define F_GET_X (F_GET_T+3)
#define _F_GET_X TO_CAP(F_GET_X)
    { .t=Actor_T,       .x=F_GET_X+1,   .y=NIL,         .z=UNDEF        },  // (get-x <cell>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_GET_X+2,   },  // cell = arg1
    { .t=Instr_T,       .x=VM_get,      .y=FLD_X,       .z=CUST_SEND,   },  // get-x(cell)

#define F_GET_Y (F_GET_X+3)
#define _F_GET_Y TO_CAP(F_GET_Y)
    { .t=Actor_T,       .x=F_GET_Y+1,   .y=NIL,         .z=UNDEF        },  // (get-y <cell>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_GET_Y+2,   },  // cell = arg1
    { .t=Instr_T,       .x=VM_get,      .y=FLD_Y,       .z=CUST_SEND,   },  // get-y(cell)

#define F_GET_Z (F_GET_Y+3)
#define _F_GET_Z TO_CAP(F_GET_Z)
    { .t=Actor_T,       .x=F_GET_Z+1,   .y=NIL,         .z=UNDEF        },  // (get-z <cell>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_GET_Z+2,   },  // cell = arg1
    { .t=Instr_T,       .x=VM_get,      .y=FLD_Z,       .z=CUST_SEND,   },  // get-z(cell)

#define F_SET_T (F_GET_Z+3)
#define _F_SET_T TO_CAP(F_SET_T)
    { .t=Actor_T,       .x=F_SET_T+1,   .y=NIL,         .z=UNDEF        },  // (set-t <cell> <T>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_SET_T+2,   },  // cell = arg1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=F_SET_T+3,   },  // T = arg2
    { .t=Instr_T,       .x=VM_set,      .y=FLD_T,       .z=CUST_SEND,   },  // set-t(cell, T)

#define F_SET_X (F_SET_T+4)
#define _F_SET_X TO_CAP(F_SET_X)
    { .t=Actor_T,       .x=F_SET_X+1,   .y=NIL,         .z=UNDEF        },  // (set-x <cell> <X>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_SET_X+2,   },  // cell = arg1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=F_SET_X+3,   },  // X = arg2
    { .t=Instr_T,       .x=VM_set,      .y=FLD_X,       .z=CUST_SEND,   },  // set-x(cell, X)

#define F_SET_Y (F_SET_X+4)
#define _F_SET_Y TO_CAP(F_SET_Y)
    { .t=Actor_T,       .x=F_SET_Y+1,   .y=NIL,         .z=UNDEF        },  // (set-y <cell> <Y>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_SET_Y+2,   },  // cell = arg1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=F_SET_Y+3,   },  // Y = arg2
    { .t=Instr_T,       .x=VM_set,      .y=FLD_Y,       .z=CUST_SEND,   },  // set-y(cell, Y)

#define F_SET_Z (F_SET_Y+4)
#define _F_SET_Z TO_CAP(F_SET_Z)
    { .t=Actor_T,       .x=F_SET_Z+1,   .y=NIL,         .z=UNDEF        },  // (set-z <cell> <Z>)
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(2),   .z=F_SET_Z+2,   },  // cell = arg1
    { .t=Instr_T,       .x=VM_msg,      .y=TO_FIX(3),   .z=F_SET_Z+3,   },  // Z = arg2
    { .t=Instr_T,       .x=VM_set,      .y=FLD_Z,       .z=CUST_SEND,   },  // set-z(cell, Z)

#define ASM_SCM_END (F_SET_Z+4)
