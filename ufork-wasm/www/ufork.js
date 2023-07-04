// A JavaScript wrapper for a uFork WASM core.

// This module exports the 'instantiate_core' function, a requestor factory with
// the following parameters:

//  wasm_url
//      The URL of the uFork WASM binary, as a string.
//
//  on_wakeup(device_offset)
//      A callback function that is called whenever the core wakes up from a
//      dormant state, generally due to its 'h_wakeup' method being called by
//      a device. This callback is responsible for resuming execution of the
//      core. Optional.

//  on_warning(...info)
//      A callback function that is called with a warning whenever a core
//      method bottoms out to UNDEF. Optional.

// The returned requestor produces a core object containing methods and
// constants.

/*jslint browser, long, bitwise */

import parseq from "./parseq.js";
import requestorize from "./requestors/requestorize.js";
import lazy from "./requestors/lazy.js";
import unpromise from "./requestors/unpromise.js";
import assemble from "./assemble.js";

// Type-tag bits

const MSK_RAW   = 0xF0000000;  // mask for type-tag bits
const DIR_RAW   = 0x80000000;  // 1=direct (fixnum), 0=indirect (pointer)
const OPQ_RAW   = 0x40000000;  // 1=opaque (capability), 0=transparent (navigable)
const MUT_RAW   = 0x20000000;  // 1=read-write (mutable), 0=read-only (immutable)

// Raw constants

const UNDEF_RAW = 0x00000000;
const NIL_RAW   = 0x00000001;
const FALSE_RAW = 0x00000002;
const TRUE_RAW  = 0x00000003;
const UNIT_RAW  = 0x00000004;
const EMPTY_DQ  = 0x00000005;
const LITERAL_T = 0x00000000; // == UNDEF
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

const VM_TYPEQ  = 0x80000000;
const VM_CELL   = 0x80000001;  // reserved
const VM_GET    = 0x80000002;  // reserved
const VM_DICT   = 0x80000003;  // was "VM_SET"
const VM_PAIR   = 0x80000004;
const VM_PART   = 0x80000005;
const VM_NTH    = 0x80000006;
const VM_PUSH   = 0x80000007;
const VM_DEPTH  = 0x80000008;
const VM_DROP   = 0x80000009;
const VM_PICK   = 0x8000000A;
const VM_DUP    = 0x8000000B;
const VM_ROLL   = 0x8000000C;
const VM_ALU    = 0x8000000D;
const VM_EQ     = 0x8000000E;
const VM_CMP    = 0x8000000F;
const VM_IF     = 0x80000010;
const VM_MSG    = 0x80000011;
const VM_MY     = 0x80000012;
const VM_SEND   = 0x80000013;
const VM_NEW    = 0x80000014;
const VM_BEH    = 0x80000015;
const VM_END    = 0x80000016;
const VM_CVT    = 0x80000017;  // deprecated
const VM_PUTC   = 0x80000018;  // deprecated
const VM_GETC   = 0x80000019;  // deprecated
const VM_DEBUG  = 0x8000001A;  // deprecated
const VM_DEQUE  = 0x8000001B;
const VM_STATE  = 0x8000001C;  // reserved
const VM_001D   = 0x8000001D;  // reserved
const VM_IS_EQ  = 0x8000001E;
const VM_IS_NE  = 0x8000001F;

// Memory limits (from core.rs)

const QUAD_ROM_MAX = 1 << 10;
const QUAD_RAM_MAX = 1 << 8;
const BLOB_RAM_MAX = 1 << 8;

// Memory layout (from core.rs)

const MEMORY_OFS = 0;
const DDEQUE_OFS = 1;
const DEBUG_DEV_OFS = 2;
const CLOCK_DEV_OFS = 3;
const IO_DEV_OFS = 4;
const BLOB_DEV_OFS = 5;
const TIMER_DEV_OFS = 6;
const MEMO_DEV_OFS = 7;
const AWP_DEV_OFS = 8;
const SPONSOR_OFS = 15;

// Error codes (from core.rs)

// TODO should these be here? They seem pretty Rust-centric.

const E_OK = 0;
const E_FAIL = -1;
const E_BOUNDS = -2;
const E_NO_MEM = -3;
const E_NOT_FIX = -4;
const E_NOT_CAP = -5;
const E_NOT_PTR = -6;
const E_NOT_ROM = -7;
const E_NOT_RAM = -8;
const E_MEM_LIM = -9;
const E_CPU_LIM = -10;
const E_MSG_LIM = -11;
const E_ASSERT = -12;
const E_STOP = -13;

