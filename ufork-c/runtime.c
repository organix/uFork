/*
 * runtime.c -- uFork runtime (virtual CPU)
 * Copyright 2022 Dale Schumacher
 */

#include "ufork.h"
#include "runtime.h"
#include "debug.h"

// FORWARD DECLARATIONS
int_t event_new(int_t target, int_t message);
int_t event_q_put(int_t event);

/*
 * execution stack
 */

int_t stack_push(int_t value) {
    XTRACE(debug_print("stack push", value));
    int_t sp = GET_SP();
    sp = cons(value, sp);
    SET_SP(sp);
    return value;
}

int_t stack_pop() {
    int_t item = UNDEF;
    int_t sp = GET_SP();
    if (IS_PAIR(sp)) {
        item = car(sp);
        int_t rest = cdr(sp);
        SET_SP(rest);
        sp = XFREE(sp);
    } else {
        item = warning("stack underflow");
    }
    XTRACE(debug_print("stack pop", item));
    return item;
}

int_t stack_clear() {
    int_t ep = GET_EP();
    int_t me = get_x(ep);
    //XTRACE(debug_print("stack_clear me", me));
    ASSERT(IS_ACTOR(me));
    me = TO_REF(me);
    int_t stop = get_y(me);  // stop at new stack top
    //XTRACE(debug_print("stack_clear stop", stop));
    int_t sp = GET_SP();
    sane = SANITY;
    while ((sp != stop) && IS_PAIR(sp)) {
        int_t rest = cdr(sp);
        //XTRACE(debug_print("stack_clear free", sp));
        XFREE(sp);
        sp = rest;
        if (sane-- == 0) return panic("insane stack_clear");
    }
    return SET_SP(NIL);
}

/*
 * virtual opcodes
 */

PROC_DECL(vm_illegal) {
    return error("Illegal instruction!");
}

#define GET_IMMD() get_y(self)
#define GET_CONT() get_z(self)

PROC_DECL(vm_typeq) {
    int_t t = GET_IMMD();
    int_t v = stack_pop();
    if (t == Fixnum_T) {
        v = (IS_FIX(v) ? TRUE : FALSE);
    } else if (t == Actor_T) {
        v = (IS_ACTOR(v) ? TRUE : FALSE);
    } else if (IS_CELL(v)) {
        v = ((t == get_t(v)) ? TRUE : FALSE);
    } else {
        v = FALSE;  // _v_ out of range
    }
    stack_push(v);
    return GET_CONT();
}

PROC_DECL(vm_cell) {
    int_t n = TO_INT(GET_IMMD());
    int_t z = UNDEF;
    int_t y = UNDEF;
    int_t x = UNDEF;
    ASSERT(NAT(n) <= 4);
    if (n > 3) { z = stack_pop(); }
    if (n > 2) { y = stack_pop(); }
    if (n > 1) { x = stack_pop(); }
    int_t t = stack_pop();
    int_t v = cell_new(t, x, y, z);
    if (t == Actor_T) {
        // v = TO_CAP(v);
        return error("use vm_new to create Actors");
    }
    stack_push(v);
    return GET_CONT();
}

PROC_DECL(vm_get) {
    int_t f = GET_IMMD();
    int_t cell = stack_pop();
    int_t v = UNDEF;
    if (IS_CELL(cell)) {
        switch (f) {
            case FLD_T:     v = get_t(cell);    break;
            case FLD_X:     v = get_x(cell);    break;
            case FLD_Y:     v = get_y(cell);    break;
            case FLD_Z:     v = get_z(cell);    break;
            default:        return error("unknown field");
        }
    } else {
        TRACE(debug_print("vm_get v", v));
        v = warning("vm_get requires a cell");
    }
    stack_push(v);
    return GET_CONT();
}

