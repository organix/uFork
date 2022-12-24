/*
 * debug.c -- uFork debugging tools
 * Copyright 2022 Dale Schumacher
 */

#include "ufork.h"
#include "runtime.h"
#include "debug.h"

static char *cell_label(int_t cell) {
    static char *label[] = {
        "#?",       // UNDEF and Literal_T
        "()",       // NIL
        "#f",       // FALSE
        "#t",       // TRUE
        "#unit",    // UNIT
        "Type_T",
        "Event_T",
        "Instr_T",
        "Actor_T",
        "Fixnum_T",
        "Symbol_T",
        "Pair_T",
        //"Fexpr_T",
        "Dict_T",
        "Free_T",
    };
    if (NAT(cell) <= Free_T) return label[cell];
    if (IS_FIX(cell)) return "fix";
    if (IS_CAP(cell)) return "cap";
    return "cell";
}

void print_word(char* prefix, int_t word) {
    if (IS_FIX(word)) {
        fprintf(stderr, "%s%+"PdI"", prefix, TO_INT(word));
    } else if (IS_CAP(word)) {
        fprintf(stderr, "%s@%"PdI"", prefix, TO_REF(word));
    } else if (word == Fexpr_T) {
        fprintf(stderr, "%sFexpr_T", prefix);
    } else if (NAT(word) <= Free_T) {
        fprintf(stderr, "%s%s", prefix, cell_label(word));
    } else {
        fprintf(stderr, "%s^%"PdI"", prefix, word);
    }
}

static void print_type(char *prefix, int_t word) {
    if (word == Literal_T) {
        fprintf(stderr, "%sLiteral_T", prefix);
    } else if (word == Fexpr_T) {
        fprintf(stderr, "%sFexpr_T", prefix);
    } else if (NAT(word) <= Free_T) {
        fprintf(stderr, "%s%s", prefix, cell_label(word));
    } else {
        print_word(prefix, word);
    }
}

void print_quad(char* prefix, int_t quad) {
    fprintf(stderr, "%s", prefix);
    if (IS_VAL(quad)) {
        fprintf(stderr, "FIXNUM\n");
    } else {
        quad = TO_REF(quad);
        print_type("{t:", get_t(quad));
        print_word(",x:", get_x(quad));
        print_word(",y:", get_y(quad));
        print_word(",z:", get_z(quad));
        fprintf(stderr, "}\n");
    }
}

void print_sexpr(int_t x) {
    if (IS_FIX(x)) {
        fprintf(stderr, "%+"PdI"", TO_INT(x));
    } else if (NAT(x) <= Free_T) {
        fprintf(stderr, "%s", cell_label(x));
    } else if (IS_FREE(x)) {
        fprintf(stderr, "#FREE-CELL!");
    } else if (IS_SYM(x)) {
        print_symbol(x);
    } else if (IS_PAIR(x)) {
        char *s = "(";
        sane = SANITY;
        while (IS_PAIR(x)) {
            fprintf(stderr, "%s", s);
            if (sane-- == 0) {
                fprintf(stderr, "...)");
                return;
            }
            print_sexpr(car(x));
            s = " ";
            x = cdr(x);
        }
        if (x != NIL) {
            fprintf(stderr, " . ");
            print_sexpr(x);
        }
        fprintf(stderr, ")");
    } else if (IS_ACTOR(x)) {
        fprintf(stderr, "#actor@%"PdI"", TO_REF(x));
    } else if (IS_FEXPR(x)) {
        fprintf(stderr, "#fexpr@%"PdI"", x);
    } else if (IS_CODE(x)) {
        fprintf(stderr, "#code@%"PdI"", x);
    } else {
        fprintf(stderr, "^%"PdI"", x);
    }
}

#if INCLUDE_DEBUG