// Strings

const rom_label = [
    "#?",
    "()",
    "#f",
    "#t",
    "#unit",
    "EMPTY_DQ",
    "TYPE_T",
    "FIXNUM_T",
    "ACTOR_T",
    "PROXY_T",
    "STUB_T",
    "INSTR_T",
    "PAIR_T",
    "DICT_T",
    "FWD_REF_T",
    "FREE_T"
];
const error_messages = [
    "no error",                             // E_OK = 0
    "general failure",                      // E_FAIL = -1
    "out of bounds",                        // E_BOUNDS = -2
    "no memory available",                  // E_NO_MEM = -3
    "fixnum required",                      // E_NOT_FIX = -4
    "capability required",                  // E_NOT_CAP = -5
    "memory pointer required",              // E_NOT_PTR = -6
    "ROM pointer required",                 // E_NOT_ROM = -7
    "RAM pointer required",                 // E_NOT_RAM = -8
    "Sponsor memory limit reached",         // E_MEM_LIM = -9
    "Sponsor instruction limit reached",    // E_CPU_LIM = -10
    "Sponsor event limit reached",          // E_MSG_LIM = -11
    "assertion failed",                     // E_ASSERT = -12
    "actor stopped"                         // E_STOP = -13
];
const instr_label = [
    "VM_TYPEQ",
    "VM_CELL",  // reserved
    "VM_GET",  // reserved
    "VM_DICT",  // was "VM_SET"
    "VM_PAIR",
    "VM_PART",
    "VM_NTH",
    "VM_PUSH",
    "VM_DEPTH",
    "VM_DROP",
    "VM_PICK",
    "VM_DUP",
    "VM_ROLL",
    "VM_ALU",
    "VM_EQ",
    "VM_CMP",
    "VM_IF",
    "VM_MSG",
    "VM_MY",
    "VM_SEND",
    "VM_NEW",
    "VM_BEH",
    "VM_END",
    "VM_CVT",  // deprecated
    "VM_PUTC",  // deprecated
    "VM_GETC",  // deprecated
    "VM_DEBUG",  // deprecated
    "VM_DEQUE",
    "VM_STATE",
    "VM_001D",  // reserved
    "VM_IS_EQ",
    "VM_IS_NE"
];
const get_imm_label = [
    "T",
    "X",
    "Y",
    "Z"
];
const dict_imm_label = [
    "HAS",
    "GET",
    "ADD",
    "SET",
    "DEL"
];
const alu_imm_label = [
    "NOT",
    "AND",
    "OR",
    "XOR",
    "ADD",
    "SUB",
    "MUL"
];
const cmp_imm_label = [
    "EQ",
    "GE",
    "GT",
    "LT",
    "LE",
    "NE"
];
const my_imm_label = [
    "SELF",
    "BEH",
    "STATE"
];
const deque_imm_label = [
    "NEW",
    "EMPTY",
    "PUSH",
    "POP",
    "PUT",
    "PULL",
    "LEN"
];
const end_imm_label = [
    "ABORT",
    "STOP",
    "COMMIT",
    "RELEASE"
];

// CRLF

const crlf_literals = {
    undef: UNDEF_RAW,
    nil: NIL_RAW,
    false: FALSE_RAW,
    true: TRUE_RAW,
    unit: UNIT_RAW
};
const crlf_types = {
    literal: LITERAL_T,
    fixnum: FIXNUM_T,
    type: TYPE_T,
    pair: PAIR_T,
    dict: DICT_T,
    instr: INSTR_T,
    actor: ACTOR_T
};

