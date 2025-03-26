// Constants and helper functions for 32-bit uFork implementations.

/*jslint global, bitwise, white */

// Type-tag bits

const MSK_RAW   = 0xF0000000;  // mask for type-tag bits
const DIR_RAW   = 0x80000000;  // 1=direct/fixnum, 0=indirect/pointer
const MUT_RAW   = 0x40000000;  // 1=read-write/mutable, 0=read-only/immutable
const OPQ_RAW   = 0x20000000;  // 1=opaque/capability, 0=transparent/navigable

// Raw constants

const UNDEF_RAW = 0x00000000;
const NIL_RAW   = 0x00000001;
const FALSE_RAW = 0x00000002;
const TRUE_RAW  = 0x00000003;
//const ROM_04    = 0x00000004;  // reserved
const EMPTY_DQ  = 0x00000005;
const TYPE_T    = 0x00000006;
const FIXNUM_T  = 0x00000007;
const ACTOR_T   = 0x00000008;
const PROXY_T   = 0x00000009;
const STUB_T    = 0x0000000A;
const INSTR_T   = 0x0000000B;
const PAIR_T    = 0x0000000C;
const DICT_T    = 0x0000000D;
const FWD_REF_T = 0x0000000E;
const FREE_T    = 0x0000000F;

// Instruction constants

const VM_DEBUG  = 0x80000000;  // +0
const VM_JUMP   = 0x80000001;  // +1
const VM_PUSH   = 0x80000002;  // +2
const VM_IF     = 0x80000003;  // +3
//const VM_04     = 0x80000004;  // reserved
const VM_TYPEQ  = 0x80000005;  // +5
const VM_EQ     = 0x80000006;  // +6
const VM_ASSERT = 0x80000007;  // +7

const VM_SPONSOR= 0x80000008;  // +8
const VM_ACTOR  = 0x80000009;  // +9
const VM_DICT   = 0x8000000A;  // +10
const VM_DEQUE  = 0x8000000B;  // +11
//const VM_0C     = 0x8000000C;  // reserved
const VM_ALU    = 0x8000000D;  // +13
const VM_CMP    = 0x8000000E;  // +14
const VM_END    = 0x8000000F;  // +15

const VM_QUAD   = 0x80000010;  // +16
const VM_PAIR   = 0x80000011;  // +17
const VM_PART   = 0x80000012;  // +18
const VM_NTH    = 0x80000013;  // +19
const VM_PICK   = 0x80000014;  // +20
const VM_ROLL   = 0x80000015;  // +21
const VM_DUP    = 0x80000016;  // +22
const VM_DROP   = 0x80000017;  // +23

const VM_MSG    = 0x80000018;  // +24
const VM_STATE  = 0x80000019;  // +25
//const VM_1A     = 0x8000001A;  // reserved
//const VM_1B     = 0x8000001B;  // reserved
//const VM_1C     = 0x8000001C;  // reserved
//const VM_1D     = 0x8000001D;  // reserved
//const VM_1E     = 0x8000001E;  // reserved
//const VM_1F     = 0x8000001F;  // reserved

// Memory limits (from core.rs)

const QUAD_ROM_MAX = 1 << 13;
const QUAD_RAM_MAX = 1 << 12;
const BLOB_RAM_MAX = 1 << 16;

// Memory layout (from core.rs)

const MEMORY_OFS = 0;
const DDEQUE_OFS = 1;
const DEBUG_DEV_OFS = 2;
const CLOCK_DEV_OFS = 3;
const TIMER_DEV_OFS = 4;
const IO_DEV_OFS = 5;
const BLOB_DEV_OFS = 6;
const RANDOM_DEV_OFS = 7;
const HOST_DEV_OFS = 14;
const SPONSOR_OFS = 15;

// Error codes (from core.rs)