#if USE_INT16_T || (USE_INTPTR_T && (__SIZEOF_POINTER__ == 2))
void hexdump(char *label, int_t *addr, size_t cnt) {
    fprintf(stderr, "%s:", label);
    for (nat_t n = 0; n < cnt; ++n) {
        if ((n & 0x7) == 0x0) {
            fprintf(stderr, "\n%08"PRIxPTR":", (intptr_t)addr);
        }
        if ((n & 0x3) == 0x0) {
            fprintf(stderr, " ");
        }
        fprintf(stderr, " %04"PxI"", NAT(*addr++));
    }
    fprintf(stderr, "\n");
}
#endif
#if USE_INT32_T || (USE_INTPTR_T && (__SIZEOF_POINTER__ == 4))
void hexdump(char *label, int_t *addr, size_t cnt) {
    fprintf(stderr, "%s: %04"PxI"..", label, (NAT(addr) >> 16));
    for (nat_t n = 0; n < cnt; ++n) {
        if ((n & 0x7) == 0x0) {
            fprintf(stderr, "\n..%04"PxI":", (NAT(addr) & 0xFFFF));
        }
        fprintf(stderr, " %08"PxI"", NAT(*addr++) & 0xFFFFFFFF);
    }
    fprintf(stderr, "\n");
}
#endif
#if USE_INT64_T || (USE_INTPTR_T && (__SIZEOF_POINTER__ == 8))
void hexdump(char *label, int_t *addr, size_t cnt) {
    fprintf(stderr, "%s: %08"PxI"..", label, (NAT(addr) >> 32));
    for (nat_t n = 0; n < cnt; ++n) {
        if ((n & 0x3) == 0x0) {
            fprintf(stderr, "\n..%08"PxI":", (NAT(addr) & 0xFFFFFFFF));
        }
        fprintf(stderr, " %016"PxI"", NAT(*addr++));
    }
    fprintf(stderr, "\n");
}
#endif

void print_labelled(char *prefix, int_t addr) {
    print_word(prefix, addr);
    fprintf(stderr, "[$%"PxI"]", addr);
}

void debug_print(char *label, int_t addr) {
    fprintf(stderr, "%s: ", label);
    print_labelled("", addr);
    if (IS_CAP(addr)) {
        addr = TO_REF(addr);
    }
    if (IS_CELL(addr)) {
        fprintf(stderr, " =");
        print_labelled(" {t:", get_t(addr));
        print_labelled(", x:", get_x(addr));
        print_labelled(", y:", get_y(addr));
        print_labelled(", z:", get_z(addr));
        fprintf(stderr, "}");
    }
    fprintf(stderr, "\n");
}

void print_event(int_t ep) {
    print_word("(", get_x(ep));  // target actor
    int_t msg = get_y(ep);  // actor message
    sane = SANITY;
    while (IS_PAIR(msg)) {
        print_word(" ", car(msg));
        msg = cdr(msg);
        if (sane-- == 0) panic("insane print_event");
    }
    if (msg != NIL) {
        print_word(" . ", msg);
    }
    fprintf(stderr, ") ");
}

static void print_stack(int_t sp) {
    if (IS_PAIR(sp)) {
        print_stack(cdr(sp));
        int_t item = car(sp);
        //fprintf(stderr, " %s[%"PdI"]", cell_label(item), item);
        print_word(" ", item);
    }
}

static char *proc_label(int_t proc) {
    static char *label[VM_OPCODES] = {
        "VM_typeq",
        "VM_cell",
        "VM_get",
        "VM_set",
        "VM_pair",
        "VM_part",
        "VM_nth",
        "VM_push",
        "VM_depth",
        "VM_drop",
        "VM_pick",
        "VM_dup",
        "VM_roll",
        "VM_alu",
        "VM_eq",
        "VM_cmp",
        "VM_if",
        "VM_msg",
        "VM_my",
        "VM_send",
        "VM_new",
        "VM_beh",
        "VM_end",
        "VM_cvt",
        "VM_putc",
        "VM_getc",
        "VM_debug",
    };
    nat_t ofs = NAT(TO_INT(proc));
    if (ofs < VM_OPCODES) return label[ofs];
    return "<unknown>";
}

static char *field_label(int_t f) {
    switch (f) {
        case FLD_T:     return "T";
        case FLD_X:     return "X";
        case FLD_Y:     return "Y";
        case FLD_Z:     return "Z";
    }
    return "<unknown>";
}

static char *operation_label(int_t op) {
    switch (op) {
        case ALU_NOT:   return "NOT";
        case ALU_AND:   return "AND";
        case ALU_OR:    return "OR";
        case ALU_XOR:   return "XOR";
        case ALU_ADD:   return "ADD";
        case ALU_SUB:   return "SUB";
        case ALU_MUL:   return "MUL";
    }
    return "<unknown>";
}

static char *relation_label(int_t r) {
    switch (r) {
        case CMP_EQ:    return "EQ";
        case CMP_GE:    return "GE";
        case CMP_GT:    return "GT";
        case CMP_LT:    return "LT";
        case CMP_LE:    return "LE";
        case CMP_NE:    return "NE";
        case CMP_CLS:   return "CLS";
    }
    return "<unknown>";
}

static char *my_label(int_t f) {
    switch (f) {
        case MY_SELF:   return "SELF";
        case MY_BEH:    return "BEH";
        case MY_STATE:  return "STATE";
    }
    return "<unknown>";
}

