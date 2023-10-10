/*
 * runtime.h -- uFork runtime (virtual CPU)
 * Copyright 2022 Dale Schumacher
 */

#ifndef _RUNTIME_H_
#define _RUNTIME_H_

/*
 * virtual opcodes
 */

#define VM_typeq    TO_FIX(0)
#define VM_cell     TO_FIX(1)
#define VM_get      TO_FIX(2)
#define VM_set      TO_FIX(3)
#define VM_pair     TO_FIX(4)
#define VM_part     TO_FIX(5)
#define VM_nth      TO_FIX(6)
#define VM_push     TO_FIX(7)
#define VM_depth    TO_FIX(8)
#define VM_drop     TO_FIX(9)
#define VM_pick     TO_FIX(10)
#define VM_dup      TO_FIX(11)
#define VM_roll     TO_FIX(12)
#define VM_alu      TO_FIX(13)
#define VM_eq       TO_FIX(14)
#define VM_cmp      TO_FIX(15)
#define VM_if       TO_FIX(16)
#define VM_msg      TO_FIX(17)
#define VM_my       TO_FIX(18)
#define VM_send     TO_FIX(19)
#define VM_new      TO_FIX(20)
#define VM_beh      TO_FIX(21)
#define VM_end      TO_FIX(22)
#define VM_cvt      TO_FIX(23)
#define VM_putc     TO_FIX(24)
#define VM_getc     TO_FIX(25)
#define VM_debug    TO_FIX(26)
#define VM_OPCODES  (27)

// VM_get/VM_set fields
#define FLD_T       TO_FIX(0)
#define FLD_X       TO_FIX(1)
#define FLD_Y       TO_FIX(2)
#define FLD_Z       TO_FIX(3)

// VM_alu operations
#define ALU_NOT     TO_FIX(0)
#define ALU_AND     TO_FIX(1)
#define ALU_OR      TO_FIX(2)
#define ALU_XOR     TO_FIX(3)
#define ALU_ADD     TO_FIX(4)
#define ALU_SUB     TO_FIX(5)
#define ALU_MUL     TO_FIX(6)

// VM_cmp relations
#define CMP_EQ      TO_FIX(0)
#define CMP_GE      TO_FIX(1)
#define CMP_GT      TO_FIX(2)
#define CMP_LT      TO_FIX(3)
#define CMP_LE      TO_FIX(4)
#define CMP_NE      TO_FIX(5)
#define CMP_CLS     TO_FIX(6)

// VM_my fields
#define MY_SELF     TO_FIX(0)
#define MY_BEH      TO_FIX(1)
#define MY_STATE    TO_FIX(2)

// VM_end thread action
#define END_ABORT   TO_FIX(-1)
#define END_STOP    TO_FIX(0)
#define END_COMMIT  TO_FIX(+1)
#define END_RELEASE TO_FIX(+2)

// VM_cvt conversions
#define CVT_LST_NUM TO_FIX(0)
#define CVT_LST_SYM TO_FIX(1)

#define GET_IP() get_t(k_queue_head)
#define GET_SP() get_x(k_queue_head)
#define GET_EP() get_y(k_queue_head)

#define SET_IP(v) set_t(k_queue_head,(v))
#define SET_SP(v) set_x(k_queue_head,(v))
#define SET_EP(v) set_y(k_queue_head,(v))

/*
 * Exports
 */

#if MEM_SAVES_ALL
#define e_queue_head (cell_zero[DDEQUE].t)
#define e_queue_tail (cell_zero[DDEQUE].x)
#define k_queue_head (cell_zero[DDEQUE].y)
#define k_queue_tail (cell_zero[DDEQUE].z)
#else
extern int_t k_queue_head;
extern int_t k_queue_tail;
#endif

int_t clk_init(int_t handler);
int_t runtime();

#if RUNTIME_STATS
extern long event_count;
extern long instruction_count;
#endif

#if INCLUDE_DEBUG
extern int_t runtime_trace;

int_t event_q_dump();
int_t cont_q_dump();
#endif

#endif // _RUNTIME_H_