PROC_DECL(vm_set) {
    int_t f = GET_IMMD();
    int_t v = stack_pop();
    int_t sp = GET_SP();
    int_t cell = car(sp);
    if ((f == FLD_T) && (v == Actor_T)) {
        return error("use vm_new to create Actors");
    }
    if (IS_CELL(cell)) {
        switch (f) {
            case FLD_T:     set_t(cell, v);     break;
            case FLD_X:     set_x(cell, v);     break;
            case FLD_Y:     set_y(cell, v);     break;
            case FLD_Z:     set_z(cell, v);     break;
            default:        return error("unknown field");
        }
    } else {
        TRACE(debug_print("vm_set v", v));
        return error("vm_set requires a cell");
    }
    return GET_CONT();
}

static int_t pop_pairs(int_t n) {
    int_t c;
    if (n > 0) {
        int_t h = stack_pop();
        int_t t = pop_pairs(n - 1);
        c = cons(h, t);
    } else {
        c = stack_pop();
    }
    return c;
}
PROC_DECL(vm_pair) {
    int_t n = TO_INT(GET_IMMD());
    int_t c = pop_pairs(n);
    stack_push(c);
    return GET_CONT();
}

static void push_parts(int_t n, int_t xs) {
    if (n > 0) {
        push_parts((n - 1), cdr(xs));
        int_t x = car(xs);
        stack_push(x);
    } else {
        stack_push(xs);
    }
}
PROC_DECL(vm_part) {
    int_t n = TO_INT(GET_IMMD());
    int_t c = stack_pop();
    push_parts(n, c);
    return GET_CONT();
}

static int_t extract_nth(int_t m, int_t n) {
    int_t v = UNDEF;
    if (n == 0) {  // entire list/message
        v = m;
    } else if (n > 0) {  // item at n-th index
        sane = SANITY;
        while (IS_PAIR(m)) {
            if (--n == 0) break;
            m = cdr(m);
            if (sane-- == 0) return panic("insane extract_nth");
        }
        if (n == 0) {
            v = car(m);
        }
    } else {  // use -n to select the n-th tail
        sane = SANITY;
        while (IS_PAIR(m)) {
            if (++n == 0) break;
            m = cdr(m);
            if (sane-- == 0) return panic("insane extract_nth");
        }
        if (n == 0) {
            v = cdr(m);
        }
    }
    return v;
}
PROC_DECL(vm_nth) {
    int_t n = TO_INT(GET_IMMD());
    int_t m = stack_pop();
    stack_push(extract_nth(m, n));
    return GET_CONT();
}

PROC_DECL(vm_push) {
    int_t v = GET_IMMD();
    stack_push(v);
    return GET_CONT();
}

PROC_DECL(vm_depth) {
    int_t n = 0;
    int_t sp = GET_SP();
    sane = SANITY;
    while (IS_PAIR(sp)) {  // count items on stack
        ++n;
        sp = cdr(sp);
        if (sane-- == 0) return panic("insane vm_depth");
    }
    stack_push(TO_FIX(n));
    return GET_CONT();
}

PROC_DECL(vm_drop) {
    int_t n = TO_INT(GET_IMMD());
    sane = SANITY;
    while (n-- > 0) {  // drop n items from stack
        stack_pop();
        if (sane-- == 0) return panic("insane vm_drop");
    }
    return GET_CONT();
}

PROC_DECL(vm_pick) {
    int_t n = TO_INT(GET_IMMD());
    int_t v = UNDEF;
    int_t sp = GET_SP();
    sane = SANITY;
    while (n-- > 0) {  // copy n-th item to top of stack
        v = car(sp);
        sp = cdr(sp);
        if (sane-- == 0) return panic("insane vm_pick");
    }
    stack_push(v);
    return GET_CONT();
}

PROC_DECL(vm_dup) {
    int_t n = TO_INT(GET_IMMD());
    int_t dup = NIL;
    int_t sp = GET_SP();
    sane = SANITY;
    while (n-- > 0) {  // copy n items from stack
        dup = cons(car(sp), dup);
        sp = cdr(sp);
        if (sane-- == 0) return panic("insane vm_dup");
    }
    SET_SP(append_reverse(dup, GET_SP()));
    return GET_CONT();
}