const E_OK = 0;
const E_FAIL = -1;
const E_BOUNDS = -2;
const E_NO_MEM = -3;
const E_NOT_FIX = -4;
const E_NOT_CAP = -5;
const E_NOT_PTR = -6;
const E_NOT_ROM = -7;
const E_NOT_RAM = -8;
const E_NOT_EXE = -9;
const E_NO_TYPE = -10;
const E_MEM_LIM = -11;
const E_CPU_LIM = -12;
const E_MSG_LIM = -13;
const E_ASSERT = -14;
const E_STOP = -15;
const E_ABORT = -16;

// Log levels

const LOG_NONE = 0;
const LOG_INFO = 1;
const LOG_WARN = 2;
const LOG_DEBUG = 3;
const LOG_TRACE = 4;

// Strings

const rom_label = [
    "#?",
    "#nil",
    "#f",
    "#t",
    "ROM_04",  // reserved
    "EMPTY_DQ",
    "#type_t",
    "#fixnum_t",
    "#actor_t",
    "PROXY_T",
    "STUB_T",
    "#instr_t",
    "#pair_t",
    "#dict_t",
    "FWD_REF_T",
    "FREE_T"
];
const error_messages = [
    "no error",                         // E_OK = 0
    "general failure",                  // E_FAIL = -1
    "out of bounds",                    // E_BOUNDS = -2
    "no memory available",              // E_NO_MEM = -3
    "fixnum required",                  // E_NOT_FIX = -4
    "capability required",              // E_NOT_CAP = -5
    "memory pointer required",          // E_NOT_PTR = -6
    "ROM pointer required",             // E_NOT_ROM = -7
    "RAM pointer required",             // E_NOT_RAM = -8
    "instruction required",             // E_NOT_EXE = -9
    "type required",                    // E_NO_TYPE = -10
    "sponsor memory limit reached",     // E_MEM_LIM = -11
    "sponsor cycle limit reached",      // E_CPU_LIM = -12
    "sponsor event limit reached",      // E_MSG_LIM = -13
    "assertion failed",                 // E_ASSERT = -14
    "actor stopped",                    // E_STOP = -15
    "actor transaction aborted"         // E_ABORT = -16
];
const gc_labels = [
    "free",
    "gen_x",
    "gen_y",
    "scan"
];
const op_labels = Object.freeze([
    "debug",
    "jump",
    "push",
    "if",
    "VM_04",        // reserved
    "typeq",
    "eq",
    "assert",
    "sponsor",
    "actor",
    "dict",
    "deque",
    "VM_0C",        // reserved
    "alu",
    "cmp",
    "end",
    "quad",
    "pair",
    "part",
    "nth",
    "pick",
    "roll",
    "dup",
    "drop",
    "msg",
    "state",
    "VM_1A",        // reserved
    "VM_1B",        // reserved
    "VM_1C",        // reserved
    "VM_1D",        // reserved
    "VM_1E",        // reserved
    "VM_1F"         // reserved
]);
let imm_labels = Object.create(null);
imm_labels[VM_DICT] = Object.freeze([
    "has",
    "get",
    "add",
    "set",
    "del"
]);
imm_labels[VM_ALU] = Object.freeze([
    "not",
    "and",
    "or",
    "xor",
    "add",
    "sub",
    "mul",
    "div",          // reserved
    "lsl",
    "lsr",
    "asr",
    "rol",
    "ror"
]);
imm_labels[VM_CMP] = Object.freeze([
    "eq",
    "ge",
    "gt",
    "lt",
    "le",
    "ne"
]);
imm_labels[VM_ACTOR] = Object.freeze([
    "send",
    "post",
    "create",
    "become",
    "self"
]);
imm_labels[VM_DEQUE] = Object.freeze([
    "new",
    "empty",
    "push",
    "pop",
    "put",
    "pull",
    "len"
]);
imm_labels[VM_END] = Object.freeze([
    "abort",
    "stop",
    "commit"
]);
imm_labels[VM_SPONSOR] = Object.freeze([
    "new",
    "memory",
    "events",
    "cycles",
    "reclaim",
    "start",
    "stop"
]);
Object.freeze(imm_labels);

// CRLF

