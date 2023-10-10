/*
 * ufork.h -- Actor Virtual Machine
 * Copyright 2022 Dale Schumacher
 */

#ifndef _UFORK_H_
#define _UFORK_H_

#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdint.h>     // for intptr_t, uintptr_t, uint8_t, uint16_t, etc.
#include <inttypes.h>   // for PRIiPTR, PRIuPTR, PRIxPTR, etc.
#include <time.h>       // for clock_t, clock(), etc.

#define INCLUDE_DEBUG 1 // include debugging facilities
#define RUN_DEBUGGER  1 // run program under interactive debugger
#define EXPLICIT_FREE 1 // explicitly free known-dead memory
#define MARK_SWEEP_GC 1 // stop-the-world garbage collection
#define CONCURRENT_GC 0 // concurrent garbage collection
#define RUNTIME_STATS 1 // collect statistics on the runtime
#define PEG_TOOLS_SCM 1 // include PEG tools for LISP/Scheme
#define BOOTSTRAP_LIB 1 // include bootstrap library definitions
#define EVLIS_IS_PAR  0 // concurrent argument-list evaluation
#define ASM_TOOLS_SCM 1 // include assembly tools for LISP/Scheme
#define QQUOTE_SYNTAX 1 // include support for quasiquote, et. al.
#define PLACEH_SYNTAX 1 // include support for placeholder variables (?x)
#define SCHEME_ACTORS 1 // include meta-actor definitions for LISP/Scheme
#define MEM_SAVES_ALL 1 // all VM state is stored in cell-memory

#if INCLUDE_DEBUG
#define DEBUG(x)    x   // include/exclude debug instrumentation
#define TRACE(x)    x   // include/exclude debug trace
#define XTRACE(x)       // include/exclude execution trace
#else
#define DEBUG(x)        // exclude debug instrumentation
#define TRACE(x)        // include/exclude debug trace
#define XTRACE(x)       // exclude execution trace
#endif

#if EXPLICIT_FREE
#define XFREE(x)    cell_free(x)
#else
#define XFREE(x)    UNDEF
#endif

// choose a definition of "machine word" from the following:
#define USE_INT16_T   1 // int16_t from <stdint.h>
#define USE_INT32_T   0 // int32_t from <stdint.h>
#define USE_INT64_T   0 // int64_t from <stdint.h>
#define USE_INTPTR_T  0 // intptr_t from <stdint.h>

#if USE_INT16_T
typedef int16_t int_t;
typedef uint16_t nat_t;
typedef void *ptr_t;
#define PdI PRId16
#define PuI PRIu16
#define PxI PRIx16
#endif
#if USE_INT32_T
typedef int32_t int_t;
typedef uint32_t nat_t;
typedef void *ptr_t;
#define PdI PRId32
#define PuI PRIu32
#define PxI PRIx32
#endif
#if USE_INT64_T
typedef int64_t int_t;
typedef uint64_t nat_t;
typedef void *ptr_t;
#define PdI PRId64
#define PuI PRIu64
#define PxI PRIx64
#endif
#if USE_INTPTR_T
typedef intptr_t int_t;
typedef uintptr_t nat_t;
typedef void *ptr_t;
#define PdI PRIdPTR
#define PuI PRIuPTR
#define PxI PRIxPTR
#endif

// WASM base types
typedef int32_t i32;
typedef int64_t i64;
#define I32(x) ((i32)(x))
#define I64(x) ((i64)(x))

#define INT(n) ((int_t)(n))
#define NAT(n) ((nat_t)(n))
#define PTR(n) ((ptr_t)(n))

#define MSB(n) NAT(~(NAT(-1)>>(n)))
#define MSB1   NAT(MSB(1))
#define MSB2   NAT(MSB1>>1)
#define TAG    (MSB1|MSB2)

#define TO_REF(v)   INT((v) & ~TAG)
#define TO_CAP(v)   INT(((v) & ~MSB1) | MSB2)
#define IS_VAL(v)   ((v) & MSB1)
#define IS_REF(v)   (!((v) & TAG))
#define IS_CAP(v)   (((v) & TAG) == MSB2)

#define TO_INT(v)   INT(INT(NAT(v) << 1) >> 1)
#define TO_FIX(n)   INT((n) | MSB1)
#define IS_FIX(n)   IS_VAL(n)

typedef struct cell {
    int_t       t;      // proc/type (code offset from proc_zero)
    int_t       x;      // head/car  (data offset from cell_zero)
    int_t       y;      // tail/cdr  (data offset from cell_zero)
    int_t       z;      // link/next (data offset from cell_zero)
} cell_t;