PROC_DECL(vm_roll) {
    int_t n = TO_INT(GET_IMMD());
    int_t sp = GET_SP();
    int_t pp = sp;
    sane = SANITY;
    if (n < 0) {  // roll top of stack to n-th item
        while (++n < 0) {
            sp = cdr(sp);
            if (sane-- == 0) return panic("insane vm_roll");
        }
        if (sp == NIL) {  // stack underflow
            stack_pop();
        } else if (sp != pp) {
            SET_SP(cdr(pp));
            set_cdr(pp, cdr(sp));
            set_cdr(sp, pp);
        }
    } else {
        while (--n > 0) {  // roll n-th item to top of stack
            pp = sp;
            sp = cdr(sp);
            if (sane-- == 0) return panic("insane vm_roll");
        }
        if (sp == NIL) {  // stack underflow
            stack_push(UNDEF);
        } else if (sp != pp) {
            set_cdr(pp, cdr(sp));
            set_cdr(sp, GET_SP());
            SET_SP(sp);
        }
    }
    return GET_CONT();
}

PROC_DECL(vm_alu) {
    int_t op = GET_IMMD();
    if (op == ALU_NOT) {  // special case for unary NOT
        int_t n = stack_pop();
        if (!IS_FIX(n)) return error("vm_alu requires Fixnum args");
        n = TO_INT(n);
        stack_push(TO_FIX(~n));
    } else {
        int_t m = stack_pop();
        if (!IS_FIX(m)) return error("vm_alu requires Fixnum args");
        m = TO_INT(m);
        int_t n = stack_pop();
        if (!IS_FIX(n)) return error("vm_alu requires Fixnum args");
        n = TO_INT(n);
        switch (op) {
            case ALU_AND:   stack_push(TO_FIX(n & m));  break;
            case ALU_OR:    stack_push(TO_FIX(n | m));  break;
            case ALU_XOR:   stack_push(TO_FIX(n ^ m));  break;
            case ALU_ADD:   stack_push(TO_FIX(n + m));  break;
            case ALU_SUB:   stack_push(TO_FIX(n - m));  break;
            case ALU_MUL:   stack_push(TO_FIX(n * m));  break;
            default:        return error("unknown operation");
        }
    }
    return GET_CONT();
}

PROC_DECL(vm_eq) {
    int_t n = GET_IMMD();
    int_t m = stack_pop();
    stack_push((n == m) ? TRUE : FALSE);
    return GET_CONT();
}

PROC_DECL(vm_cmp) {
    int_t rel = GET_IMMD();
    if (rel == CMP_EQ) {                // EQ works on *any* value
        int_t m = stack_pop();
        int_t n = stack_pop();
        stack_push((n == m) ? TRUE : FALSE);
    } else if (rel == CMP_NE) {         // NE works on *any* value
        int_t m = stack_pop();
        int_t n = stack_pop();
        stack_push((n != m) ? TRUE : FALSE);
    } else {                            // all other relations require numbers
        int_t m = stack_pop();
        if (!IS_FIX(m)) return error("vm_cmp relation requires Fixnum args");
        m = TO_INT(m);
        int_t n = stack_pop();
        if (!IS_FIX(n)) return error("vm_cmp relation requires Fixnum args");
        n = TO_INT(n);
        switch (rel) {
            case CMP_GE:    stack_push((n >= m) ? TRUE : FALSE);    break;
            case CMP_GT:    stack_push((n > m)  ? TRUE : FALSE);    break;
            case CMP_LT:    stack_push((n < m)  ? TRUE : FALSE);    break;
            case CMP_LE:    stack_push((n <= m) ? TRUE : FALSE);    break;
            case CMP_CLS: {  // character in class
                if (char_in_class(n, m)) {
                    stack_push(TRUE);
                } else {
                    stack_push(FALSE);
                }
                break;
            }
            default:        return error("unknown relation");
        }
    }
    return GET_CONT();
}

PROC_DECL(vm_if) {
    int_t b = stack_pop();
    //if (b == UNDEF) return error("undefined condition");
    int_t t = GET_IMMD();
    ASSERT(IS_CODE(t));
    int_t f = GET_CONT();
    ASSERT(IS_CODE(f));
    return ((b != FALSE) ? t : f);
}