const crlf_literals = Object.freeze({
    undef: UNDEF_RAW,
    nil: NIL_RAW,
    false: FALSE_RAW,
    true: TRUE_RAW
});
const crlf_types = Object.freeze({
    fixnum: FIXNUM_T,
    type: TYPE_T,
    pair: PAIR_T,
    dict: DICT_T,
    instr: INSTR_T,
    actor: ACTOR_T
});

function fault_msg(error_code) {
    return (
        error_code < 0
        ? error_messages[-error_code] ?? "unknown fault"
        : error_messages[0]
    );
}

function is_raw(value) {
    return (Number.isSafeInteger(value) && value >= 0 && value < 2 ** 32);
}

function is_fix(raw) {
    return ((raw & DIR_RAW) !== 0);
}

function is_cap(raw) {
    return ((raw & (DIR_RAW | MUT_RAW | OPQ_RAW)) === (MUT_RAW | OPQ_RAW));
}

function is_rom(raw) {
    return ((raw & (DIR_RAW | MUT_RAW)) === 0);
}

function is_ram(raw) {
    return ((raw & (DIR_RAW | MUT_RAW | OPQ_RAW)) === MUT_RAW);
}

function is_ptr(raw) {
    return is_rom(raw) || is_ram(raw);  // excludes ocaps
}

function fixnum(i32) {
    return ((i32 | DIR_RAW) >>> 0);
}

function rawofs(raw) {
    return (raw & ~MSK_RAW);
}

function romptr(ofs) {
    return rawofs(ofs);
}

function ramptr(ofs) {
    return (rawofs(ofs) | MUT_RAW);
}

function fix_to_i32(fixnum) {
    return (fixnum << 1) >> 1;
}

function cap_to_ptr(cap) {
    return (
        (cap & (DIR_RAW | MUT_RAW)) === MUT_RAW  // mutable
        ? cap & ~OPQ_RAW  // clear opaque bit
        : UNDEF_RAW
    );
}

function ptr_to_cap(ptr) {
    return (
        (ptr & (DIR_RAW | MUT_RAW)) === MUT_RAW  // mutable
        ? ptr | OPQ_RAW  // set opaque bit
        : UNDEF_RAW
    );
}

function in_mem(ptr) {
    return (ptr > FREE_T) && !is_fix(ptr);
}

function read_quad(mem, ofs) {
    const data_view = new DataView(mem.buffer, mem.byteOffset, mem.byteLength);
    const byte_nr = ofs << 4;
    if (byte_nr <= mem.byteLength - 16) {
        return {
            t: data_view.getUint32(byte_nr, true),
            x: data_view.getUint32(byte_nr + 4, true),
            y: data_view.getUint32(byte_nr + 8, true),
            z: data_view.getUint32(byte_nr + 12, true)
        };
    }
}

function write_quad(mem, ofs, quad) {
    const data_view = new DataView(mem.buffer, mem.byteOffset, mem.byteLength);
    const byte_nr = ofs << 4;
    if (byte_nr <= mem.byteLength - 16) {
        data_view.setUint32(byte_nr, quad.t ?? UNDEF_RAW, true);
        data_view.setUint32(byte_nr + 4, quad.x ?? UNDEF_RAW, true);
        data_view.setUint32(byte_nr + 8, quad.y ?? UNDEF_RAW, true);
        data_view.setUint32(byte_nr + 12, quad.z ?? UNDEF_RAW, true);
    }
}

function test_read_write_quad() {
    let mem = new Uint8Array(48); // 3 quads
    write_quad(mem, 1, {t: 1, x: 2, y: 3, z: 4});
    if (
        read_quad(mem, 0).t !== 0
        || read_quad(mem, 0).x !== 0
        || read_quad(mem, 0).y !== 0
        || read_quad(mem, 0).z !== 0
        || read_quad(mem, 1).t !== 1
        || read_quad(mem, 1).x !== 2
        || read_quad(mem, 1).y !== 3
        || read_quad(mem, 1).z !== 4
    ) {
        throw new Error("FAIL read_quad/write_quad");
    }
}