static char *end_label(int_t t) {
    switch (t) {
        case END_ABORT:     return "ABORT";
        case END_STOP:      return "STOP";
        case END_COMMIT:    return "COMMIT";
        case END_RELEASE:   return "RELEASE";
    }
    return "<unknown>";
}

static char *conversion_label(int_t f) {
    switch (f) {
        case CVT_LST_NUM:   return "LST_NUM";
        case CVT_LST_SYM:   return "LST_SYM";
    }
    return "<unknown>";
}

void print_inst(int_t ip) {
    if (!IS_CODE(ip)) {
        print_quad("", ip);
        return;
    }
    int_t op = get_x(ip);
    int_t immd = get_y(ip);
    int_t cont = get_z(ip);
    fprintf(stderr, "%s", proc_label(op));
    switch (op) {
        case VM_typeq:print_type("{t:", immd); fprintf(stderr, ",k:%"PdI"}", cont); break;
        case VM_cell: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_get:  fprintf(stderr, "{f:%s,k:%"PdI"}", field_label(immd), cont); break;
        case VM_set:  fprintf(stderr, "{f:%s,k:%"PdI"}", field_label(immd), cont); break;
        case VM_pair: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_part: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_nth:  fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_push: print_word("{v:", immd); fprintf(stderr, ",k:%"PdI"}", cont); break;
        case VM_depth:fprintf(stderr, "{k:%"PdI"}", cont); break;
        case VM_drop: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_pick: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_dup:  fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_roll: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_alu:  fprintf(stderr, "{op:%s,k:%"PdI"}", operation_label(immd), cont); break;
        case VM_eq:   print_word("{v:", immd); fprintf(stderr, ",k:%"PdI"}", cont); break;
        case VM_cmp:  fprintf(stderr, "{op:%s,k:%"PdI"}", relation_label(immd), cont); break;
        case VM_if:   fprintf(stderr, "{t:%"PdI",f:%"PdI"}", immd, cont); break;
        case VM_msg:  fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_my:   fprintf(stderr, "{op:%s,k:%"PdI"}", my_label(immd), cont); break;
        case VM_send: fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_new:  fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_beh:  fprintf(stderr, "{n:%+"PdI",k:%"PdI"}", TO_INT(immd), cont); break;
        case VM_end:  fprintf(stderr, "{op:%s}", end_label(immd)); break;
        case VM_cvt:  fprintf(stderr, "{op:%s,k:%"PdI"}", conversion_label(immd), cont); break;
        case VM_putc: fprintf(stderr, "{k:%"PdI"}", cont); break;
        case VM_getc: fprintf(stderr, "{k:%"PdI"}", cont); break;
        case VM_debug:print_word("{l:", immd); fprintf(stderr, ",k:%"PdI"}", cont); break;
        default:      fprintf(stderr, "{ILLEGAL op:%"PdI"}", op); break;
    }
    fprintf(stderr, "\n");
}

void print_list(int_t xs) {
    print_word("  ", xs);  // non-list value
    if (!IS_PAIR(xs)) {
        print_quad(" = ", xs);
        return;
    }
    print_word(" = (", car(xs));
    xs = cdr(xs);
    int limit = 8;
    while (IS_PAIR(xs)) {
        print_word(" ", car(xs));
        xs = cdr(xs);
        if (limit-- == 0) {
            fprintf(stderr, " ...)\n");
            return;
        }
    }
    if (xs != NIL) {
        print_word(" . ", xs);
    }
    fprintf(stderr, ")\n");
}

void continuation_trace() {
    print_event(GET_EP());
    fprintf(stderr, "%"PdI":", GET_IP());
    print_stack(GET_SP());
    fprintf(stderr, " ");
    print_inst(GET_IP());
}

static void print_fixed(int width, int_t value) {
    if (IS_FIX(value)) {
        fprintf(stderr, "%+*"PdI"", width, TO_INT(value));
    } else if (IS_CAP(value)) {
        fprintf(stderr, "%*"PdI"*", (width - 1), TO_REF(value));
    } else {
        fprintf(stderr, "%*"PdI"", width, value);
    }
}

void disassemble(int_t ip, int_t n) {
    sane = CELL_MAX;  // a better upper-bound than SANITY...
    while (n-- > 0) {
        char *label = get_cell_label(ip);
        if (*label) {
            fprintf(stderr, "%s\n", label);
        }
        print_fixed(6, ip);
        fprintf(stderr, ": ");
        print_fixed(6, get_t(ip));
        fprintf(stderr, " ");
        print_fixed(6, get_x(ip));
        fprintf(stderr, " ");
        print_fixed(6, get_y(ip));
        fprintf(stderr, " ");
        print_fixed(6, get_z(ip));
        fprintf(stderr, "  ");
        print_inst(ip);
        ++ip;
        if (sane-- == 0) panic("insane disassemble");
    }
}