PROC_DECL(vm_msg) {
    int_t n = TO_INT(GET_IMMD());
    int_t ep = GET_EP();
    int_t m = get_y(ep);
    stack_push(extract_nth(m, n));
    return GET_CONT();
}

PROC_DECL(vm_my) {
    int_t op = GET_IMMD();
    int_t ep = GET_EP();
    int_t me = get_x(ep);
    ASSERT(IS_ACTOR(me));
    me = TO_REF(me);
    switch (op) {
        case MY_SELF:   stack_push(TO_CAP(me));     break;
        case MY_BEH:    stack_push(get_x(me));      break;
        case MY_STATE:  stack_push(get_y(me));      break;
        default:        return error("unknown operation");
    }
    return GET_CONT();
}

static int_t pop_list(int_t n) {
    // FIXME: repurpose cells from the stack instead of allocating new ones...
    int_t c;
    if (n > 0) {
        int_t h = stack_pop();
        int_t t = pop_list(n - 1);
        c = cons(h, t);
    } else {
        c = NIL;
    }
    return c;
}
PROC_DECL(vm_send) {
    //XTRACE(debug_print("vm_send self", self));
    int_t n = TO_INT(GET_IMMD());
    int_t ep = GET_EP();
    int_t me = get_x(ep);
    //XTRACE(debug_print("vm_send me", me));
    ASSERT(IS_ACTOR(me));
    me = TO_REF(me);
    int_t a = stack_pop();  // target
    //XTRACE(debug_print("vm_send target", a));
    if (!IS_ACTOR(a)) {
        set_y(me, UNDEF);  // abort actor transaction
        return warning("vm_send requires an Actor");
    }
    int_t m = NIL;
    if (n == 0) {
        m = stack_pop();  // message
    } else if (n > 0) {
        m = pop_list(n);  // compose message
    } else {
        return error("vm_send (n < 0) invalid");
    }
    int_t ev = event_new(a, m);
    set_z(ev, get_z(me));  // append event to actor transaction
    set_z(me, ev);
    //XTRACE(debug_print("vm_send event", ev));
    return GET_CONT();
}

PROC_DECL(vm_new) {
    int_t n = TO_INT(GET_IMMD());
    if (n < 0) return error("vm_new (n < 0) invalid");
    int_t ip = stack_pop();  // behavior
    ASSERT(IS_CODE(ip));
#if 0
    while (n--) {
        // compose behavior
        int_t v = stack_pop();  // value
        ip = cell_new(Instr_T, VM_push, v, ip);
    }
    int_t a = actor_new(ip, NIL);
#else
    int_t sp = NIL;  // initial stack state for new actor
    if (n > 0) {
        sp = GET_SP();
        int_t np = sp;
        while (--n && IS_PAIR(np)) {
            np = cdr(np);
        }
        if (IS_PAIR(np)) {
            SET_SP(cdr(np));
            set_cdr(np, NIL);
        } else {
            SET_SP(NIL);
        }
    }
    int_t a = actor_new(ip, sp);
#endif
    if (IN_HEAP(a)) {
        a = TO_CAP(a);
    }
    stack_push(a);
    return GET_CONT();
}

PROC_DECL(vm_beh) {
    int_t n = TO_INT(GET_IMMD());
    if (n < 0) return error("vm_beh (n < 0) invalid");
    int_t ep = GET_EP();
    int_t me = get_x(ep);
    //XTRACE(debug_print("vm_beh me", me));
    ASSERT(IS_ACTOR(me));
    me = TO_REF(me);
    int_t ip = stack_pop();  // behavior
    ASSERT(IS_CODE(ip));
    set_x(me, ip);
    if (n > 0) {
        int_t sp = GET_SP();
        set_y(me, sp);
        while (--n && IS_PAIR(sp)) {
            sp = cdr(sp);
        }
        if (IS_PAIR(sp)) {
            SET_SP(cdr(sp));
            set_cdr(sp, NIL);
        } else {
            SET_SP(NIL);
        }
    } else {
        set_y(me, NIL);
    }
    //XTRACE(debug_print("vm_beh me'", me));
    return GET_CONT();
}