#define PROC_DECL(name)  int_t name(int_t self, int_t arg)

typedef PROC_DECL((*proc_t));

#define ASSERT(cond)    if (!(cond)) return failure(__FILE__, __LINE__)

// literal values
#define UNDEF       (0)
#define NIL         (1)
#define FALSE       (2)
#define TRUE        (3)
#define UNIT        (4)
// type markers
#define Literal_T   UNDEF
#define Type_T      (5)
#define Event_T     (6)
#define Instr_T     (7)
#define Actor_T     (8)
#define Fixnum_T    (9)
#define Symbol_T    (10)
#define Pair_T      (11)
#define Fexpr_T     (179)
#define Dict_T      (12)
#define Free_T      (13)
// reserved addresses
#define MEMORY      (14)
#define DDEQUE      (15)
#define START       (16)

#define get_t(n) (cell_zero[(n)].t)
#define get_x(n) (cell_zero[(n)].x)
#define get_y(n) (cell_zero[(n)].y)
#define get_z(n) (cell_zero[(n)].z)

#define set_t(n,v) (cell_zero[(n)].t = MARK_CELL(v))
#define set_x(n,v) (cell_zero[(n)].x = MARK_CELL(v))
#define set_y(n,v) (cell_zero[(n)].y = MARK_CELL(v))
#define set_z(n,v) (cell_zero[(n)].z = MARK_CELL(v))

#define IS_CELL(n)  (NAT(n) < cell_top)
#define IN_HEAP(n)  (((n)>MEMORY) && ((n)<cell_top))

#define IS_BOOL(n)  (((n) == FALSE) || ((n) == TRUE))

#define TYPEQ(t,n)  (IS_CELL(n) && (get_t(n) == (t)))
#define IS_EVENT(n) TYPEQ(Event_T,(n))
#define IS_FREE(n)  TYPEQ(Free_T,(n))
#define IS_PAIR(n)  TYPEQ(Pair_T,(n))
#define IS_ACTOR(v) (IS_CAP(v) && TYPEQ(Actor_T,TO_REF(v)))
#define IS_FEXPR(n) TYPEQ(Fexpr_T,(n))
#define IS_DICT(n)  TYPEQ(Dict_T,(n))
#define IS_SYM(n)   TYPEQ(Symbol_T,(n))
#define IS_CODE(n)  TYPEQ(Instr_T,(n))

#if CONCURRENT_GC
#define MARK_CELL(n) gc_mark_cell(n)
#define FREE_CELL(n) gc_free_cell(n)
int_t gc_mark_cell(int_t addr);
int_t gc_free_cell(int_t addr);
#endif // CONCURRENT_GC

#if MARK_SWEEP_GC
#define MARK_CELL(n) (n)
#define FREE_CELL(n) (n)
i32 gc_mark_and_sweep(int_t dump);
i32 gc_safepoint();
#endif // MARK_SWEEP_GC

#define SANITY (420)
extern int_t sane;  // run-away loop prevention

#define CELL_MAX NAT(1<<14)  // 16K cells

extern cell_t *cell_zero;  // base for cell offsets
#if MEM_SAVES_ALL
#define cell_top (cell_zero[MEMORY].t)
#define cell_next (cell_zero[MEMORY].x)
#define gc_free_cnt (cell_zero[MEMORY].y)
#define gc_root_set (cell_zero[MEMORY].z)
#else
extern int_t cell_next;  // head of cell free-list (or NIL if empty)
extern int_t cell_top; // limit of allocated cell memory
extern int_t gc_free_cnt;  // number of cells in free-list
#endif

int_t cell_new(int_t t, int_t x, int_t y, int_t z);
int_t cell_free(int_t addr);
int_t actor_new(int_t ip, int_t sp);
int_t cons(int_t head, int_t tail);
int_t car(int_t v);
int_t cdr(int_t v);
int_t set_car(int_t v, int_t x);
int_t set_cdr(int_t v, int_t x);
int_t equal(int_t x, int_t y);
int_t list_len(int_t val);
int_t append_reverse(int_t head, int_t tail);  // destructive reverse-in-place and append
int_t fixnum(int_t str);  // return integer fixnum for character string
int_t symbol(int_t str);  // return interned symbol for character string
int_t char_in_class(int_t n, int_t c);
void print_symbol(int_t symbol);
char *get_cell_label(int_t addr);

int_t console_putc(int_t c);
int_t console_getc();
int_t warning(char *reason);
int_t error(char *reason);
int_t failure(char *_file_, int _line_);
int_t panic(char *reason);

#if RUNTIME_STATS
extern long gc_cycle_count;
#endif

#endif // _UFORK_H_