static char *db_cmd_token(char **pp) {
    char *p = *pp;
    while (*p > ' ') {
        ++p;
    }
    if (*p && (*p <= ' ')) {
        *p++ = '\0';
    }
    char *q = *pp;
    *pp = p;
    return q;
}
/*
static int_t db_cmd_eq(char *actual, char *expect) {
    sane = 16;
    while (*expect) {
        if (*expect++ != *actual++) return FALSE;
        if (sane-- == 0) return panic("insane db_cmd_eq");
    }
    return (*actual ? FALSE : TRUE);
}
*/
static int_t db_num_cmd(char *cmd) {
    int_t n = 0;
    nat_t d;
    sane = 16;
    while ((d = NAT(*cmd++ - '0')) < 10) {
        n = (n * 10) + d;
        if (sane-- == 0) return panic("insane db_num_cmd");
    }
    return n;
}
int_t debugger() {
#if RUN_DEBUGGER
    static int_t run = FALSE;   // single-stepping
#else
    static int_t run = TRUE;    // free-running
#endif
    static int_t bp_ip = 0;
    static int_t wp_cell = 0;
    static cell_t wp_data;
    static int_t s_cnt = 0;
    static int_t n_cnt = 0;
    static int_t n_ep = 0;
    static char buf[32];        // command buffer

    int_t skip = ((run != FALSE) ? TRUE : FALSE);
    if ((skip == FALSE) && (s_cnt > 0)) {
        if (--s_cnt) skip = TRUE;
    }
    if ((skip == FALSE) && n_ep) {
        if (n_ep != GET_EP()) {
            skip = TRUE;
        } else if (n_cnt > 0) {
            if (--n_cnt) skip = TRUE;
        }
    }
    if (GET_IP() == bp_ip) {
        skip = FALSE;
    }
    if (wp_cell) {
        if ((get_t(wp_cell) != wp_data.t)
        ||  (get_x(wp_cell) != wp_data.x)
        ||  (get_y(wp_cell) != wp_data.y)
        ||  (get_z(wp_cell) != wp_data.z)) {
            //debug_print("watchpoint", wp_cell);
            print_labelled("watchpoint: ", wp_cell);
            fprintf(stderr, " =");
            print_labelled(" {t:", wp_data.t);
            print_labelled(", x:", wp_data.x);
            print_labelled(", y:", wp_data.y);
            print_labelled(", z:", wp_data.z);
            fprintf(stderr, "}\n");
            //debug_print("changed to", wp_cell);
            debug_print("   updated", wp_cell);
            wp_data = cell_zero[wp_cell];  // update cached value
            skip = FALSE;
        }
    }
    if (skip != FALSE) {
        if (runtime_trace != FALSE) {
            continuation_trace();
        }
        return TRUE;  // continue
    }
    run = FALSE;
    s_cnt = 0;
    n_cnt = 0;
    n_ep = 0;
    while (1) {
        continuation_trace();
        fprintf(stderr, "@ ");  // debugger prompt
        char *p = fgets(buf, sizeof(buf), stdin);
        if (!p) {
            fprintf(stderr, "\n");
            return FALSE;                   // exit
        }
        char *cmd = db_cmd_token(&p);
        if (*cmd == 'q') return FALSE;      // quit
        if (*cmd == 'b') {                  // break(point)
            cmd = db_cmd_token(&p);
            int ip = GET_IP();
            if (*cmd) {
                ip = db_num_cmd(cmd);
            }
            bp_ip = ip;
            if (bp_ip) {
                fprintf(stderr, "break at ip=%"PdI"\n", bp_ip);
            } else {
                fprintf(stderr, "no breakpoint\n");
            }
            continue;
        }
        if (*cmd == 'w') {                  // watch(point)
            cmd = db_cmd_token(&p);
            int wp = wp_cell;
            if (*cmd) {
                wp = db_num_cmd(cmd);
            }
            wp_cell = wp;
            if (wp_cell) {
                wp_data = cell_zero[wp_cell];
                fprintf(stderr, "watch cell=%"PdI"\n", wp_cell);
            } else {
                fprintf(stderr, "no watch cell\n");
            }
            continue;
        }
        if (*cmd == 's') {                  // step
            cmd = db_cmd_token(&p);
            int cnt = db_num_cmd(cmd);
            s_cnt = ((cnt < 1) ? 1 : cnt);
            return TRUE;
        }
        if (*cmd == 'n') {                  // next
            cmd = db_cmd_token(&p);
            int cnt = db_num_cmd(cmd);
            n_cnt = ((cnt < 1) ? 1 : cnt);
            n_ep = GET_EP();
            return TRUE;
        }
        if (*cmd == 'd') {                  // disasm
            cmd = db_cmd_token(&p);
            int cnt = db_num_cmd(cmd);
            cnt = ((cnt < 1) ? 1 : cnt);
            cmd = db_cmd_token(&p);
            int ip = GET_IP();
            if (*cmd) {
                ip = db_num_cmd(cmd);
            }
            disassemble(ip, cnt);
            continue;
        }
        if (*cmd == 'p') {                  // print
            cmd = db_cmd_token(&p);
            int_t addr = db_num_cmd(cmd);
            print_list(addr);
            continue;
        }
        if (*cmd == 't') {                  // trace
            runtime_trace = ((runtime_trace != FALSE) ? FALSE : TRUE);
            fprintf(stderr, "instruction tracing %s\n",
                ((runtime_trace != FALSE) ? "on" : "off"));
            continue;
        }
        if (*cmd == 'i') {
            char *cmd = db_cmd_token(&p);
            if (*cmd == 'r') {              // info regs
                fprintf(stderr, "ip=%"PdI" sp=%"PdI" ep=%"PdI" free=%"PdI"\n",
                    GET_IP(), GET_SP(), GET_EP(), cell_next);
                continue;
            }
            if (*cmd == 't') {              // info threads
                cont_q_dump();
                continue;
            }
            if (*cmd == 'e') {              // info events
                event_q_dump();
                continue;
            }
#if RUNTIME_STATS
            if (*cmd == 's') {              // info statistics
                fprintf(stderr, "events=%ld instructions=%ld gc_cycles=%ld\n",
                    event_count, instruction_count, gc_cycle_count);
                // reset counters
                event_count = 0;
                instruction_count = 0;
                gc_cycle_count = 0;
                continue;
            }
            fprintf(stderr, "info: r[egs] t[hreads] e[vents] s[tats]\n");
#else
            fprintf(stderr, "info: r[egs] t[hreads] e[vents]\n");
#endif
            continue;
        }
        if (*cmd == 'c') {                  // continue
            run = TRUE;
            return TRUE;
        }
        if (*cmd == 'h') {
            char *cmd = db_cmd_token(&p);
            switch (*cmd) {
                case 'h' : fprintf(stderr, "h[elp] <command> -- get help on <command>\n"); continue;
                case 'b' : fprintf(stderr, "b[reak] <inst> -- set breakpoint at <inst> (0=none, default: IP)\n"); continue;
                case 'w' : fprintf(stderr, "w[atch] <addr> -- set watchpoint on <addr> (0=none)\n"); continue;
                case 'c' : fprintf(stderr, "c[ontinue] -- continue running freely\n"); continue;
                case 's' : fprintf(stderr, "s[tep] <n> -- step <n> instructions (default: 1)\n"); continue;
                case 'n' : fprintf(stderr, "n[ext] <n> -- next <n> instructions in thread (default: 1)\n"); continue;
                case 'd' : fprintf(stderr, "d[isasm] <n> <inst> -- disassemble <n> instructions (defaults: 1 IP)\n"); continue;
                case 'p' : fprintf(stderr, "p[rint] <addr> -- print value at <addr>\n"); continue;
                case 't' : fprintf(stderr, "t[race] -- toggle instruction tracing (default: on)\n"); continue;
                case 'i' : fprintf(stderr, "i[nfo] <topic> -- get information on <topic>\n"); continue;
                case 'q' : fprintf(stderr, "q[uit] -- quit runtime\n"); continue;
            }
        }
#if CONCURRENT_GC
        if (*cmd == 'g') {  // undocumented command to display memory map
            gc_dump_map();
            continue;
        }
#endif
#if MARK_SWEEP_GC
        if (*cmd == 'g') {  // undocumented command to perform garbage collection
            gc_mark_and_sweep(TRUE);
            continue;
        }
#endif
        //fprintf(stderr, "h[elp] b[reak] c[ontinue] s[tep] n[ext] d[isasm] p[rint] t[race] i[nfo] q[uit]\n");
        fprintf(stderr, "b[reak] w[atch] c[ontinue] s[tep] n[ext] d[isasm] p[rint] t[race] i[nfo] q[uit]\n");
    }
}
#endif // INCLUDE_DEBUG