PROC_DECL(vm_end) {
    int_t n = GET_IMMD();
    int_t m = TO_INT(n);
    int_t ep = GET_EP();
    int_t me = get_x(ep);
    //XTRACE(debug_print("vm_end me", me));
    ASSERT(IS_ACTOR(me));
    me = TO_REF(me);
    int_t rv = UNIT;  // STOP
    if (m < 0) {  // ABORT
        int_t r = stack_pop();  // reason
        DEBUG(debug_print("ABORT!", r));
        stack_clear();
        set_z(me, UNDEF);  // abort actor transaction
        rv = FALSE;
    } else if (m > 0) {  // COMMIT
        if (n == END_RELEASE) {
            set_y(me, NIL);
        }
        stack_clear();
        int_t e = get_z(me);
        sane = SANITY;
        while (IS_EVENT(e)) {
            int_t es = get_z(e);
            event_q_put(e);
            e = es;
            if (sane-- == 0) return panic("insane COMMIT");
        }
        if (n == END_RELEASE) {
            me = XFREE(me);
        } else {
            set_z(me, UNDEF);  // commit actor transaction
        }
        rv = TRUE;
    }
    return rv;  // terminate thread
}

PROC_DECL(vm_cvt) {
    int_t c = GET_IMMD();
    int_t w = stack_pop();
    int_t v = UNDEF;
    switch (c) {
        case CVT_LST_NUM:   v = fixnum(w);      break;
        case CVT_LST_SYM:   v = symbol(w);      break;
        default:            v = error("unknown conversion");
    }
    stack_push(v);
    return GET_CONT();
}

PROC_DECL(vm_putc) {
    int_t c = stack_pop();
    console_putc(c);
    return GET_CONT();
}

PROC_DECL(vm_getc) {
    int_t c = console_getc();
    stack_push(c);
    return GET_CONT();
}

PROC_DECL(vm_debug) {
    int_t x = GET_IMMD();
    int_t v = stack_pop();
    //fprintf(stderr, "[%"PdI"] ", x);
    print_word("[", x);
    fprintf(stderr, "] ");
#if 1
    print_sexpr(v);
    fprintf(stderr, "\n");
#else
#if INCLUDE_DEBUG
    //debug_print("", v);
    print_list(v);
#else
    fprintf(stderr, "%"PdI"\n", v);
#endif
#endif
    return GET_CONT();
}

static proc_t proc_table[VM_OPCODES] = {
    vm_typeq,
    vm_cell,
    vm_get,
    vm_set,
    vm_pair,
    vm_part,
    vm_nth,
    vm_push,
    vm_depth,
    vm_drop,
    vm_pick,
    vm_dup,
    vm_roll,
    vm_alu,
    vm_eq,
    vm_cmp,
    vm_if,
    vm_msg,
    vm_my,
    vm_send,
    vm_new,
    vm_beh,
    vm_end,
    vm_cvt,
    vm_putc,
    vm_getc,
    vm_debug,
};

/*
 * actor event-queue
 */

int_t event_new(int_t target, int_t message) {
    ASSERT(IS_ACTOR(target));
    return cell_new(Event_T, target, message, NIL);
}

#if !MEM_SAVES_ALL
int_t e_queue_head = START;
int_t e_queue_tail = START;
#endif
#if RUNTIME_STATS
long event_count = 0;
#endif

#define event_q_empty() (!IS_EVENT(e_queue_head))

int_t event_q_put(int_t event) {
    XTRACE(debug_print("event_q_put", event));
    ASSERT(IS_EVENT(event));
    ASSERT(IS_ACTOR(get_x(event)));
    set_z(event, NIL);
    if (event_q_empty()) {
        e_queue_head = event;
    } else {
        set_z(e_queue_tail, event);
    }
    e_queue_tail = event;
    return event;
}

