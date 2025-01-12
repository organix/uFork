// A JavaScript wrapper for a uFork WASM core.

// This module exports an object containing the uFork constants, as well as a
// 'make_core' constructor function that takes an object with the following
// properties:

//  wasm_url
//      The URL of the uFork WASM binary, as a string. Required.

//  on_wakeup(device_offset)
//      A function that is called whenever the core wakes up from a dormant
//      state, generally due to its 'h_wakeup' method being called by a device.
//      This function is responsible for resuming execution of the core.
//      Optional.

//  on_log(log_level, ...values)
//      A function that is called with any values logged by the core.
//      The 'values' may or may not be strings. Optional.

//  on_trace(ep, kp)
//      A function that is called before an event transaction is committed.
//      It is passed a pointer to the current event, and continuation if there
//      is one. Optional.

//      NOTE: This function is independent of the TRACE logging level.

//  on_audit(code, evidence, ep, kp)
//      A function that is called when a non-fatal error (such as an aborted
//      transaction) occurs. Optional.

//      The 'code' is an error fixnum such as E_ABORT.
//      The 'evidence' is a value associated with the error, such as the reason
//      provided to the 'end abort' instruction.
//      The 'ep' points to the current event.
//      The 'kp' points to the current continuation, if there is one.

//  log_level
//      An integer controlling the core's logging verbosity. Each level includes
//      all levels before it.

//      ufork.LOG_NONE (0)
//          No logging.
//      ufork.LOG_INFO (1)
//          Low volume, always shown unless all logging is disabled.
//      ufork.LOG_WARN (2)
//          Something went wrong, but perhaps it wasn't fatal.
//      ufork.LOG_DEBUG (3)
//          More detail to narrow down the source of a problem.
//      ufork.LOG_TRACE (4)
//          Extremely detailed (for example, all reserve and release actions).

//      The default level is LOG_WARN.

//  import_map
//      An object that maps prefixes to base URLs, used to resolve imports.
//      For example, the import map

//          {"lib/": "https://ufork.org/lib/"}

//      would resolve "lib/std.asm" to "https://ufork.org/lib/std.asm".

//  compilers
//      An object that maps file extensions to compiler functions.

//      Compilers are used by the 'h_import' method to transform text, fetched
//      over the network, to uFork IR. A compiler has the signature:

//          compile(text, src) -> ir

//      where 'text' is the source text as a string, 'src' is the module's
//      source (usually a URL, optional), and 'ir' is a CRLF object as
//      described in ir.md, unless compilation failed, in which case 'ir'
//      should have a non-empty array as its "errors" property.

//      For example, if both assembly and Scheme modules were to be imported,
//      the compilers object might look like:

//          {
//              asm: compile_assembly,
//              scm: compile_scheme
//          }

// The returned object is an uninitialized core, containing a bunch of methods.
// The methods beginning with "u_" are reentrant, but the methods beginning
// with "h_" are non-reentrant.

// To initialize the core, call the 'h_initialize' method and run the returned
// requestor to completion.

/*jslint web, global, long, bitwise, white */

import assemble from "https://ufork.org/lib/assemble.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import unpromise from "https://ufork.org/lib/rq/unpromise.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");
const asm_url = import.meta.resolve("../../lib/eq.asm");
const lib_url = import.meta.resolve("../../lib/");

// Type-tag bits

const MSK_RAW   = 0xF0000000;  // mask for type-tag bits
const DIR_RAW   = 0x80000000;  // 1=direct (fixnum), 0=indirect (pointer)
const MUT_RAW   = 0x40000000;  // 1=read-write (mutable), 0=read-only (immutable)
const OPQ_RAW   = 0x20000000;  // 1=opaque (capability), 0=transparent (navigable)

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
const instr_label = [
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
];
const dict_imm_label = [
    "has",
    "get",
    "add",
    "set",
    "del"
];
const alu_imm_label = [
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
];
const cmp_imm_label = [
    "eq",
    "ge",
    "gt",
    "lt",
    "le",
    "ne"
];
const actor_imm_label = [
    "send",
    "post",
    "create",
    "become",
    "self"
];
const deque_imm_label = [
    "new",
    "empty",
    "push",
    "pop",
    "put",
    "pull",
    "len"
];
const end_imm_label = [
    "abort",
    "stop",
    "commit"
];
const sponsor_imm_label = [
    "new",
    "memory",
    "events",
    "cycles",
    "reclaim",
    "start",
    "stop"
];

// CRLF

const crlf_literals = {
    undef: UNDEF_RAW,
    nil: NIL_RAW,
    false: FALSE_RAW,
    true: TRUE_RAW
};
const crlf_types = {
    fixnum: FIXNUM_T,
    type: TYPE_T,
    pair: PAIR_T,
    dict: DICT_T,
    instr: INSTR_T,
    actor: ACTOR_T
};

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