function make_core(wasm_exports, on_wakeup, on_warning, mutable_wasm_caps) {
    let boot_caps_dict = []; // empty
    let import_promises = Object.create(null);
    let module_source = Object.create(null);
    let rom_sourcemap = Object.create(null);
    let wasm_call_in_progress = false;

    function wasm_mutex_call(wasm_fn) {
        return function (...args) {
            if (wasm_call_in_progress) {
                throw new Error("re-entrant WASM call");
            }
            try {
                wasm_call_in_progress = true;  // obtain "mutex"
                return wasm_fn(...args);
            } finally {
                wasm_call_in_progress = false;  // release "mutex"
            }
        };
    }

    const h_run_loop = wasm_mutex_call(wasm_exports.h_run_loop);
    const h_step = wasm_mutex_call(wasm_exports.h_step);
    const h_event_inject = wasm_mutex_call(wasm_exports.h_event_inject);
    const h_revert = wasm_mutex_call(wasm_exports.h_revert);
    const h_gc_run = wasm_mutex_call(wasm_exports.h_gc_run);
    //const h_rom_buffer = wasm_mutex_call(wasm_exports.h_rom_buffer);
    const h_rom_top = wasm_mutex_call(wasm_exports.h_rom_top);
    const h_set_rom_top = wasm_mutex_call(wasm_exports.h_set_rom_top);
    const h_reserve_rom = wasm_mutex_call(wasm_exports.h_reserve_rom);
    //const h_ram_buffer = wasm_mutex_call(wasm_exports.h_ram_buffer);
    const h_ram_top = wasm_mutex_call(wasm_exports.h_ram_top);
    const h_reserve = wasm_mutex_call(wasm_exports.h_reserve);
    const h_reserve_stub = wasm_mutex_call(wasm_exports.h_reserve_stub);
    const h_release_stub = wasm_mutex_call(wasm_exports.h_release_stub);
    //const h_blob_buffer = wasm_mutex_call(wasm_exports.h_blob_buffer);
    const h_blob_top = wasm_mutex_call(wasm_exports.h_blob_top);
    const h_car = wasm_mutex_call(wasm_exports.h_car);
    const h_cdr = wasm_mutex_call(wasm_exports.h_cdr);
    const h_gc_color = wasm_mutex_call(wasm_exports.h_gc_color);
    const h_gc_state = wasm_mutex_call(wasm_exports.h_gc_state);

    function u_memory() {

// WARNING! The WASM memory buffer can move if it is resized. We get a fresh
// pointer each time for safety.

        return wasm_exports.memory.buffer;
    }

// We avoid unnecessary reentrancy by caching the offsets. Even if the WASM
// memory is rearranged, offsets should not change.

    const initial_rom_ofs = wasm_exports.h_rom_buffer();
    const initial_ram_ofs = wasm_exports.h_ram_buffer();
    const initial_blob_ofs = wasm_exports.h_blob_buffer();

    function u_rom_ofs() {
        return initial_rom_ofs;
    }

    function u_ram_ofs() {
        return initial_ram_ofs;
    }

    function u_blob_ofs() {
        return initial_blob_ofs;
    }

    function u_sourcemap(ip) {
        const debug = rom_sourcemap[ip];
        if (debug !== undefined) {
            return {
                debug,
                source: module_source[debug.file]
            };
        }
    }

    function u_warning(message) {
        if (on_warning !== undefined) {
            on_warning("WARNING!", message);
        }
        return UNDEF_RAW;
    }

    function u_fault_msg(error_code) {
        return (
            error_code < 0
            ? error_messages[-error_code] ?? "unknown fault"
            : error_messages[0]
        );
    }

    function u_is_raw(value) {
        return (Number.isSafeInteger(value) && value >= 0 && value < 2 ** 32);
    }

    function u_is_fix(raw) {
        return ((raw & DIR_RAW) !== 0);
    }

    function u_is_cap(raw) {
        return ((raw & (DIR_RAW | OPQ_RAW)) === OPQ_RAW);
    }

    function u_is_ptr(raw) {
        return ((raw & (DIR_RAW | OPQ_RAW)) === 0);
    }

    function u_is_rom(raw) {
        return ((raw & (DIR_RAW | OPQ_RAW | MUT_RAW)) === 0);
    }

    function u_is_ram(raw) {
        return ((raw & (DIR_RAW | OPQ_RAW | MUT_RAW)) === MUT_RAW);
    }

    function u_fixnum(i32) {
        return ((i32 | DIR_RAW) >>> 0);
    }

    function u_rawofs(raw) {
        return (raw & ~MSK_RAW);
    }

    function u_romptr(ofs) {
        return u_rawofs(ofs);
    }

    function u_ramptr(ofs) {
        return (u_rawofs(ofs) | MUT_RAW);
    }

    function u_fix_to_i32(fix) {
        return (fix << 1) >> 1;
    }

    function u_in_mem(ptr) {
        return (ptr > FREE_T) && !u_is_fix(ptr);
    }

    function u_print(raw) {
        if (typeof raw !== "number") {
            return String(raw);
        }
        if (u_is_fix(raw)) {  // fixnum
            const i32 = u_fix_to_i32(raw);
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
            (raw & OPQ_RAW)
            ? "@"
            : "^"
        );
        return prefix + raw.toString(16).padStart(8, "0");
    }

    function u_cap_to_ptr(cap) {
        return (
            u_is_fix(cap)
            ? u_warning("cap_to_ptr: can't convert fixnum "+u_print(cap))
            : (cap & ~OPQ_RAW)
        );
    }

    function u_ptr_to_cap(ptr) {
        return (
            u_is_fix(ptr)
            ? u_warning("ptr_to_cap: can't convert fixnum "+u_print(ptr))
            : (ptr | OPQ_RAW)
        );
    }

    function u_mem_pages() {
        return u_memory().byteLength / 65536;
    }

    function u_read_quad(ptr) {
        if (u_is_ram(ptr)) {
            const ram_ofs = u_rawofs(ptr);
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
                return u_warning("h_read_quad: RAM ptr out of bounds "+u_print(ptr));
            }
        }
        if (u_is_rom(ptr)) {
            const rom_ofs = u_rawofs(ptr);
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
                return u_warning("h_read_quad: ROM ptr out of bounds "+u_print(ptr));
            }
        }
        return u_warning("h_read_quad: required ptr, got "+u_print(ptr));
    }

    function u_write_quad(ptr, quad) {
        if (u_is_ram(ptr)) {
            const ofs = u_rawofs(ptr);
            if (ofs < QUAD_RAM_MAX) {
                const ram = new Uint32Array(u_memory(), u_ram_ofs(), (QUAD_RAM_MAX << 2));
                const idx = ofs << 2;  // convert quad address to Uint32Array index
                ram[idx + 0] = quad.t ?? UNDEF_RAW;
                ram[idx + 1] = quad.x ?? UNDEF_RAW;
                ram[idx + 2] = quad.y ?? UNDEF_RAW;
                ram[idx + 3] = quad.z ?? UNDEF_RAW;
                return;
            } else {
                return u_warning("h_write_quad: RAM ptr out of bounds "+u_print(ptr));
            }
        }
        return u_warning("h_write_quad: required RAM ptr, got "+u_print(ptr));
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
        if (!u_is_ptr(list_ptr)) {
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
        if (u_is_ptr(ptr)) {
            const quad = u_read_quad(ptr);
            const t = quad.t;
            if (t === INSTR_T) {
                const op = quad.x;
                if ((op !== VM_IF) && (op !== VM_END)) {
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

    function u_blob_mem() {
        return new Uint8Array(u_memory(), u_blob_ofs(), BLOB_RAM_MAX);
    }

    function u_quad_print(quad) {
        let s = "{ ";
        if (quad.t === INSTR_T) {
            s += "t:INSTR_T, x:";
            const op = quad.x ^ DIR_RAW;  // translate opcode
            if (op < instr_label.length) {
                const imm = quad.y ^ DIR_RAW;  // translate immediate
                if ((quad.x === VM_GET) && (imm < get_imm_label.length)) {
                    s += "VM_GET, y:";
                    s += get_imm_label[imm];
                } else if ((quad.x === VM_DICT) && (imm < dict_imm_label.length)) {
                    s += "VM_DICT, y:";
                    s += dict_imm_label[imm];
                } else if ((quad.x === VM_ALU) && (imm < alu_imm_label.length)) {
                    s += "VM_ALU, y:";
                    s += alu_imm_label[imm];
                } else if ((quad.x === VM_CMP) && (imm < cmp_imm_label.length)) {
                    s += "VM_CMP, y:";
                    s += cmp_imm_label[imm];
                } else if ((quad.x === VM_MY) && (imm < my_imm_label.length)) {
                    s += "VM_MY, y:";
                    s += my_imm_label[imm];
                } else if ((quad.x === VM_DEQUE) && (imm < deque_imm_label.length)) {
                    s += "VM_DEQUE, y:";
                    s += deque_imm_label[imm];
                } else if (quad.x === VM_END) {
                    s += "VM_END, y:";
                    s += end_imm_label[u_fix_to_i32(quad.y) + 1];  // END_ABORT === -1
                } else {
                    s += instr_label[op];
                    s += ", y:";
                    s += u_print(quad.y);
                }
            } else {
                s += u_print(quad.x);
                s += ", y:";
                s += u_print(quad.y);
            }
        } else {
            s += "t:";
            s += u_print(quad.t);
            s += ", x:";
            s += u_print(quad.x);
            s += ", y:";
            s += u_print(quad.y);
        }
        s += ", z:";
        s += u_print(quad.z);
        s += " }";
        return s;
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

                const ofs = u_rawofs(raw) << 4; // convert quad offset to byte offset
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

    function h_load(crlf, imports) {

// Load a module after its imports have been loaded.

        let definitions = Object.create(null);
        let continuation_type_checks = [];
        let cyclic_data_checks = [];

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
                    u_is_raw(definitions[name])
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
                        u_is_raw(imports[ref.module][ref.name])
                        ? imports[ref.module][ref.name]
                        : fail("Not exported", ref.module + "." + ref.name, ref)
                    )
                    : fail("Not imported", ref.module, ref)
                )
            );
        }

        function label(name, labels, prefix_length = 0, offset = 0) {
            const index = labels.findIndex(function (label) {
                return label.slice(prefix_length).toLowerCase() === name.toLowerCase();
            }) + offset;
            return (
                Number.isSafeInteger(index)
                ? u_fixnum(index)
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
                u_is_raw(raw)
                ? raw
                : fail("Not a literal", node)
            );
        }

        function fixnum(node) {
            return (
                kind(node) === "fixnum"
                ? u_fixnum(node) // FIXME: check integer bounds?
                : fail("Not a fixnum", node)
            );
        }

        function type(node) {
            const raw = crlf_types[node.name];
            return (
                u_is_raw(raw)
                ? raw
                : fail("Unknown type", node)
            );
        }

        function value(node) {
            const the_kind = kind(node);
            if (the_kind === "literal") {
                return literal(node);
            }
            if (the_kind === "fixnum") {
                return fixnum(node);
            }
            if (the_kind === "type") {
                return type(node);
            }
            if (the_kind === "ref") {
                return lookup(node);
            }
            if (
                the_kind === "pair"
                || the_kind === "dict"
                || the_kind === "instr"
            ) {
                return populate(h_rom_alloc(node.debug), node);
            }
            return fail("Not a value", node);
        }

        function instruction(node) {
            const raw = value(node);
            continuation_type_checks.push([raw, INSTR_T, node]);
            return raw;
        }

        function populate(quad, node) {
            const the_kind = kind(node);
            let fields = {};
            if (the_kind === "pair") {
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
                    continuation_type_checks.push([fields.z, DICT_T, node.next]);
                }
                if (node.next.kind === "ref" && node.next.module === undefined) {
                    cyclic_data_checks.push([fields.z, DICT_T, "z", node.next]);
                }
            } else if (the_kind === "instr") {
                fields.t = INSTR_T;
                fields.x = label(node.op, instr_label, 3);
                if (node.op === "typeq") {
                    fields.y = type(node.imm);
                    fields.z = instruction(node.k);
                } else if (
                    node.op === "cell"
                    || node.op === "pair"
                    || node.op === "part"
                    || node.op === "nth"
                    || node.op === "drop"
                    || node.op === "pick"
                    || node.op === "dup"
                    || node.op === "roll"
                    || node.op === "msg"
                    || node.op === "state"
                    || node.op === "send"
                    || node.op === "new"
                    || node.op === "beh"
                ) {
                    fields.y = fixnum(node.imm);
                    fields.z = instruction(node.k);
                } else if (
                    node.op === "eq"
                    || node.op === "push"
                    || node.op === "is_eq"
                    || node.op === "is_ne"
                ) {
                    fields.y = value(node.imm);
                    fields.z = instruction(node.k);
                } else if (node.op === "depth") {
                    fields.y = instruction(node.k);
                } else if (node.op === "if") {
                    fields.y = instruction(node.t);
                    fields.z = instruction(node.f);
                } else if (node.op === "get") {
                    fields.y = label(node.imm, get_imm_label);
                    fields.z = instruction(node.k);
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
                } else if (node.op === "my") {
                    fields.y = label(node.imm, my_imm_label);
                    fields.z = instruction(node.k);
                } else if (node.op === "end") {
                    fields.y = label(node.imm, end_imm_label, 0, -1);
                } else {
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
                || kind(node) === "instr"
            );
        }

// Allocate a placeholder quad for each definition that requires one, or set the
// raw directly. Only resolve refs that refer to imports, not definitions.

        Object.entries(crlf.ast.define).forEach(function ([name, node]) {
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
        Object.entries(crlf.ast.define).forEach(function ([name, node]) {
            if (kind(node) === "ref" && node.module === undefined) {
                ref_deps[name] = node.name;
            }
        });

        function ref_depth(name, seen = []) {
            const dep_name = ref_deps[name];
            if (seen.includes(name)) {
                return fail("Cyclic refs", crlf.ast.define[name]);
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
            definitions[name] = lookup(crlf.ast.define[name]);
        });

// Populate each placeholder quad.

        Object.entries(crlf.ast.define).forEach(function ([name, node]) {
            if (is_quad(node)) {
                populate(definitions[name], node);
            }
        });

// Check the type of dubious continuations.

        continuation_type_checks.forEach(function ([raw, t, node]) {
            if (!u_is_ptr(raw) || u_read_quad(raw).t !== t) {
                return fail("Bad continuation", node);
            }
        });

// Check for cyclic data structures, which are pathological for some
// instructions.

        cyclic_data_checks.forEach(function ([raw, t, k_field, node]) {
            let seen = [];
            while (u_is_ptr(raw)) {
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

// Populate the exports object.

        let exports_object = Object.create(null);
        crlf.ast.export.forEach(function (name) {
            exports_object[name] = definition_raw(name);
        });
        return exports_object;
    }

    function h_import_promise(specifier) {
        if (import_promises[specifier] === undefined) {
            import_promises[specifier] = fetch(
                specifier
            ).then(function (response) {
                return (
                    specifier.endsWith(".asm")
                    ? response.text().then(function (source) {
                        module_source[specifier] = source;
                        return assemble(source, specifier);
                    })
                    : response.json()
                );
            }).then(function (crlf) {
                if (crlf.kind === "error") {
                    return Promise.reject(crlf);
                }
                return Promise.all(Object.values(crlf.ast.import).map(
                    function (import_specifier) {

// FIXME: cyclic module dependencies cause a deadlock, but they should instead
// fail with an error.

                        return h_import_promise(
                            new URL(import_specifier, specifier).href
                        );
                    }
                )).then(function (imported_modules) {
                    const imports = Object.create(null);
                    Object.keys(crlf.ast.import).forEach(function (name, nr) {
                        imports[name] = imported_modules[nr];
                    });
                    return h_load(crlf, imports);
                });
            });
        }
        return import_promises[specifier];
    }

    function h_import(specifier) {

// Import and load a module, along with its dependencies.

        return unpromise(function () {
            return h_import_promise(specifier);
        });
    }

    function u_disasm(raw) {
        let s = u_print(raw);
        if (u_is_cap(raw)) {
            raw = u_cap_to_ptr(raw);
        }
        if (u_is_ptr(raw)) {
            s += ": ";
            const quad = u_read_quad(raw);
            s += u_quad_print(quad);
        }
        return s;
    }

    function u_pprint(raw) {
        let s = "";
        if (u_is_ptr(raw)) {
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
                    if (!u_is_ptr(p)) {
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
                s += u_print(quad.x);  // device
                s += ",";
                s += u_print(quad.y);  // target
                s += "]";
                return s;
            }
        }
        if (u_is_cap(raw)) {
            const ptr = u_cap_to_ptr(raw);
            const cap_quad = u_read_quad(ptr);
            if (cap_quad.t === PROXY_T) {
                s += "PROXY[";
                s += u_print(cap_quad.x);  // device
                s += ",";
                s += u_print(cap_quad.y);  // handle
                s += "]";
                return s;
            }
        }
        return u_print(raw);
    }

    function h_boot(instr_ptr) {
        if (instr_ptr === undefined || !u_is_ptr(instr_ptr)) {
            throw new Error("Not an instruction: " + u_pprint(instr_ptr));
        }

// Make a boot actor, to be sent the boot message.

        const actor = h_reserve_ram({
            t: ACTOR_T,
            x: instr_ptr,
            y: NIL_RAW,
            z: UNDEF_RAW
        });

// Inject the boot event (with a message holding the capabilities) to the front
// of the event queue.

        h_event_inject(
            u_ramptr(SPONSOR_OFS),
            u_ptr_to_cap(actor),
            boot_caps_dict.reduce(function (dict, [integer, value_raw]) {
                return h_reserve_ram({
                    t: DICT_T,
                    x: u_fixnum(integer),
                    y: value_raw,
                    z: dict
                });
            }, NIL_RAW)
        );
    }

    function h_snapshot() {
        const mem_base = u_memory();

// WASM mandates little-endian byte ordering

        const rom_ofs = u_rom_ofs();
        const rom_len = u_rawofs(h_rom_top()) << 4;
        const rom = new Uint8Array(mem_base, rom_ofs, rom_len);

        const ram_ofs = u_ram_ofs();
        const ram_len = u_rawofs(h_ram_top()) << 4;
        const ram = new Uint8Array(mem_base, ram_ofs, ram_len);

        const blob_ofs = u_blob_ofs();
        const blob_len = u_fix_to_i32(h_blob_top());
        const blob = new Uint8Array(mem_base, blob_ofs, blob_len);

        return {
            rom: rom.slice(),
            ram: ram.slice(),
            blob: blob.slice()
        };
    }

    function h_restore(snapshot) {
        const mem_base = u_memory();

        const rom_ofs = u_rom_ofs();
        const rom_len = snapshot.rom.byteLength;
        const rom = new Uint8Array(mem_base, rom_ofs, rom_len);
        rom.set(snapshot.rom);

        const ram_ofs = u_ramptr(MEMORY_OFS);
        const ram_len = snapshot.ram.byteLength;
        const ram = new Uint8Array(mem_base, ram_ofs, ram_len);
        ram.set(snapshot.ram);

        const blob_ofs = u_blob_ofs();
        const blob_len = snapshot.blob.length;
        const blob = new Uint8Array(mem_base, blob_ofs, blob_len);
        blob.set(snapshot.blob);

        const rom_top = u_romptr(rom_len >> 2);
        h_set_rom_top(rom_top);  // register new top-of-ROM
    }

    function h_install(boot_caps, wasm_imports) {

// Extends the boot capabilities dictionary and provide capability functions to
// the WASM instance.

// The 'boot_caps' parameter is an array of entries to add to the "caps"
// dictionary provided to boot actors (created via the 'h_boot' method). Each
// entry is an array containing two values like [key, value]. The key is an
// integer, see dev.asm for a list of assigned numbers. The value can be
// any raw value.

// The 'wasm_imports' parameter is an object with functions to provide to the
// WASM instance. The names of these functions are hard coded into the built
// WASM, e.g. "host_clock".

        if (boot_caps !== undefined) {
            boot_caps_dict.push(...boot_caps);
        }
        Object.assign(mutable_wasm_caps, wasm_imports);
    }

    function h_wakeup(device_offset) {
        if (on_wakeup !== undefined) {
            on_wakeup(device_offset);
        }
    }

    return Object.freeze({

// The constants.

        MSK_RAW,
        DIR_RAW,
        OPQ_RAW,
        MUT_RAW,
        UNDEF_RAW,
        NIL_RAW,
        FALSE_RAW,
        TRUE_RAW,
        UNIT_RAW,
        EMPTY_DQ,
        LITERAL_T,
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
        VM_CELL,
        VM_GET,
        VM_DICT,
        VM_PAIR,
        VM_PART,
        VM_NTH,
        VM_PUSH,
        VM_DEPTH,
        VM_DROP,
        VM_PICK,
        VM_DUP,
        VM_ROLL,
        VM_ALU,
        VM_EQ,
        VM_CMP,
        VM_IF,
        VM_MSG,
        VM_MY,
        VM_SEND,
        VM_NEW,
        VM_BEH,
        VM_END,
        VM_CVT,
        VM_PUTC,
        VM_GETC,
        VM_DEBUG,
        VM_DEQUE,
        VM_STATE,
        VM_001D,
        VM_IS_EQ,
        VM_IS_NE,
        QUAD_ROM_MAX,
        QUAD_RAM_MAX,
        BLOB_RAM_MAX,
        MEMORY_OFS,
        DDEQUE_OFS,
        DEBUG_DEV_OFS,
        CLOCK_DEV_OFS,
        IO_DEV_OFS,
        BLOB_DEV_OFS,
        TIMER_DEV_OFS,
        MEMO_DEV_OFS,
        AWP_DEV_OFS,
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
        E_MEM_LIM,
        E_CPU_LIM,
        E_MSG_LIM,
        E_ASSERT,
        E_STOP,

// The non-reentrant methods.

        h_blob_top,
        h_boot,
        h_car,
        h_cdr,
        h_event_inject,
        h_gc_color,
        h_gc_run,
        h_gc_state,
        h_import,
        h_install,
        h_load,
        h_ram_top,
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

        u_blob_mem,
        u_blob_ofs,
        u_cap_to_ptr,
        u_disasm,
        u_fault_msg,
        u_fix_to_i32,
        u_fixnum,
        u_in_mem,
        u_is_cap,
        u_is_fix,
        u_is_ptr,
        u_is_ram,
        u_is_raw,
        u_is_rom,
        u_mem_pages,
        u_memory,
        u_next,
        u_nth,
        u_pprint,
        u_print,
        u_ptr_to_cap,
        u_quad_print,
        u_ram_ofs,
        u_ramptr,
        u_rawofs,
        u_read_quad,
        u_rom_ofs,
        u_romptr,
        u_sourcemap,
        u_write_quad
    });
}

function instantiate_core(wasm_url, on_wakeup, on_warning) {
    let mutable_wasm_caps = Object.create(null);
    return parseq.sequence([
        unpromise(function () {
            return WebAssembly.instantiateStreaming(
                fetch(wasm_url),
                {
                    capabilities: {
                        host_clock(...args) {
                            return mutable_wasm_caps.host_clock(...args);
                        },
                        host_print(...args) {
                            return mutable_wasm_caps.host_print(...args);
                        },
                        host_log(...args) {
                            return mutable_wasm_caps.host_log(...args);
                        },
                        host_timer(...args) {
                            return mutable_wasm_caps.host_timer(...args);
                        },
                        host_read(...args) {
                            return mutable_wasm_caps.host_read(...args);
                        },
                        host_write(...args) {
                            return mutable_wasm_caps.host_write(...args);
                        },
                        host_awp(...args) {
                            return mutable_wasm_caps.host_awp(...args);
                        },
                        host_trace(...args) {
                            const trace = mutable_wasm_caps.host_trace;
                            if (typeof trace === "function") {
                                return trace(...args);
                            }
                        }
                    }
                }
            );
        }),
        requestorize(function (wasm) {
            return make_core(
                wasm.instance.exports,
                on_wakeup,
                on_warning,
                mutable_wasm_caps
            );
        })
    ]);
}

//debug import debug_device from "./devices/debug_device.js";
//debug import clock_device from "./devices/clock_device.js";
//debug import io_device from "./devices/io_device.js";
//debug import blob_device from "./devices/blob_device.js";
//debug import timer_device from "./devices/timer_device.js";
//debug let core;
//debug parseq.sequence([
//debug     instantiate_core(
//debug         import.meta.resolve(
//debug             "../target/wasm32-unknown-unknown/debug/ufork_wasm.wasm"
//debug         ),
//debug         function on_wakeup(device_offset) {
//debug             console.log("WAKE:", device_offset);
//debug             console.log("IDLE:", core.u_fault_msg(core.h_run_loop()));
//debug         },
//debug         console.log
//debug     ),
//debug     lazy(function (the_core) {
//debug         core = the_core;
//debug         // Install devices
//debug         debug_device(core);
//debug         clock_device(core);
//debug         io_device(core);
//debug         blob_device(core);
//debug         timer_device(core);
//debug         // Test suite
//debug         console.log("u_fixnum(0) =", core.u_fixnum(0), core.u_fixnum(0).toString(16), core.u_print(core.u_fixnum(0)));
//debug         console.log("u_fixnum(1) =", core.u_fixnum(1), core.u_fixnum(1).toString(16), core.u_print(core.u_fixnum(1)));
//debug         console.log("u_fixnum(-1) =", core.u_fixnum(-1), core.u_fixnum(-1).toString(16), core.u_print(core.u_fixnum(-1)));
//debug         console.log("u_fixnum(-2) =", core.u_fixnum(-2), core.u_fixnum(-2).toString(16), core.u_print(core.u_fixnum(-2)));
//debug         console.log("h_rom_top() =", core.h_rom_top(), core.u_print(core.h_rom_top()));
//debug         console.log("h_ram_top() =", core.h_ram_top(), core.u_print(core.h_ram_top()));
//debug         console.log("u_ramptr(5) =", core.u_ramptr(5), core.u_print(core.u_ramptr(5)));
//debug         console.log("u_ptr_to_cap(u_ramptr(3)) =", core.u_ptr_to_cap(core.u_ramptr(3)), core.u_print(core.u_ptr_to_cap(core.u_ramptr(3))));
//debug         return core.h_import(import.meta.resolve("../lib/dev.asm"));
//debug     }),
//debug     requestorize(function (asm_module) {
//debug         core.h_boot(asm_module.boot);
//debug         const start = performance.now();
//debug         console.log("IDLE:", core.u_fault_msg(core.h_run_loop()));
//debug         const duration = performance.now() - start;
//debug         return duration.toFixed(3) + "ms";
//debug     })
//debug ])(console.log);

export default Object.freeze(instantiate_core);