int_t event_q_pop() {
    if (event_q_empty()) return UNDEF; // event queue empty
    int_t event = e_queue_head;
    XTRACE(debug_print("event_q_pop", event));
    ASSERT(IS_EVENT(event));
    ASSERT(IS_ACTOR(get_x(event)));
    e_queue_head = get_z(event);
    set_z(event, NIL);
    if (event_q_empty()) {
        e_queue_tail = NIL;  // empty queue
    }
#if RUNTIME_STATS
    ++event_count;
#endif
    return event;
}

#if INCLUDE_DEBUG
int_t event_q_dump() {
    debug_print("e_queue_head", e_queue_head);
    int_t ep = e_queue_head;
    sane = SANITY;
    while (IS_EVENT(ep)) {
        fprintf(stderr, "-> %"PdI"{act=%"PdI",msg=%"PdI"}%s",
            ep, get_x(ep), get_y(ep), ((get_z(ep)==NIL)?"\n":""));
        ep = get_z(ep);
        if (sane-- == 0) return panic("insane event_q_dump");
    }
    return UNIT;
}
#endif

/*
 * VM continuation-queue
 */

int_t cont_new(int_t ip, int_t sp, int_t ep) {
    ASSERT(IS_CODE(ip));
    ASSERT((sp == NIL) || IS_PAIR(sp));
    ASSERT(IS_EVENT(ep));
    return cell_new(ip, sp, ep, NIL);
}

#if !MEM_SAVES_ALL
int_t k_queue_head = NIL;
int_t k_queue_tail = NIL;
#endif
#if RUNTIME_STATS
long instruction_count = 0;
#endif

#define cont_q_empty() (!IN_HEAP(k_queue_head))

int_t cont_q_put(int_t cont) {
    //XTRACE(debug_print("cont_q_put", cont));
    ASSERT(IN_HEAP(cont));
    //XTRACE(debug_print("cont_q_put code", get_t(cont)));
    ASSERT(IS_CODE(get_t(cont)));
    set_z(cont, NIL);
    if (cont_q_empty()) {
        k_queue_head = cont;
    } else {
        set_z(k_queue_tail, cont);
    }
    k_queue_tail = cont;
    return cont;
}

int_t cont_q_pop() {
    if (cont_q_empty()) return UNDEF; // cont queue empty
    int_t cont = k_queue_head;
    //XTRACE(debug_print("cont_q_pop", cont));
    ASSERT(IN_HEAP(cont));
    k_queue_head = get_z(cont);
    set_z(cont, NIL);
    if (cont_q_empty()) {
        k_queue_tail = NIL;  // empty queue
    }
#if RUNTIME_STATS
    ++instruction_count;
#endif
    return cont;
}

#if INCLUDE_DEBUG
int_t cont_q_dump() {
    debug_print("k_queue_head", k_queue_head);
    int_t kp = k_queue_head;
    sane = SANITY;
    while (IN_HEAP(kp)) {
        fprintf(stderr, "-> %"PdI"{ip=%"PdI",sp=%"PdI",ep=%"PdI"}%s",
            kp, get_t(kp), get_x(kp), get_y(kp), ((get_z(kp)==NIL)?"\n":""));
        kp = get_z(kp);
        if (sane-- == 0) return panic("insane cont_q_dump");
    }
    return UNIT;
}
#endif

/*
 * runtime (virtual machine engine)
 */

#if RUN_DEBUGGER
int_t runtime_trace = TRUE;
#else
int_t runtime_trace = FALSE;
#endif