function current_continuation(ram) {
    const dd_quad = read_quad(ram, DDEQUE_OFS);
    if (dd_quad !== undefined) {
        const k_first = dd_quad.y;
        if (in_mem(k_first)) {
            const k_quad = read_quad(ram, rawofs(k_first));
            const e_quad = read_quad(ram, rawofs(k_quad.y));
            return {
                ip: k_quad.t,
                sp: k_quad.x,
                ep: k_quad.y,
                act: e_quad.x,
                msg: e_quad.y,
                spn: e_quad.t
            };
        }
    }
}

function print(raw) {
    if (!Number.isSafeInteger(raw)) {
        return String(raw);
    }
    if (is_fix(raw)) {  // fixnum
        const i32 = fix_to_i32(raw);
        if (i32 < 0) {
            return String(i32);
        } else {
            return "+" + i32;
        }
    }
    if (raw < rom_label.length) {
        return rom_label[raw];
    }
    const prefix = (
        is_cap(raw)
        ? "@"
        : "^"
    );
    return prefix + raw.toString(16).padStart(8, "0");
}

function print_gc_color(color) {
    const integer = fix_to_i32(color);
    return gc_labels[integer];
}

function instr_parts(quad) {
    if (quad.t === INSTR_T && is_fix(quad.x)) {
        const op = fix_to_i32(quad.x);
        const op_label = op_labels[op];
        if (op_label !== undefined) {
            const imm = fix_to_i32(quad.y);
            const op_imm_labels = imm_labels[quad.x];
            const fudge = (
                quad.x === VM_END
                ? 1
                : 0
            );
            if (
                is_fix(quad.y)
                && op_imm_labels !== undefined
                && op_imm_labels[imm + fudge] !== undefined
            ) {
                return {op: op_label, imm: op_imm_labels[imm + fudge]};
            }
            return {op: op_label};
        }
    }
}

function print_quad(quad) {
    let s = "[";
    s += print(quad.t);
    s += ", ";
    if (quad.t === INSTR_T) {
        const parts = instr_parts(quad);
        if (parts?.op !== undefined) {
            s += parts.op;
            s += ", ";
            if (parts.imm !== undefined) {
                s += parts.imm;
            } else {
                s += print(quad.y);
            }
        } else {
            s += print(quad.x);
            s += ", ";
            s += print(quad.y);
        }
    } else {
        s += print(quad.x);
        s += ", ";
        s += print(quad.y);
    }
    s += ", ";
    s += print(quad.z);
    s += "]";
    return s;
}

const reserved_rom = Object.freeze([
    UNDEF_RAW,  UNDEF_RAW,  UNDEF_RAW,  UNDEF_RAW,      // #?
    UNDEF_RAW,  UNDEF_RAW,  UNDEF_RAW,  UNDEF_RAW,      // #nil
    UNDEF_RAW,  UNDEF_RAW,  UNDEF_RAW,  UNDEF_RAW,      // #f
    UNDEF_RAW,  UNDEF_RAW,  UNDEF_RAW,  UNDEF_RAW,      // #t
    UNDEF_RAW,  UNDEF_RAW,  UNDEF_RAW,  UNDEF_RAW,      // ROM_04
    PAIR_T,     NIL_RAW,    NIL_RAW,    UNDEF_RAW,      // EMPTY_DQ
    TYPE_T,     fixnum(1),  UNDEF_RAW,  UNDEF_RAW,      // #type_t
    TYPE_T,     UNDEF_RAW,  UNDEF_RAW,  UNDEF_RAW,      // #fixnum_t
    TYPE_T,     fixnum(2),  UNDEF_RAW,  UNDEF_RAW,      // #actor_t
    TYPE_T,     fixnum(2),  UNDEF_RAW,  UNDEF_RAW,      // PROXY_T
    TYPE_T,     fixnum(3),  UNDEF_RAW,  UNDEF_RAW,      // STUB_T
    TYPE_T,     fixnum(3),  UNDEF_RAW,  UNDEF_RAW,      // #instr_t
    TYPE_T,     fixnum(2),  UNDEF_RAW,  UNDEF_RAW,      // #pair_t
    TYPE_T,     fixnum(3),  UNDEF_RAW,  UNDEF_RAW,      // #dict_t
    TYPE_T,     fixnum(-1), UNDEF_RAW,  UNDEF_RAW,      // FWD_REF_T
    TYPE_T,     fixnum(0),  UNDEF_RAW,  UNDEF_RAW       // FREE_T
]);