function print(raw) {
    if (typeof raw !== "number") {
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

function make_core({
    wasm_url,
    on_wakeup,
    on_log,
    on_trace,
    on_audit,
    log_level = LOG_WARN,
    import_map = {},
    compilers = {}
}) {
    let wasm_exports;
    let boot_caps_dict = []; // empty
    let wasm_caps = Object.create(null);
    let on_dispose_callbacks = [];
    let import_promises = Object.create(null);
    let module_text = Object.create(null);
    let rom_sourcemap = Object.create(null);
    let wasm_call_in_progress = false;
    let deferred_queue = [];
    let initial_rom_ofs;
    let initial_ram_ofs;

// The presence of a particular logging method indicates that its associated log
// level is enabled. Thus calling code can log conditionally, avoiding the
// performance overhead of producing diagnostics that would just be discarded
// anyway.

    let u_info;
    let u_warn;
    let u_debug;
    let u_trace;

    function make_log_method(log_level) {
        if (on_log !== undefined) {
            return function (...values) {
                on_log(log_level, ...values);
            };
        }
    }

    if (log_level >= LOG_INFO) {
        u_info = make_log_method(LOG_INFO);
    }
    if (log_level >= LOG_WARN) {
        u_warn = make_log_method(LOG_WARN);
    }
    if (log_level >= LOG_DEBUG) {
        u_debug = make_log_method(LOG_DEBUG);
    }
    if (log_level >= LOG_TRACE) {
        u_trace = make_log_method(LOG_TRACE);
    }

    function u_audit(code, evidence, ep, kp) {
        if (typeof on_audit === "function") {
            on_audit(code, evidence, ep, kp);
        }
    }

    function bottom_out(...values) {
        if (u_warn !== undefined) {
            u_warn(...values);
        }
        //throw new Error("bottom_out!");
        return UNDEF_RAW;
    }

    function wrap_wasm_call(get_wasm_function) {
        return function (...args) {

// It is only valid to call 'u_defer' during a non-reentrant call into WASM.
// There is no need to implement a mutex here because Rust's RefCell will panic
// upon illegal reentry.

            wasm_call_in_progress = true;
            let result = get_wasm_function()(...args);
            wasm_call_in_progress = false;

// Some callbacks that make non-reentrant calls may have been scheduled
// by 'u_defer' whilst the WASM component had control. Run them now and flush
// the queue.

            const callbacks = deferred_queue;
            deferred_queue = [];
            callbacks.forEach((callback) => callback());
            if (Number.isSafeInteger(result)) {

// Some of the WASM exports return a fixnum, but fixnums appear to be negative
// because the top bit is set. Discard the sign.

                result = result >>> 0;  // i32 -> u32
            }
            return result;
        };
    }

    //const h_init = wrap_wasm_call(() => wasm_exports.h_init);
    const h_run_loop = wrap_wasm_call(() => wasm_exports.h_run_loop);
    const h_step = wrap_wasm_call(() => wasm_exports.h_step);
    const h_event_enqueue = wrap_wasm_call(() => wasm_exports.h_event_enqueue);
    const h_revert = wrap_wasm_call(() => wasm_exports.h_revert);
    const h_gc_run = wrap_wasm_call(() => wasm_exports.h_gc_run);
    //const h_rom_buffer = wrap_wasm_call(() => wasm_exports.h_rom_buffer);
    const h_rom_top = wrap_wasm_call(() => wasm_exports.h_rom_top);
    const h_set_rom_top = wrap_wasm_call(() => wasm_exports.h_set_rom_top);
    const h_reserve_rom = wrap_wasm_call(() => wasm_exports.h_reserve_rom);
    //const h_ram_buffer = wrap_wasm_call(() => wasm_exports.h_ram_buffer);
    const h_ram_top = wrap_wasm_call(() => wasm_exports.h_ram_top);
    const h_reserve = wrap_wasm_call(() => wasm_exports.h_reserve);
    const h_reserve_stub = wrap_wasm_call(() => wasm_exports.h_reserve_stub);
    const h_release_stub = wrap_wasm_call(() => wasm_exports.h_release_stub);
    const h_car = wrap_wasm_call(() => wasm_exports.h_car);
    const h_cdr = wrap_wasm_call(() => wasm_exports.h_cdr);
    const h_gc_color = wrap_wasm_call(() => wasm_exports.h_gc_color);
    const h_gc_state = wrap_wasm_call(() => wasm_exports.h_gc_state);

    function u_memory() {

// WARNING! The WASM memory buffer can move if it is resized. We get a fresh
// pointer each time for safety.

        return wasm_exports.memory.buffer;
    }

// We avoid unnecessary reentrancy by caching the offsets at initialization
// time. Even if the WASM memory is rearranged, offsets should not change.

    function u_rom_ofs() {
        return initial_rom_ofs;
    }

    function u_ram_ofs() {
        return initial_ram_ofs;
    }

    function u_sourcemap(ip) {
        const debug = rom_sourcemap[ip];
        if (debug !== undefined) {
            return {
                debug,
                text: module_text[debug.src]
            };
        }
    }

    function u_cap_to_ptr(cap) {
        const ptr = cap_to_ptr(cap);
        if (ptr === UNDEF_RAW) {
            return bottom_out("cap_to_ptr: must be mutable", print(cap));
        }
        return ptr;
    }

    function u_ptr_to_cap(ptr) {
        const cap = ptr_to_cap(ptr);
        if (cap === UNDEF_RAW) {
            return bottom_out("ptr_to_cap: must be mutable", print(ptr));
        }
        return cap;
    }

    function u_mem_pages() {
        return u_memory().byteLength / 65536;
    }

    function u_read_quad(ptr) {
        if (is_ram(ptr)) {
            const ram_ofs = rawofs(ptr);
            if (ram_ofs < QUAD_RAM_MAX) {
                const ram = new Uint32Array(u_memory(), u_ram_ofs(), (QUAD_RAM_MAX << 2));
                const ram_idx = ram_ofs << 2;  // convert quad address to Uint32Array index
                return {
                    t: ram[ram_idx + 0],
                    x: ram[ram_idx + 1],
                    y: ram[ram_idx + 2],
                    z: ram[ram_idx + 3]
                };
            } else {
                return bottom_out("h_read_quad: RAM ptr out of bounds", print(ptr));
            }
        }
        if (is_rom(ptr)) {
            const rom_ofs = rawofs(ptr);
            if (rom_ofs < QUAD_ROM_MAX) {
                const rom = new Uint32Array(u_memory(), u_rom_ofs(), (QUAD_ROM_MAX << 2));
                const rom_idx = rom_ofs << 2;  // convert quad address to Uint32Array index
                return {
                    t: rom[rom_idx + 0],
                    x: rom[rom_idx + 1],
                    y: rom[rom_idx + 2],
                    z: rom[rom_idx + 3]
                };
            } else {
                return bottom_out("h_read_quad: ROM ptr out of bounds", print(ptr));
            }
        }
        return bottom_out("h_read_quad: required ptr, got", print(ptr));
    }

    function u_write_quad(ptr, quad) {
        if (is_ram(ptr)) {
            const ofs = rawofs(ptr);
            if (ofs < QUAD_RAM_MAX) {
                const ram = new Uint32Array(u_memory(), u_ram_ofs(), (QUAD_RAM_MAX << 2));
                const idx = ofs << 2;  // convert quad address to Uint32Array index
                ram[idx + 0] = quad.t ?? UNDEF_RAW;
                ram[idx + 1] = quad.x ?? UNDEF_RAW;
                ram[idx + 2] = quad.y ?? UNDEF_RAW;
                ram[idx + 3] = quad.z ?? UNDEF_RAW;
                return;
            } else {
                return bottom_out("h_write_quad: RAM ptr out of bounds", print(ptr));
            }
        }
        return bottom_out("h_write_quad: required RAM ptr, got", print(ptr));
    }

    function u_current_continuation() {
        const dd_quad = u_read_quad(ramptr(DDEQUE_OFS));
        const k_first = dd_quad.y;
        if (in_mem(k_first)) {
            const k_quad = u_read_quad(k_first);
            const e_quad = u_read_quad(k_quad.y);
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

    function u_nth(list_ptr, n) {

// Safely extract the 'nth' item from a list of pairs.

//           0          -1          -2          -3
//      lst -->[car,cdr]-->[car,cdr]-->[car,cdr]-->...
//            +1 |        +2 |        +3 |
//               V           V           V

        if (n === 0) {
            return list_ptr;
        }
        if (!is_ptr(list_ptr)) {
            return UNDEF_RAW;
        }
        const pair = u_read_quad(list_ptr);
        if (pair.t !== PAIR_T) {
            return UNDEF_RAW;
        }
        if (n === 1) {
            return pair.x;
        }
        return (
            n < 0
            ? u_nth(pair.y, n + 1)
            : u_nth(pair.y, n - 1)
        );
    }

    function u_next(ptr) {
        if (is_ptr(ptr)) {
            const quad = u_read_quad(ptr);
            const t = quad.t;
            if (t === INSTR_T) {
                const op = quad.x;
                if ((op !== VM_IF) && (op !== VM_JUMP) && (op !== VM_END)) {
                    return quad.z;
                }
            } else if (t === PAIR_T) {
                return quad.y;
            } else {
                return quad.z;
            }
        }
        return UNDEF_RAW;
    }

    function u_quad_print(quad) {
        let s = "[";
        s += print(quad.t);
        s += ", ";
        if (quad.t === INSTR_T) {
            const op = fix_to_i32(quad.x);  // translate opcode
            if (op < instr_label.length) {
                s += instr_label[op];
                s += ", ";
                const imm = fix_to_i32(quad.y);  // translate immediate
                if ((quad.x === VM_DICT) && (imm < dict_imm_label.length)) {
                    s += dict_imm_label[imm];
                } else if ((quad.x === VM_ALU) && (imm < alu_imm_label.length)) {
                    s += alu_imm_label[imm];
                } else if ((quad.x === VM_CMP) && (imm < cmp_imm_label.length)) {
                    s += cmp_imm_label[imm];
                } else if ((quad.x === VM_ACTOR) && (imm < actor_imm_label.length)) {
                    s += actor_imm_label[imm];
                } else if ((quad.x === VM_DEQUE) && (imm < deque_imm_label.length)) {
                    s += deque_imm_label[imm];
                } else if (quad.x === VM_END) {
                    s += end_imm_label[imm + 1];  // END_ABORT === -1
                } else if ((quad.x === VM_SPONSOR) && (imm < sponsor_imm_label.length)) {
                    s += sponsor_imm_label[imm];
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

    function u_defer(callback) {

// Schedule a callback to be run at the conclusion of the currently running
// non-reentrant method, for example 'h_run_loop'. The callback can safely call
// the core's non-reentrant methods.

// This method is more performant than scheduling the callback using setTimeout.

        if (!wasm_call_in_progress) {
            throw new Error("u_defer called outside of WASM control.");
        }
        deferred_queue.push(callback);
    }

    function h_reserve_ram(quad = {}) {
        const ptr = h_reserve();
        u_write_quad(ptr, quad);
        return ptr;
    }

    function h_rom_alloc(debug_info) {
        const raw = h_reserve_rom();
        rom_sourcemap[raw] = debug_info;
        return Object.freeze({
            raw() {
                return raw;
            },
            write({t, x, y, z}) {

// FIXME: could we use `u_write_quad()` directly here?

                const ofs = rawofs(raw) << 4; // convert quad offset to byte offset
                const quad = new Uint32Array(u_memory(), u_rom_ofs() + ofs, 4);
                if (t !== undefined) {
                    quad[0] = t;
                }
                if (x !== undefined) {
                    quad[1] = x;
                }
                if (y !== undefined) {
                    quad[2] = y;
                }
                if (z !== undefined) {
                    quad[3] = z;
                }
            }
        });
    }

    function h_load(ir, imports) {

// Load a module after its imports have been loaded.

        let definitions = Object.create(null);
        let type_checks = [];
        let cyclic_data_checks = [];
        let arity_checks = [];

        function fail(message, ...data) {
            throw new Error(
                message + ": " + data.map(function (the_data) {
                    return JSON.stringify(the_data, undefined, 4);
                }).join(" ")
            );
        }

        function definition_raw(name) {
            return (
                definitions[name] !== undefined
                ? (
                    is_raw(definitions[name])
                    ? definitions[name]
                    : definitions[name].raw()
                )
                : fail("Not defined", name)
            );
        }

        function lookup(ref) {
            return (
                ref.module === undefined
                ? definition_raw(ref.name)
                : (
                    imports[ref.module] !== undefined
                    ? (
                        is_raw(imports[ref.module][ref.name])
                        ? imports[ref.module][ref.name]
                        : fail("Not exported", ref.module + "." + ref.name, ref)
                    )
                    : fail("Not imported", ref.module, ref)
                )
            );
        }

        function label(name, labels, offset = 0) {
            const index = labels.findIndex(function (label) {
                return label === name;
            });
            return (
                (Number.isSafeInteger(index) && index >= 0)
                ? fixnum(index + offset)
                : fail("Bad label", name)
            );
        }

        function kind(node) {
            return (
                Number.isSafeInteger(node)
                ? "fixnum"
                : node.kind
            );
        }

        function literal(node) {
            const raw = crlf_literals[node.value];
            return (
                is_raw(raw)
                ? raw
                : fail("Not a literal", node)
            );
        }

        function fix(node) {
            return (
                kind(node) === "fixnum"
                ? fixnum(node) // FIXME: check integer bounds?
                : fail("Not a fixnum", node)
            );
        }

        function value(node) {
            const the_kind = kind(node);
            if (the_kind === "literal") {
                return literal(node);
            }
            if (the_kind === "fixnum") {
                return fix(node);
            }
            if (the_kind === "ref") {
                return lookup(node);
            }
            if (
                the_kind === "pair"
                || the_kind === "dict"
                || the_kind === "quad"
                || the_kind === "instr"
            ) {
                return populate(h_rom_alloc(node.debug), node);
            }
            if (the_kind === "type") {
                const raw = crlf_types[node.name];
                return (
                    is_raw(raw)
                    ? raw
                    : (
                        Number.isSafeInteger(node.arity)
                        ? populate(h_rom_alloc(node.debug), node)
                        : lookup(node)
                    )
                );
            }
            return fail("Not a value", node);
        }

        function instruction(node) {
            const raw = value(node);
            type_checks.push({
                raw,
                t: INSTR_T,
                node,
                msg: "Expected an instruction"
            });
            return raw;
        }

        function populate(quad, node) {
            const the_kind = kind(node);
            let fields = {};
            if (the_kind === "type") {
                fields.t = TYPE_T;
                fields.x = fix(node.arity);
            } else if (the_kind === "pair") {
                fields.t = PAIR_T;
                fields.x = value(node.head);
                fields.y = value(node.tail);
                if (node.tail.kind === "ref" && node.tail.module === undefined) {
                    cyclic_data_checks.push([fields.y, PAIR_T, "y", node.tail]);
                }
            } else if (the_kind === "dict") {
                fields.t = DICT_T;
                fields.x = value(node.key);
                fields.y = value(node.value);
                fields.z = value(node.next); // dict/nil
                if (fields.z !== NIL_RAW) {
                    type_checks.push({
                        raw: fields.z,
                        t: DICT_T,
                        node: node.next,
                        msg: "Expected a dict"
                    });
                }
                if (node.next.kind === "ref" && node.next.module === undefined) {
                    cyclic_data_checks.push([fields.z, DICT_T, "z", node.next]);
                }
            } else if (the_kind === "quad") {
                fields.t = value(node.t);
                let arity = 0;
                if (node.x !== undefined) {
                    fields.x = value(node.x);
                    arity = 1;
                }
                if (node.y !== undefined) {
                    fields.y = value(node.y);
                    arity = 2;
                }
                if (node.z !== undefined) {
                    fields.z = value(node.z);
                    arity = 3;
                }
                arity_checks.push([fields.t, arity, node.t]);
            } else if (the_kind === "instr") {
                fields.t = INSTR_T;
                fields.x = label(node.op, instr_label);
                if (node.op === "typeq") {
                    const imm_raw = value(node.imm);
                    type_checks.push({
                        raw: imm_raw,
                        t: TYPE_T,
                        node: node.imm,
                        msg: "Expected a type"
                    });
                    fields.y = imm_raw;
                    fields.z = instruction(node.k);
                } else if (
                    node.op === "quad"
                    || node.op === "pair"
                    || node.op === "part"
                    || node.op === "nth"
                    || node.op === "drop"
                    || node.op === "pick"
                    || node.op === "dup"
                    || node.op === "roll"
                    || node.op === "msg"
                    || node.op === "state"
                ) {
                    fields.y = fix(node.imm);
                    fields.z = instruction(node.k);
                } else if (
                    node.op === "eq"
                    || node.op === "push"
                    || node.op === "assert"
                ) {
                    fields.y = value(node.imm);
                    fields.z = instruction(node.k);
                } else if (node.op === "debug") {
                    fields.z = instruction(node.k);
                } else if (node.op === "if") {
                    fields.y = instruction(node.t);
                    fields.z = instruction(node.f);
                } else if (node.op === "dict") {
                    fields.y = label(node.imm, dict_imm_label);
                    fields.z = instruction(node.k);
                } else if (node.op === "deque") {
                    fields.y = label(node.imm, deque_imm_label);
                    fields.z = instruction(node.k);
                } else if (node.op === "alu") {
                    fields.y = label(node.imm, alu_imm_label);
                    fields.z = instruction(node.k);
                } else if (node.op === "cmp") {
                    fields.y = label(node.imm, cmp_imm_label);
                    fields.z = instruction(node.k);
                } else if (node.op === "actor") {
                    fields.y = label(node.imm, actor_imm_label);
                    fields.z = instruction(node.k);
                } else if (node.op === "end") {
                    fields.y = label(node.imm, end_imm_label, -1);
                } else if (node.op === "sponsor") {
                    fields.y = label(node.imm, sponsor_imm_label);
                    fields.z = instruction(node.k);
                } else if (node.op !== "jump") {

// The 'jump' instruction has no fields.

                    return fail("Not an op", node);
                }
            } else {
                return fail("Not a quad", node);
            }
            quad.write(fields);
            return quad.raw();
        }

        function is_quad(node) {
            return (
                kind(node) === "pair"
                || kind(node) === "dict"
                || kind(node) === "quad"
                || kind(node) === "instr"
            );
        }

// Allocate a placeholder quad for each definition that requires one, or set the
// raw directly. Only resolve refs that refer to imports, not definitions.

        Object.entries(ir.ast.define).forEach(function ([name, node]) {
            if (is_quad(node)) {
                definitions[name] = h_rom_alloc(node.debug);
            } else if (kind(node) === "ref") {
                if (node.module !== undefined) {
                    definitions[name] = lookup(node);
                }
            } else {
                definitions[name] = value(node);
            }
        });

// Now we resolve any refs that refer to definitions. This is tricky because
// they could be cyclic. If they are not cyclic, we resolve them in order of
// dependency.

        let ref_deps = Object.create(null);
        Object.entries(ir.ast.define).forEach(function ([name, node]) {
            if (kind(node) === "ref" && node.module === undefined) {
                ref_deps[name] = node.name;
            }
        });

        function ref_depth(name, seen = []) {
            const dep_name = ref_deps[name];
            if (seen.includes(name)) {
                return fail("Cyclic refs", ir.ast.define[name]);
            }
            return (
                ref_deps[dep_name] === undefined
                ? 0
                : 1 + ref_depth(dep_name, seen.concat(name))
            );
        }

        Object.keys(ref_deps).sort(function (a, b) {
            return ref_depth(a) - ref_depth(b);
        }).forEach(function (name) {
            definitions[name] = lookup(ir.ast.define[name]);
        });

// Populate each placeholder quad.

        Object.entries(ir.ast.define).forEach(function ([name, node]) {
            if (is_quad(node)) {
                populate(definitions[name], node);
            }
        });

// Check the type of dubious quads now they are fully populated.

        type_checks.forEach(function ({raw, t, node, msg}) {
            if (!is_ptr(raw) || u_read_quad(raw).t !== t) {
                return fail(msg, node);
            }
        });

// Check for cyclic data structures, which are pathological for some
// instructions.

        cyclic_data_checks.forEach(function ([raw, t, k_field, node]) {
            let seen = [];
            while (is_ptr(raw)) {
                if (seen.includes(raw)) {
                    return fail("Cyclic", node);
                }
                const quad = u_read_quad(raw);
                if (quad.t !== t) {
                    break;
                }
                seen.push(raw);
                raw = quad[k_field];
            }
        });

// Check that custom quad have a valid type in the T field, and an arity
// matching the type.

        arity_checks.forEach(function ([type_raw, arity, node]) {
            if (
                !in_mem(type_raw)
                && type_raw !== TYPE_T
                && type_raw !== INSTR_T
                && type_raw !== PAIR_T
                && type_raw !== DICT_T
            ) {
                return fail("Not a type", node);
            }
            const type_quad = u_read_quad(type_raw);
            if (type_quad.t !== TYPE_T) {
                return fail("Not a type", node);
            }
            if (arity !== fix_to_i32(type_quad.x)) {
                return fail("Wrong arity for type", node);
            }
        });

// Populate the exports object.

        let exports_object = Object.create(null);
        ir.ast.export.forEach(function (name) {
            exports_object[name] = definition_raw(name);
        });
        return exports_object;
    }

    function u_map_src(src) {
        if (src !== undefined) {
            const alias = Object.keys(import_map).find(function (key) {
                return src.startsWith(key);
            });
            if (alias !== undefined) {
                return src.replace(alias, import_map[alias]);
            }
        }
    }

    function h_import_promise(src, content) {

        function compile(text) {
            const extension = src.split(".").pop();
            if (!Object.hasOwn(compilers, extension)) {
                throw new Error("No compiler for '" + src + "'.");
            }
            const compiler = compilers[extension];
            module_text[src] = text;
            return compiler(text, src);
        }

        if (import_promises[src] === undefined) {
            if (u_trace !== undefined && content === undefined) {
                u_trace("Fetching " + src);
            }
            import_promises[src] = (
                content === undefined
                ? fetch(src).then(function (response) {
                    return response.text();
                }).then(compile)
                : Promise.resolve(
                    typeof content === "string"
                    ? compile(content)
                    : content
                )
            ).then(function (ir) {
                if (ir.errors !== undefined && ir.errors.length > 0) {
                    return Promise.reject(new Error(
                        "Failed to load '"
                        + src
                        + "':\n"
                        + JSON.stringify(ir.errors, undefined, 4)
                    ));
                }

// FIXME: cyclic module dependencies cause a deadlock, but they should instead
// fail with an error.

                return Promise.all(Object.values(ir.ast.import).map(
                    function (import_src) {
                        import_src = u_map_src(import_src) ?? import_src;
                        return h_import_promise(

// We need to resolve the import specifier if it is relative.

                            import_src.startsWith(".")
                            ? (

// The URL constructor chokes when 'base' is an absolute path, rather than a
// fully qualified URL. We work around this using a dummy origin so that we can
// produce an absolute path if 'src' is an absolute path.

                                src.startsWith("/")
                                ? new URL(
                                    import_src,
                                    new URL(src, "http://_")
                                ).pathname
                                : new URL(import_src, src).href
                            )
                            : import_src
                        );
                    }
                )).then(function (imported_modules) {
                    const imports = Object.create(null);
                    Object.keys(ir.ast.import).forEach(function (name, nr) {
                        imports[name] = imported_modules[nr];
                    });
                    return h_load(ir, imports);
                });
            });
        }
        return import_promises[src];
    }

    function h_import(src, content) {

// Import and load a module, along with its dependencies. If 'content' (a text
// string or IR object) is provided, the 'src' is used only to resolve relative
// imports.

        return unpromise(function () {
            return h_import_promise(u_map_src(src) ?? src, content);
        });
    }

    function u_disasm(raw) {
        let s = print(raw);
        if (is_cap(raw)) {
            raw = u_cap_to_ptr(raw);
        }
        if (is_ptr(raw)) {
            s += ": ";
            const quad = u_read_quad(raw);
            s += u_quad_print(quad);
        }
        return s;
    }

    function u_pprint(raw) {
        let s = "";
        if (is_ptr(raw)) {
            let quad = u_read_quad(raw);
            let sep;
            if (quad.t === PAIR_T) {
                let p = raw;
                sep = "(";
                while (quad.t === PAIR_T) {
                    s += sep;
                    s += u_pprint(quad.x);  // car
                    sep = " ";
                    p = quad.y;  // cdr
                    if (!is_ptr(p)) {
                        break;
                    }
                    quad = u_read_quad(p);
                }
                if (p !== NIL_RAW) {
                    s += " . ";
                    s += u_pprint(p);
                }
                s += ")";
                return s;
            }
            if (quad.t === DICT_T) {
                sep = "{";
                while (quad.t === DICT_T) {
                    s += sep;
                    s += u_pprint(quad.x);  // key
                    s += ":";
                    s += u_pprint(quad.y);  // value
                    sep = ", ";
                    quad = u_read_quad(quad.z);  // next
                }
                s += "}";
                return s;
            }
            if (quad.t === STUB_T) {
                s += "STUB[";
                s += print(quad.x);  // device
                s += ",";
                s += print(quad.y);  // target
                s += "]";
                return s;
            }
        }
        if (is_cap(raw)) {
            const ptr = u_cap_to_ptr(raw);
            const cap_quad = u_read_quad(ptr);
            if (cap_quad.t === PROXY_T) {
                s += "PROXY[";
                s += print(cap_quad.x);  // device
                s += ",";
                s += print(cap_quad.y);  // handle
                s += "]";
                return s;
            }
        }
        return print(raw);
    }

    function u_event_as_object(event) {

// Capture event data in a JS object.

        const obj = Object.create(null);
        let quad = u_read_quad(event);
        const evt = quad;
        obj.message = u_pprint(evt.y);
        quad = u_read_quad(u_cap_to_ptr(evt.x));
        const prev = quad;
        obj.target = Object.create(null);
        obj.target.raw = print(evt.x);
        if (is_ram(prev.z)) {
            // actor effect
            const next = u_read_quad(prev.z);
            obj.target.code = print(prev.x);
            obj.target.data = u_pprint(prev.y);
            obj.become = Object.create(null);
            obj.become.code = u_pprint(next.x);
            obj.become.data = u_pprint(next.y);
            obj.sent = [];
            let pending = next.z;
            while (is_ram(pending)) {
                quad = u_read_quad(pending);
                obj.sent.push({
                    target: print(quad.x),
                    message: u_pprint(quad.y),
                    sponsor: print(quad.t)
                });
                pending = pending.z;
            }
        } else {
            // device effect
            obj.target.device = print(prev.x);
            obj.target.data = u_pprint(prev.y);
        }
        quad = u_read_quad(evt.t);
        obj.sponsor = Object.create(null);
        obj.sponsor.raw = print(evt.t);
        obj.sponsor.memory = fix_to_i32(quad.t);
        obj.sponsor.events = fix_to_i32(quad.x);
        obj.sponsor.cycles = fix_to_i32(quad.y);
        obj.sponsor.signal = print(quad.z);
        return obj;
    }

    function u_log_event(event, log = u_trace) {

// Log event details

        if (log) {
            if (typeof event === "number") {
                event = u_event_as_object(event);
            }
            if (event.target.device) {
                // device effect
                log(event.message
                    + "->"
                    + event.target.raw
                    + " "
                    + event.target.device
                    + "."
                    + event.target.data
                );
            } else {
                // actor effect
                let messages = [];
                event.sent.forEach(function ({target, message}) {
                    messages.push(message + "->" + target);
                });
                log(event.message
                    + "->"
                    + event.target.raw
                    + " "
                    + event.target.code
                    + "."
                    + event.target.data
                    + " => "
                    + event.become.code
                    + "."
                    + event.become.data
                    + " "
                    + messages.join(" ")
                );
            }
        }
    }

    function h_boot(instr_ptr, state_ptr = UNDEF_RAW) {
        if (instr_ptr === undefined || !is_ptr(instr_ptr)) {
            throw new Error("Not an instruction: " + u_pprint(instr_ptr));
        }

// Make a boot actor, to be sent the boot message.

        const actor = h_reserve_ram({
            t: ACTOR_T,
            x: instr_ptr,
            y: state_ptr,
            z: UNDEF_RAW
        });

// Inject the boot event (with a message holding the capabilities) to the front
// of the event queue.

        const evt = h_reserve_ram({
            t: ramptr(SPONSOR_OFS),
            x: u_ptr_to_cap(actor),
            y: boot_caps_dict.reduce(function (dict, [key_raw, value_raw]) {
                return h_reserve_ram({
                    t: DICT_T,
                    x: key_raw,
                    y: value_raw,
                    z: dict
                });
            }, NIL_RAW)
        });
        h_event_enqueue(evt);
    }

    function h_snapshot() {
        const mem_base = u_memory();

// WASM mandates little-endian byte ordering

        const rom_ofs = u_rom_ofs();
        const rom_len = rawofs(h_rom_top()) << 4;
        const rom = new Uint8Array(mem_base, rom_ofs, rom_len);

        const ram_ofs = u_ram_ofs();
        const ram_len = rawofs(h_ram_top()) << 4;
        const ram = new Uint8Array(mem_base, ram_ofs, ram_len);

        // FIXME: need a general strategy for saving device state

        return {
            rom: rom.slice(),
            ram: ram.slice()
        };
    }

    function h_restore(snapshot) {
        const mem_base = u_memory();

        const rom_ofs = u_rom_ofs();
        const rom_len = snapshot.rom.byteLength;
        const rom = new Uint8Array(mem_base, rom_ofs, rom_len);
        rom.set(snapshot.rom);

        const ram_ofs = ramptr(MEMORY_OFS);
        const ram_len = snapshot.ram.byteLength;
        const ram = new Uint8Array(mem_base, ram_ofs, ram_len);
        ram.set(snapshot.ram);

        // FIXME: need a general strategy for restoring device state

        const rom_top = romptr(rom_len >> 2);
        h_set_rom_top(rom_top);  // register new top-of-ROM
    }

    function h_install(boot_key, boot_value, on_dispose, wasm_imports) {

// Install a device. This usually involves extending the boot capabilities
// dictionary, handling disposal, and providing capability functions to the
// WASM instance.

// If provided, the 'boot_key' and 'boot_value' are added to the "caps"
// dictionary provided to boot actors (created via the 'h_boot' method). Each
// entry is an array containing two values like [key, value]. Both the key and
// the value can be any raw value.

// The 'on_dispose' callback is called when the core is disposed.

// The 'wasm_imports' parameter is an object with functions to provide to the
// WASM instance. The names of these functions are hard coded into the built
// WASM, e.g. "host_clock".

        if (boot_key !== undefined && boot_value !== undefined) {
            boot_caps_dict.push([boot_key, boot_value]);
        }
        if (typeof on_dispose === "function") {
            on_dispose_callbacks.push(on_dispose);
        }
        Object.assign(wasm_caps, wasm_imports);
    }

    function h_dispose() {

// Dispose of the core by disposing of any installed devices.

        const callbacks = on_dispose_callbacks;
        on_dispose_callbacks = [];
        callbacks.forEach((on_dispose) => on_dispose());
    }

    function h_wakeup(device_offset) {
        if (on_wakeup !== undefined) {
            on_wakeup(device_offset);
        }
    }

    function h_refill({memory, events, cycles}) {
        const sponsor_ptr = ramptr(SPONSOR_OFS);
        const sponsor = u_read_quad(sponsor_ptr);
        if (Number.isSafeInteger(memory)) {
            sponsor.t = fixnum(memory);
        }
        if (Number.isSafeInteger(events)) {
            sponsor.x = fixnum(events);
        }
        if (Number.isSafeInteger(cycles)) {
            sponsor.y = fixnum(cycles);
        }
        u_write_quad(sponsor_ptr, sponsor);
    }

    function h_initialize() {

// Initializes the core. This requestor should be run exactly once before the
// core is asked to do any work.

        return parseq.sequence([
            unpromise(function () {
                return WebAssembly.instantiateStreaming(fetch(wasm_url), {
                    capabilities: {
                        host_clock(...args) {
                            return wasm_caps.host_clock(...args);
                        },
                        host_random(...args) {
                            return wasm_caps.host_random(...args);
                        },
                        host_print(...args) {
                            return wasm_caps.host_print(...args);
                        },
                        host_log(...args) {
                            return wasm_caps.host_log(...args);
                        },
                        host_start_timer(...args) {
                            return wasm_caps.host_start_timer(...args);
                        },
                        host_stop_timer(...args) {
                            return wasm_caps.host_stop_timer(...args);
                        },
                        host_read(...args) {
                            return wasm_caps.host_read(...args);
                        },
                        host_write(...args) {
                            return wasm_caps.host_write(...args);
                        },
                        host_trace(...args) {
                            return wasm_caps.host_trace(...args);
                        },
                        host_audit(...args) {
                            return wasm_caps.host_audit(...args);
                        },
                        host(...args) {
                            return wasm_caps.host(...args);
                        }
                    }
                });
            }),
            requestorize(function (wasm) {
                wasm_exports = wasm.instance.exports;
                wasm.instance.exports.h_init();  // initialize uFork Core in WASM
                initial_rom_ofs = wasm.instance.exports.h_rom_buffer();
                initial_ram_ofs = wasm.instance.exports.h_ram_buffer();

// Install an anonymous plugin to handle audit and trace information.

                Object.assign(wasm_caps, {
                    host_trace(ep, kp) {
                        if (typeof on_trace === "function") {
                            on_trace(ep, kp);
                        }
                    },
                    host_audit: u_audit
                });

// Install the debug device, if debug logging is enabled.

                if (u_debug !== undefined) {
                    const dev_ptr = ramptr(DEBUG_DEV_OFS);
                    const dev_cap = u_ptr_to_cap(dev_ptr);
                    const dev_id = u_read_quad(dev_ptr).x;
                    boot_caps_dict.push([dev_id, dev_cap]);
                    Object.assign(wasm_caps, {
                        host_log(x) { // (i32) -> nil
                            const u = (x >>> 0);  // convert i32 -> u32
                            //u_debug(print(u), "->", u_pprint(u));
                            let s = print(u);
                            if (in_mem(u)) {
                                s += ": " + u_pprint(u);
                            }
                            u_debug(s);
                        }
                    });
                }
                return true;
            })
        ]);
    }

    return Object.freeze({

// The non-reentrant methods.

        h_boot,
        h_car,
        h_cdr,
        h_dispose,
        h_event_enqueue,
        h_gc_color,
        h_gc_run,
        h_gc_state,
        h_import,
        h_initialize,
        h_install,
        h_load,
        h_ram_top,
        h_refill,
        h_release_stub,
        h_reserve_ram,
        h_reserve_rom,
        h_reserve_stub,
        h_restore,
        h_revert,
        h_rom_top,
        h_run_loop,
        h_set_rom_top,
        h_snapshot,
        h_step,
        h_wakeup,

// The reentrant methods.

        u_audit,
        u_current_continuation,
        u_debug,
        u_disasm,
        u_event_as_object,
        u_info,
        u_log_event,
        u_mem_pages,
        u_memory,
        u_next,
        u_nth,
        u_pprint,
        u_quad_print,
        u_ram_ofs,
        u_read_quad,
        u_rom_ofs,
        u_defer,
        u_sourcemap,
        u_trace,
        u_warn,
        u_write_quad
    });
}

const abort_src = `
boot:                       ; _ <- {caps}
    push 123                ; reason
    end abort               ; --

.export
    boot
`;

function demo(log) {
    let core;

    function run_ufork() {
        const status = core.h_run_loop(0);
        log("IDLE:", fault_msg(fix_to_i32(status)));
    }

    core = make_core({
        wasm_url,
        on_wakeup(device_offset) {
            log("WAKE:", device_offset);
            run_ufork();
        },
        log_level: LOG_DEBUG,
        on_log: log,
        on_audit(code, evidence, ep, kp) {
            log(
                "AUDIT:",
                fault_msg(fix_to_i32(code)),
                print(evidence),
                print(ep),
                print(kp)
            );
        },
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble}
    });
    parseq.sequence([
        core.h_initialize(),
        parseq.parallel([
            core.h_import(asm_url),
            core.h_import("abort.asm", abort_src)
        ]),
        requestorize(function ([test_module, audit_module]) {

// Test.

            log("fixnum(0) =", fixnum(0), fixnum(0).toString(16), print(fixnum(0)));
            log("fixnum(1) =", fixnum(1), fixnum(1).toString(16), print(fixnum(1)));
            log("fixnum(-1) =", fixnum(-1), fixnum(-1).toString(16), print(fixnum(-1)));
            log("fixnum(-2) =", fixnum(-2), fixnum(-2).toString(16), print(fixnum(-2)));
            log("ramptr(5) =", ramptr(5), print(ramptr(5)));
            log("u_ptr_to_cap(ramptr(3)) =", ptr_to_cap(ramptr(3)), print(ptr_to_cap(ramptr(3))));
            log("h_rom_top() =", core.h_rom_top(), print(core.h_rom_top()));
            log("h_ram_top() =", core.h_ram_top(), print(core.h_ram_top()));

// Boot.

            const start = performance.now();
            core.h_boot(test_module.boot);
            core.h_refill({cycles: 100});
            run_ufork(); // sponsor cycle limit reached
            core.h_refill({cycles: 4096});
            run_ufork(); // #t
            core.h_boot(audit_module.boot);
            run_ufork(); // actor transaction aborted
            const duration = performance.now() - start;
            return duration.toFixed(3) + "ms";
        })
    ])(log);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze({

// The functions.

    cap_to_ptr,
    fault_msg,
    fix_to_i32,
    fixnum,
    in_mem,
    is_cap,
    is_fix,
    is_ptr,
    is_ram,
    is_raw,
    is_rom,
    make_core,
    print,
    ptr_to_cap,
    ramptr,
    rawofs,
    romptr,

// The constants.

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