typedef long clk_t;  // **MUST** be a _signed_ type to represent past/future
#define CLKS_PER_SEC ((clk_t)(CLOCKS_PER_SEC))
static clk_t clk_ticks() {
    return (clk_t)clock();
}
static int_t clk_handler = UNDEF;
static clk_t clk_timeout = 0;
int_t clk_init(int_t handler) {  // initialize clock device, return handler
    clk_handler = handler;
    clk_timeout = clk_ticks();
    return handler;
}
static int_t interrupt() {  // service interrupts (if any)
    clk_t now = clk_ticks();
    clk_t dt = (now - clk_timeout);
    XTRACE(fprintf(stderr, "clock (%ld - %ld) = %ld\n", (long)now, (long)clk_timeout, (long)dt));
    if (dt < 0) {
        return FALSE;
    }
    sane = SANITY;
    while (dt > 0) {
        XTRACE(fprintf(stderr, "clock (%ld - %ld) = %ld <%d>\n",
            (long)now, (long)clk_timeout, (long)dt, (dt > 0)));
        clk_timeout += CLKS_PER_SEC;
        dt = (now - clk_timeout);
        if (sane-- == 0) return panic("insane clk_timeout");
    }
    int_t sec = TO_FIX(now / CLKS_PER_SEC);
    if (IS_ACTOR(clk_handler)) {
        int_t ev = event_new(clk_handler, sec);
        DEBUG(debug_print("clock event", ev));
        event_q_put(ev);
    }
    return TRUE;
}
static int_t dispatch() {  // dispatch next event (if any)
#if CONCURRENT_GC
    gc_increment();  // perform an increment of concurrent GC
#endif
    XTRACE(event_q_dump());
    if (event_q_empty()) {
        return UNDEF;  // event queue empty
    }
    int_t event = event_q_pop();
    //XTRACE(debug_print("dispatch event", event));
    ASSERT(IS_EVENT(event));
    int_t target = get_x(event);
    XTRACE(debug_print("dispatch target", target));
    ASSERT(IS_ACTOR(target));
    target = TO_REF(target);
    if (get_z(target) != UNDEF) {  // target actor busy
#if INCLUDE_DEBUG
        if (runtime_trace != FALSE) {
            DEBUG(debug_print("dispatch busy", event));
        }
#endif
        event_q_put(event);  // re-queue event
        return FALSE;  // try busy actor later...
    }
    int_t ip = get_x(target);  // actor behavior (initial IP)
    //XTRACE(debug_print("dispatch ip", ip));
    ASSERT(IS_CODE(ip));
    int_t sp = get_y(target);  // actor state (initial SP)
    //XTRACE(debug_print("dispatch sp", sp));
    ASSERT((sp == NIL) || IS_PAIR(sp));
    // begin actor transaction
    set_z(target, NIL);  // start with empty set of new events
    // spawn new "thread" (continuation) to handle event
    int_t cont = cont_new(ip, sp, event);
    cont_q_put(cont);  // enqueue new continuation
#if INCLUDE_DEBUG
    if (runtime_trace != FALSE) {
        fprintf(stderr, "thread spawn: %"PdI"{ip=%"PdI",sp=%"PdI",ep=%"PdI"}\n",
            cont, get_t(cont), get_x(cont), get_y(cont));
    }
#endif
    return cont;
}
static int_t execute() {  // execute next VM instruction
    XTRACE(cont_q_dump());
    if (cont_q_empty()) {
        return error("no live threads");  // no more instructions to execute...
    }
    // execute next continuation
    XTRACE(debug_print("execute cont", k_queue_head));
    int_t ip = GET_IP();
    XTRACE(debug_print("execute inst", ip));
    //ASSERT(IS_CELL(ip));
    ASSERT(IS_CODE(ip));
#if INCLUDE_DEBUG
    if (debugger() == FALSE) {
        return FALSE;  // debugger quit
    }
#endif
    int_t event = GET_EP();
    int_t opcode = get_x(ip);
    nat_t ofs = NAT(TO_INT(opcode));
    if (ofs < VM_OPCODES) {
        ip = (proc_table[ofs])(ip, event);
    } else {
        ip = error("opcode expected");
    }
    SET_IP(ip);  // update IP
    int_t cont = cont_q_pop();
    XTRACE(debug_print("execute done", cont));
    if (IS_CODE(ip)) {
        cont_q_put(cont);  // enqueue continuation
    } else {
        // if "thread" is dead, free cont and event
        event = XFREE(event);
        cont = XFREE(cont);
#if MARK_SWEEP_GC
        gc_safepoint();
#endif
    }
    return UNIT;
}

int_t runtime() {
    int_t rv = UNIT;
    while (rv == UNIT) {
        rv = interrupt();
        rv = dispatch();
        rv = execute();
    }
    return rv;
}