function demo(log) {
    log("fixnum(0) =", fixnum(0), fixnum(0).toString(16), print(fixnum(0)));
    log("fixnum(1) =", fixnum(1), fixnum(1).toString(16), print(fixnum(1)));
    log("fixnum(-1) =", fixnum(-1), fixnum(-1).toString(16), print(fixnum(-1)));
    log("fixnum(-2) =", fixnum(-2), fixnum(-2).toString(16), print(fixnum(-2)));
    log("ramptr(5) =", ramptr(5), print(ramptr(5)));
    log(
        "u_ptr_to_cap(ramptr(3)) =",
        ptr_to_cap(ramptr(3)),
        print(ptr_to_cap(ramptr(3)))
    );
}

if (import.meta.main) {
    test_read_write_quad();
    demo(globalThis.console.log);
}

export default Object.freeze({

// The functions.

    cap_to_ptr,
    current_continuation,
    fault_msg,
    fix_to_i32,
    fixnum,
    in_mem,
    instr_parts,
    is_cap,
    is_fix,
    is_ptr,
    is_ram,
    is_raw,
    is_rom,
    print,
    print_gc_color,
    print_quad,
    ptr_to_cap,
    ramptr,
    rawofs,
    read_quad,
    romptr,
    write_quad,

// The constants.

    crlf_literals,
    crlf_types,
    imm_labels,
    op_labels,
    reserved_rom,
    MSK_RAW,
    DIR_RAW,
    MUT_RAW,
    OPQ_RAW,
    UNDEF_RAW,
    NIL_RAW,
    FALSE_RAW,
    TRUE_RAW,
    EMPTY_DQ,
    TYPE_T,
    FIXNUM_T,
    ACTOR_T,
    PROXY_T,
    STUB_T,
    INSTR_T,
    PAIR_T,
    DICT_T,
    FWD_REF_T,
    FREE_T,
    VM_TYPEQ,
    VM_QUAD,
    VM_DICT,
    VM_PAIR,
    VM_PART,
    VM_NTH,
    VM_PUSH,
    VM_JUMP,
    VM_DROP,
    VM_PICK,
    VM_DUP,
    VM_ROLL,
    VM_ALU,
    VM_EQ,
    VM_CMP,
    VM_IF,
    VM_MSG,
    VM_ACTOR,
    VM_END,
    VM_SPONSOR,
    VM_DEBUG,
    VM_DEQUE,
    VM_STATE,
    VM_ASSERT,
    QUAD_ROM_MAX,
    QUAD_RAM_MAX,
    BLOB_RAM_MAX,
    MEMORY_OFS,
    DDEQUE_OFS,
    DEBUG_DEV_OFS,
    CLOCK_DEV_OFS,
    TIMER_DEV_OFS,
    IO_DEV_OFS,
    BLOB_DEV_OFS,
    RANDOM_DEV_OFS,
    HOST_DEV_OFS,
    SPONSOR_OFS,
    E_OK,
    E_FAIL,
    E_BOUNDS,
    E_NO_MEM,
    E_NOT_FIX,
    E_NOT_CAP,
    E_NOT_PTR,
    E_NOT_ROM,
    E_NOT_RAM,
    E_NOT_EXE,
    E_NO_TYPE,
    E_MEM_LIM,
    E_CPU_LIM,
    E_MSG_LIM,
    E_ASSERT,
    E_STOP,
    E_ABORT,
    LOG_NONE,
    LOG_INFO,
    LOG_WARN,
    LOG_DEBUG,
    LOG_TRACE
});
