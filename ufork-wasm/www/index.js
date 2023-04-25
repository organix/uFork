// uFork debugger

import OED from "./oed.js";
import oed from "./oed_lite.js";
import assemble from "./assemble.js";

const $ram_max = document.getElementById("ram-max");
const $ram_top = document.getElementById("ram-top");
const $ram_next = document.getElementById("ram-next");
const $ram_free = document.getElementById("ram-free");
const $gc_root = document.getElementById("gc-root");
const $gc_phase = document.getElementById("gc-phase");
const $rom_top = document.getElementById("rom-top");
const $mem_pages = document.getElementById("mem-pages");
const $sponsor_memory = document.getElementById("sponsor-memory");
const $sponsor_events = document.getElementById("sponsor-events");
const $sponsor_instrs = document.getElementById("sponsor-instrs");
const $equeue = document.getElementById("equeue");
const $kqueue = document.getElementById("kqueue");

const $mem_rom = document.getElementById("rom");
const $mem_ram = document.getElementById("ram");
const $mem_blob = document.getElementById("blob");
const $source_monitor = document.getElementById("source");

const $instr = document.getElementById("instr");
const $stack = document.getElementById("stack");
const $event = document.getElementById("event");
const $self = document.getElementById("self");
const $msg = document.getElementById("msg");

const $fault = document.getElementById("fault-led");

let paused = false;  // run/pause toggle
let fault = false;  // execution fault flag
const $rate = document.getElementById("frame-rate");
let frame = 1;  // frame-rate countdown
let ram_max = 0;

// type-tag bits
const MSK_RAW   = 0xF000_0000;  // mask for type-tag bits
const DIR_RAW   = 0x8000_0000;  // 1=direct (fixnum), 0=indirect (pointer)
const OPQ_RAW   = 0x4000_0000;  // 1=opaque (capability), 0=transparent (navigable)
const MUT_RAW   = 0x2000_0000;  // 1=read-write (mutable), 0=read-only (immutable)
const BNK_RAW   = 0x1000_0000;  // 1=bank_1, 0=bank_0 (half-space GC phase)
const BNK_0_RAW = 0;
const BNK_1_RAW = BNK_RAW;
// raw constants
const UNDEF_RAW = 0x0000_0000;
const NIL_RAW   = 0x0000_0001;
const FALSE_RAW = 0x0000_0002;
const TRUE_RAW  = 0x0000_0003;
const UNIT_RAW  = 0x0000_0004;
const EMPTY_DQ  = 0x0000_0005;
const LITERAL_T = 0x0000_0000; // == UNDEF
const TYPE_T    = 0x0000_0006;
const FIXNUM_T  = 0x0000_0007;
const ACTOR_T   = 0x0000_0008;
const PROXY_T   = 0x0000_0009;
const STUB_T    = 0x0000_000A;
const INSTR_T   = 0x0000_000B;
const PAIR_T    = 0x0000_000C;
const DICT_T    = 0x0000_000D;
const FWD_REF_T = 0x0000_000E;
const FREE_T    = 0x0000_000F;
// instr constants
const VM_TYPEQ  = 0x8000_0000;
const VM_CELL   = 0x8000_0001;  // reserved
const VM_GET    = 0x8000_0002;  // reserved
const VM_DICT   = 0x8000_0003;  // was "VM_SET"
const VM_PAIR   = 0x8000_0004;
const VM_PART   = 0x8000_0005;
const VM_NTH    = 0x8000_0006;
const VM_PUSH   = 0x8000_0007;
const VM_DEPTH  = 0x8000_0008;
const VM_DROP   = 0x8000_0009;
const VM_PICK   = 0x8000_000A;
const VM_DUP    = 0x8000_000B;
const VM_ROLL   = 0x8000_000C;
const VM_ALU    = 0x8000_000D;
const VM_EQ     = 0x8000_000E;
const VM_CMP    = 0x8000_000F;
const VM_IF     = 0x8000_0010;
const VM_MSG    = 0x8000_0011;
const VM_MY     = 0x8000_0012;
const VM_SEND   = 0x8000_0013;
const VM_NEW    = 0x8000_0014;
const VM_BEH    = 0x8000_0015;
const VM_END    = 0x8000_0016;
const VM_CVT    = 0x8000_0017;  // deprecated
const VM_PUTC   = 0x8000_0018;  // deprecated
const VM_GETC   = 0x8000_0019;  // deprecated
const VM_DEBUG  = 0x8000_001A;  // deprecated
const VM_DEQUE  = 0x8000_001B;
const VM_001C   = 0x8000_001C;  // reserved
const VM_001D   = 0x8000_001D;  // reserved
const VM_IS_EQ  = 0x8000_001E;
const VM_IS_NE  = 0x8000_001F;
// memory layout
const QUAD_ROM_MAX = 1 << 10;
const MEMORY_OFS = 0;
const DDEQUE_OFS = 1;
const DEBUG_DEV_OFS = 2;
const CLOCK_DEV_OFS = 3;
const IO_DEV_OFS = 4;
const BLOB_DEV_OFS = 5;
const MEMO_DEV_OFS = 6;
const SPONSOR_OFS = 7;
const h_no_init = function uninitialized() {
    return h_warning("WASM not initialized.");
};
// functions imported from uFork WASM module
let h_step = h_no_init;
let h_event_inject = h_no_init;
let h_revert = h_no_init;
let h_gc_run = h_no_init;
let h_rom_buffer = h_no_init;
let h_rom_top = h_no_init;
let h_set_rom_top = h_no_init;
let h_reserve_rom = h_no_init;
let h_ram_buffer = h_no_init;
let h_ram_top = h_no_init;
let h_reserve = h_no_init;
let h_blob_buffer = h_no_init;
let h_blob_top = h_no_init;
let h_gc_phase = h_no_init;
let h_in_mem = h_no_init;
let h_car = h_no_init;
let h_cdr = h_no_init;
let h_next = h_no_init;
let h_memory = h_no_init;
// local helper functions
function h_warning(message) {
    console.log("WARNING!", message);
    return UNDEF_RAW;
}
function h_is_raw(value) {
    return (Number.isSafeInteger(value) && value >= 0 && value < 2 ** 32);
}
function h_is_fix(raw) {
    return ((raw & DIR_RAW) !== 0);
}
function h_is_cap(raw) {
    return ((raw & (DIR_RAW | OPQ_RAW)) === OPQ_RAW);
}
function h_is_ptr(raw) {
    return ((raw & (DIR_RAW | OPQ_RAW)) === 0);
}
function h_is_rom(raw) {
    return ((raw & (DIR_RAW | OPQ_RAW | MUT_RAW)) === 0);
}
function h_is_ram(raw) {
    return ((raw & (DIR_RAW | OPQ_RAW | MUT_RAW)) === MUT_RAW);
}
function h_fixnum(i32) {
    return ((i32 | DIR_RAW) >>> 0);
}
function h_rawofs(raw) {
    return (raw & ~MSK_RAW);
}
function h_romptr(ofs) {
    return h_rawofs(ofs);
}
function h_ramptr(ofs, bnk) {
    if (typeof bnk !== "number") {
        bnk = h_gc_phase();
    }
    return (h_rawofs(ofs) | MUT_RAW | bnk);
}
function h_cap_to_ptr(cap) {
    return (h_is_fix(cap)
        ? h_warning("cap_to_ptr: can't convert fixnum "+h_print(cap))
        : (cap & ~OPQ_RAW));
}
function h_ptr_to_cap(ptr) {
    return (h_is_fix(ptr)
        ? h_warning("ptr_to_cap: can't convert fixnum "+h_print(ptr))
        : (ptr | OPQ_RAW));
}
function h_fix_to_i32(fix) {
    return (fix << 1) >> 1;
}
function h_mem_pages() {
    return h_memory().byteLength / 65536;
}
function h_read_quad(ptr) {
    if (h_is_ram(ptr)) {
        const ofs = h_rawofs(ptr);
        const ram_ofs = h_ram_buffer(h_gc_phase());
        const ram_top = h_rawofs(h_ram_top());
        if (ofs < ram_top) {
            const ram_len = ram_top << 2;
            const ram = new Uint32Array(h_memory(), ram_ofs, ram_len);
            const idx = ofs << 2;  // convert quad address to Uint32Array index
            const quad = {
                t: ram[idx + 0],
                x: ram[idx + 1],
                y: ram[idx + 2],
                z: ram[idx + 3]
            };
            return quad;
        } else {
            return h_warning("h_read_quad: RAM ptr out of bounds "+h_print(ptr));
        }
    }
    if (h_is_rom(ptr)) {
        const ofs = h_rawofs(ptr);
        const rom_ofs = h_rom_buffer();
        const rom_top = h_rawofs(h_rom_top());
        if (ofs < rom_top) {
            const rom_len = rom_top << 2;
            const rom = new Uint32Array(h_memory(), rom_ofs, rom_len);
            const idx = ofs << 2;  // convert quad address to Uint32Array index
            const quad = {
                t: rom[idx + 0],
                x: rom[idx + 1],
                y: rom[idx + 2],
                z: rom[idx + 3]
            };
            return quad;
        } else {
            return h_warning("h_read_quad: ROM ptr out of bounds "+h_print(ptr));
        }
    }
    return h_warning("h_read_quad: required ptr, got "+h_print(ptr));
}
function h_write_quad(ptr, quad) {
    if (h_is_ram(ptr)) {
        const ofs = h_rawofs(ptr);
        const ram_ofs = h_ram_buffer(h_gc_phase());
        const ram_top = h_rawofs(h_ram_top());
        if (ofs < ram_top) {
            const ram_len = ram_top << 2;
            const ram = new Uint32Array(h_memory(), ram_ofs, ram_len);
            const idx = ofs << 2;  // convert quad address to Uint32Array index
            ram[idx + 0] = quad.t;
            ram[idx + 1] = quad.x;
            ram[idx + 2] = quad.y;
            ram[idx + 3] = quad.z;
            return;
        } else {
            return h_warning("h_write_quad: RAM ptr out of bounds "+h_print(ptr));
        }
    }
    return h_warning("h_write_quad: required RAM ptr, got "+h_print(ptr));
}
function h_blob_mem() {
    const blob_ofs = h_blob_buffer();
    const blob_len = h_fix_to_i32(h_blob_top());
    const blob = new Uint8Array(h_memory(), blob_ofs, blob_len);
    return blob;
}

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
function h_print(raw) {
    if (typeof raw !== "number") {
        return "" + raw;
    }
    if (h_is_fix(raw)) {  // fixnum
        const i32 = h_fix_to_i32(raw);
        if (i32 < 0) {
            return "" + i32;
        } else {
            return "+" + i32;
        }
    }
    if (raw < rom_label.length) {
        return rom_label[raw];
    }
    const prefix = (raw & OPQ_RAW) ? "@" : "^";
    return prefix + ("00000000" + raw.toString(16)).slice(-8);
}
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
    "VM_001C",  // reserved
    "VM_001D",  // reserved
    "VM_IS_EQ",
    "VM_IS_NE"
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
function q_print(quad) {
    let s = "{ ";
    if (quad.t === INSTR_T) {
        s += "t:INSTR_T, x:";
        const op = quad.x ^ DIR_RAW;  // translate opcode
        if (op < instr_label.length) {
            const imm = quad.y ^ DIR_RAW;  // translate immediate
            if ((quad.x === VM_DICT) && (imm < dict_imm_label.length)) {
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
                s += end_imm_label[h_fix_to_i32(quad.y) + 1];  // END_ABORT === -1
            } else {
                s += instr_label[op];
                s += ", y:";
                s += h_print(quad.y);
            }
        } else {
            s += h_print(quad.x);
            s += ", y:";
            s += h_print(quad.y);
        }
    } else {
        s += "t:";
        s += h_print(quad.t);
        s += ", x:";
        s += h_print(quad.x);
        s += ", y:";
        s += h_print(quad.y);
    }
    s += ", z:";
    s += h_print(quad.z);
    s += " }";
    return s;
}
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
function h_load(specifier, crlf, imports, alloc, read) {
    // Load a module.
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
                h_is_raw(definitions[name])
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
                    h_is_raw(imports[ref.module][ref.name])
                    ? imports[ref.module][ref.name]
                    : fail("Not exported", ref.module + "." + ref.name, ref)
                )
                : fail("Not imported", ref.module, ref)
            )
        );
    }
    function label(name, labels, prefix_length = 0, offset = 0) {
        const index = labels.findIndex(function (label) {
            return label.slice(prefix_length).toLowerCase() === name;
        }) + offset;
        return (
            Number.isSafeInteger(index)
            ? h_fixnum(index)
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
            h_is_raw(raw)
            ? raw
            : fail("Not a literal", node)
        );
    }
    function fixnum(node) {
        return (
            kind(node) === "fixnum"
            ? h_fixnum(node) // FIXME: check integer bounds?
            : fail("Not a fixnum", node)
        );
    }
    function type(node) {
        const raw = crlf_types[node.name];
        return (
            h_is_raw(raw)
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
            return populate(alloc(node.debug), node);
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
                node.op === "pair"
                || node.op === "part"
                || node.op === "nth"
                || node.op === "drop"
                || node.op === "pick"
                || node.op === "dup"
                || node.op === "roll"
                || node.op === "msg"
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
    // Allocate a placeholder quad for each definition that requires one, or set
    // the raw directly. Only resolve refs that refer to imports, not
    // definitions.
    Object.entries(crlf.ast.define).forEach(function ([name, node]) {
        if (is_quad(node)) {
            definitions[name] = alloc(node.debug);
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
        if (!h_is_ptr(raw) || read(raw).t !== t) {
            return fail("Bad continuation", node);
        }
    });
    // Check for cyclic data structures, which are pathological for some
    // instructions.
    cyclic_data_checks.forEach(function ([raw, t, k_field, node]) {
        let seen = [];
        while (h_is_ptr(raw)) {
            if (seen.includes(raw)) {
                return fail("Cyclic", node);
            }
            const quad = read(raw);
            if (quad.t !== t) {
                break;
            }
            seen.push(raw);
            raw = quad[k_field];
        }
    });
    // Populate the exports object.
    let exports = Object.create(null);
    crlf.ast.export.forEach(function (name) {
        exports[name] = definition_raw(name);
    });
    return exports;
}
let import_promises = Object.create(null);
let module_source = Object.create(null);
function h_import(specifier, alloc) {
    // Import and load a module, along with its dependencies.
    if (import_promises[specifier] === undefined) {
        import_promises[specifier] = fetch(specifier).then(function (response) {
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
            return Promise.all(
                Object.values(crlf.ast.import).map(function (import_specifier) {
                    // FIXME: cyclic module dependencies cause a deadlock, but
                    // they should instead fail with an error.
                    return h_import(
                        new URL(import_specifier, specifier).href,
                        alloc
                    );
                })
            ).then(function (imported_modules) {
                const imports = Object.create(null);
                Object.keys(crlf.ast.import).forEach(function (name, nr) {
                    imports[name] = imported_modules[nr];
                });
                return h_load(specifier, crlf, imports, alloc, h_read_quad);
            });
        });
    }
    return import_promises[specifier];
}
// Allocates a quad in ROM.
let rom_sourcemap = Object.create(null);
function rom_alloc(debug_info) {
    const raw = h_reserve_rom();
    rom_sourcemap[raw] = debug_info;
    return Object.freeze({
        raw() {
            return raw;
        },
        write({t, x, y, z}) {
            const ofs = h_rawofs(raw) << 4; // convert quad offset to byte offset
            const quad = new Uint32Array(h_memory(), h_rom_buffer() + ofs, 4);
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
function h_disasm(ptr) {
    let s = h_print(ptr);
    if (h_is_cap(ptr)) {
        ptr = h_cap_to_ptr(ptr);
    }
    if (h_is_ptr(ptr)) {
        s += ": ";
        const quad = h_read_quad(ptr);
        s += q_print(quad);
    }
    return s;
}
function h_pprint(raw) {
    if (h_is_ptr(raw)) {
        let quad = h_read_quad(raw);
        if (quad.t === PAIR_T) {
            let s = "";
            let p = raw;
            let sep = "(";
            while (quad.t === PAIR_T) {
                s += sep;
                s += h_pprint(quad.x);  // car
                sep = " ";
                p = quad.y;  // cdr
                if (!h_is_ptr(p)) break;
                quad = h_read_quad(p);
            }
            if (p !== NIL_RAW) {
                s += " . ";
                s += h_pprint(p);
            }
            s += ")";
            return s;
        }
        if (quad.t === DICT_T) {
            let s = "";
            let sep = "{";
            while (quad.t === DICT_T) {
                s += sep;
                s += h_pprint(quad.x);  // key
                s += ":";
                s += h_pprint(quad.y);  // value
                sep = ", ";
                quad = h_read_quad(quad.z);  // next
            }
            s += "}";
            return s;
        }
    }
    return h_print(raw);
}

function updateElementText(el, txt) {
    if (el.textContent === txt) {
        el.style.color = '#000';
    } else {
        el.style.color = '#03F';
    }
    el.textContent = txt;
}
function updateElementValue(el, val) {
    const txt = "" + val;
    if (el.value === txt) {
        el.style.color = '#000';
    } else {
        el.style.color = '#03F';
    }
    el.value = txt;
}
function updateRomMonitor() {
    let a = [];
    const top = h_rawofs(h_rom_top());
    for (let ofs = 0; ofs < top; ofs += 1) {
        const ptr = h_romptr(ofs);
        const quad = h_read_quad(ptr);
        const line = ("         " + h_print(ptr)).slice(-9)
            + ": " + q_print(quad);
        a.push(line);
    }
    $mem_rom.textContent = a.join("\n");
}
function updateRamMonitor() {
    let a = [];
    const top = h_rawofs(h_ram_top());
    for (let ofs = 0; ofs < top; ofs += 1) {
        const ptr = h_ramptr(ofs);
        const line = h_disasm(ptr);
        a.push(line);
    }
    $mem_ram.textContent = a.join("\n");
}
function updateBlobMonitor() {
    $mem_blob.textContent = hexdump(h_blob_mem());
}
function keep_centered(child, parent) {
    const child_rect = child.getBoundingClientRect();
    const parent_rect = parent.getBoundingClientRect();
    const offset = parent.scrollTop + child_rect.top - parent_rect.top;
    parent.scrollTop = offset - parent_rect.height / 2 + child_rect.height / 2;
}
function updateSourceMonitor(ip) {
    if (h_is_rom(ip) && ip !== UNDEF_RAW && rom_sourcemap[ip] !== undefined) {
        const debug = rom_sourcemap[ip];
        const source = module_source[debug.file];
        if (source !== undefined) {
            $source_monitor.href = debug.file;
            $source_monitor.innerHTML = "";
            let highlighted;
            source.split(/\n|\r\n?/).forEach(function (line, line_nr) {
                const line_element = document.createElement("span");
                line_element.textContent = (
                    String(line_nr + 1).padStart(4, " ") + "  " + line
                );
                if (debug.line === line_nr + 1) {
                    line_element.className = "highlighted";
                    highlighted = line_element;
                }
                $source_monitor.append(line_element);
            });
            if (highlighted !== undefined) {
                keep_centered(highlighted, $source_monitor);
            }
            return;
        }
    }
    $source_monitor.textContent = "No source available.";
    delete $source_monitor.href;
}
const drawHost = () => {
    $revertButton.disabled = !fault;
    if (fault) {
        $fault.setAttribute("fill", "#F30");
        $fault.setAttribute("stroke", "#900");
    } else {
        $fault.setAttribute("fill", "#0F3");
        $fault.setAttribute("stroke", "#090");
    }
    updateBlobMonitor();
    updateRamMonitor();
    const top = h_rawofs(h_ram_top());
    if (top > ram_max) {
        ram_max = top;
    }
    updateElementText($ram_max, ram_max.toString());
    const memory_quad = h_read_quad(h_ramptr(MEMORY_OFS));
    const ram_top = memory_quad.t;
    const ram_next = memory_quad.x;
    const ram_free = memory_quad.y;
    const gc_root = memory_quad.z;
    const rom_top = h_rawofs(h_rom_top());
    updateElementText($ram_top, h_print(ram_top));
    updateElementText($ram_next, h_print(ram_next));
    updateElementText($ram_free, h_print(ram_free));
    updateElementText($gc_root, h_print(gc_root));
    updateElementText($rom_top, h_print(rom_top));
    updateElementText($mem_pages, h_mem_pages());
    updateElementText($gc_phase, h_gc_phase() == 0 ? "Bank 0" : "Bank 1");
    const ddeque_quad = h_read_quad(h_ramptr(DDEQUE_OFS));
    const e_first = ddeque_quad.t;
    //const e_last = ddeque_quad.x;
    const k_first = ddeque_quad.y;
    //const k_last = ddeque_quad.z;
    if (h_in_mem(k_first)) {
        let p = k_first;
        let a = [];
        while (h_in_mem(p)) {
            a.push(h_disasm(p));  // disasm continuation
            p = h_next(p);
        }
        updateElementText($kqueue, a.join("\n"));
    } else {
        updateElementText($kqueue, "--");
    }
    if (h_in_mem(e_first)) {
        let p = e_first;
        let a = [];
        while (h_in_mem(p)) {
            a.push(h_disasm(p));  // disasm event
            p = h_next(p);
        }
        updateElementText($equeue, a.join("\n"));
    } else {
        updateElementText($equeue, "--");
    }
    const cont_quad = h_read_quad(k_first);
    const ip = cont_quad.t;
    const sp = cont_quad.x;
    const ep = cont_quad.y;
    if (h_in_mem(ip)) {
        let p = ip;
        let n = 5;
        let a = [];
        while ((n > 0) && h_in_mem(p)) {
            a.push(h_disasm(p));
            p = h_next(p);
            n -= 1;
        }
        if (h_in_mem(p)) {
            a.push("...");
        }
        updateElementText($instr, a.join("\n"));
    } else {
        updateElementText($instr, "--");
    }
    updateSourceMonitor(ip);
    if (h_in_mem(sp)) {
        let p = sp;
        let a = [];
        while (h_in_mem(p)) {
            //a.push(h_disasm(p));  // disasm stack Pair
            //a.push(h_print(h_car(p)));  // print stack item
            a.push(h_pprint(h_car(p)));  // pretty-print stack item
            p = h_cdr(p);
        }
        updateElementText($stack, a.join("\n"));
    } else {
        updateElementText($stack, "--");
    }
    $stack.title = h_disasm(sp);
    updateElementText($event, h_disasm(ep));
    const event_quad = h_read_quad(ep);
    const sponsor = event_quad.t;
    const target = event_quad.x;
    const message = event_quad.y;
    const rollback =  event_quad.z;
    updateElementText($self, h_disasm(target));
    updateElementText($msg, h_pprint(message));  // pretty-print message
    const sponsor_quad = h_read_quad(sponsor);
    updateElementValue($sponsor_memory, h_fix_to_i32(sponsor_quad.t));
    updateElementValue($sponsor_events, h_fix_to_i32(sponsor_quad.x));
    updateElementValue($sponsor_instrs, h_fix_to_i32(sponsor_quad.y));
    enableNext();
}
function currentContinuation() {
    const ddeque_quad = h_read_quad(h_ramptr(DDEQUE_OFS));
    const k_first = ddeque_quad.y;
    if (h_in_mem(k_first)) {
        const cont_quad = h_read_quad(k_first);
        return {
            ip: cont_quad.t,
            sp: cont_quad.x,
            ep: cont_quad.y,
        };
    }
}
function enableNext() {
    if (paused) {
        const cc = currentContinuation();
        if (cc) {
            const instr = h_read_quad(cc.ip);
            if ((instr.t === INSTR_T) && (instr.x !== VM_END)) {
                $nextButton.disabled = false;
                return;
            }
        }
    }
    $nextButton.disabled = true;
}
const gcHost = () => {
    h_gc_run();
    drawHost();
}
const singleStep = () => {
    const err = h_step();
    if (err === 0) {  // 0 = E_OK = no error
        fault = false;
    } else {
        fault = true;
        console.log("singleStep: error = ", err);
    }
    drawHost();
    return !fault;
};
const nextStep = () => {
    // execute next instruction for current event
    let cc = currentContinuation();
    if (!cc) return singleStep();
    let next_event = cc.ep;
    while (true) {
        const err = h_step();
        if (err === 0) {  // 0 = E_OK = no error
            fault = false;
        } else {
            fault = true;
            console.log("nextStep: error = ", err);
            break;
        }
        cc = currentContinuation();
        if (!cc) break;
        if (cc.ep === next_event) break;
    }
    drawHost();
    return !fault;
};
const renderLoop = () => {
    //debugger;
    if (paused) return;

    if (--frame > 0) {
        // skip this frame update
    } else {
        frame = +($rate.value);
        if (singleStep() == false) {  // pause on fault signal
            pauseAction();
            return;
        }
    }
    requestAnimationFrame(renderLoop);
}

const logClick = event => {
    //console.log("logClick:", event);
    const s = event.target.textContent;
    console.log("logClick:", event, s);
}

function cap_dict(device_offsets) {
    return device_offsets.reduce(function (next, ofs) {
        const dict = h_reserve();
        h_write_quad(dict, {
            t: DICT_T,
            x: h_fixnum(ofs),
            y: h_ptr_to_cap(h_ramptr(ofs)),
            z: next
        });
        return dict;
    }, NIL_RAW);
}

function boot(module_specifier) {
    return h_import(
        new URL(module_specifier, window.location.href).href,
        rom_alloc
    ).then(function (module) {
        if (module.boot === undefined) {
            return Promise.reject("Module does not support booting.");
        }
        // Make a boot actor, to be sent the boot message.
        const actor = h_reserve();
        h_write_quad(actor, {
            t: ACTOR_T,
            x: module.boot,
            y: NIL_RAW,
            z: UNDEF_RAW
        });
        // Inject the boot event (with a message holding the capabilities) to
        // the front of the event queue.
        h_event_inject(
            h_ramptr(SPONSOR_OFS),
            h_ptr_to_cap(actor),
            cap_dict([DEBUG_DEV_OFS, CLOCK_DEV_OFS, IO_DEV_OFS, BLOB_DEV_OFS, MEMO_DEV_OFS])
        );
        updateRomMonitor();
        drawHost();
    });
}

const $gcButton = document.getElementById("gc-btn");
$gcButton.onclick = gcHost;
$gcButton.title = "Run garbage collection (g)";

const $revertButton = document.getElementById("revert-btn");
$revertButton.disabled = true;
$revertButton.onclick = () => {
    h_revert();  // FIXME: check `bool` result...
    drawHost();
};
$revertButton.title = "Revert actor message-event";

const $nextButton = document.getElementById("next-step");
$nextButton.onclick = nextStep;
$nextButton.title = "Next instruction for this event (n)";

const $stepButton = document.getElementById("single-step");
$stepButton.onclick = singleStep;
$stepButton.title = "Next instruction in KQ (s)";

const $pauseButton = document.getElementById("play-pause");
const playAction = () => {
    $pauseButton.textContent = "Pause";
    $pauseButton.onclick = pauseAction;
    $pauseButton.title = "Pause execution (c)";
    paused = false;
    $stepButton.disabled = true;
    renderLoop();
}
const pauseAction = () => {
    $pauseButton.textContent = "Play";
    $pauseButton.onclick = playAction;
    $pauseButton.title = "Continue execution (c)";
    $stepButton.disabled = false;
    paused = true;
    drawHost();
}

const $bootInput = document.getElementById("boot-url");
const $bootForm = document.getElementById("boot-form");
$bootForm.onsubmit = function (event) {
    boot($bootInput.value);
    event.preventDefault();
};
const $bootButton = document.getElementById("boot");
$bootButton.title = "Boot from module (b)";

// Keybindings
document.onkeydown = function (event) {
    if (
        event.metaKey
        || event.ctrlKey
        || event.altKey
        || document.activeElement !== document.body // focused <input> etc
    ) {
        return;
    }
    if (event.key === "c") {
        if (paused) {
            playAction();
        } else {
            pauseAction();
        }
    } else if (event.key === "s" && !$stepButton.disabled) {
        singleStep();
    } else if (event.key === "n" && !$nextButton.disabled) {
        nextStep();
    } else if (event.key === "b") {
        boot($bootInput.value);
    } else if (event.key === "g") {
        gcHost();
    }
};

/*
0000:  06 10 82 38  01 81 07 10  82 32 01 84  0b 84 6b 69  ···8·····2····ki
0130:  09 08 09 14  09 0a 0a 85  48 65 6c 6c  6f           ········Hello   
*/
function hexdump(u8buf, ofs, len, xlt) {
    ofs = ofs ?? 0;
    len = len ?? u8buf.length;
    xlt = xlt ?? function (code) {
        // translate control codes to center-dot
        if ((code < 0x20) || ((0x7F <= code) && (code < 0xA0))) {
          return 0xB7;  //  "·"
        }
        return code;
    }
    let out = "";
    while (ofs < len) {
        let str = "";
        out += ("0000" + ofs.toString(16)).slice(-4) + ":";
        for (let cnt = 0; cnt < 16; cnt += 1) {
            out += ((cnt & 0x3) === 0) ? "  " : " ";
            const idx = ofs + cnt;
            if (idx < len) {
                const code = u8buf[idx];
                out += ("00" + code.toString(16)).slice(-2);
                str += String.fromCodePoint(xlt(code));
            } else {
                out += "  ";
                str += " ";
            }
        }
        out += "  " + str + "\n";
        ofs += 16;
    }
    return out;
}

function h_snapshot() {
    // create a snapshot with the uFork VM state
    const mem_base = h_memory();

    const rom_ofs = h_rom_buffer();
    const rom_len = h_rawofs(h_rom_top()) << 2;
    const rom = new Uint32Array(mem_base, rom_ofs, rom_len);

    const ram_ofs = h_ram_buffer(h_gc_phase());
    const ram_len = h_rawofs(h_ram_top()) << 2;
    const ram = new Uint32Array(mem_base, ram_ofs, ram_len);

    const blob_ofs = h_blob_buffer();
    const blob_len = h_fix_to_i32(h_blob_top());
    const blob = new Uint8Array(mem_base, blob_ofs, blob_len);

    return {
        rom: Array.from(rom),
        ram: Array.from(ram),
        blob: blob.slice(),
    };
}
function h_restore(snapshot) {
    // restore uFork VM state from snapshot
    const mem_base = h_memory();

    const rom_ofs = h_rom_buffer();
    const rom_len = snapshot.rom.length;
    const rom = new Uint32Array(mem_base, rom_ofs, rom_len);
    rom.set(snapshot.rom);

    //const old_phase = h_gc_phase();
    const old_ram = h_ramptr(MEMORY_OFS);
    h_write_quad(old_ram, { t: UNDEF_RAW, x: UNDEF_RAW, y: UNDEF_RAW, z: UNDEF_RAW });
    const gc_phase = snapshot.ram[0] & BNK_RAW;
    const ram_ofs = h_ram_buffer(gc_phase);
    const ram_len = snapshot.ram.length;
    const ram = new Uint32Array(mem_base, ram_ofs, ram_len);
    ram.set(snapshot.ram);
    //const new_phase = h_gc_phase();

    const blob_ofs = h_blob_buffer();
    const blob_len = snapshot.blob.length;
    const blob = new Uint8Array(mem_base, blob_ofs, blob_len);
    blob.set(snapshot.blob);

    const rom_top = h_romptr(rom_len >> 2);
    h_set_rom_top(rom_top);  // register new top-of-ROM
    updateRomMonitor();
    drawHost();
}
const $snapshotButton = document.getElementById("snapshot-btn");
$snapshotButton.onclick = function download_snapshot_file() {
    const snapshot_blob = new Blob(
        [OED.encode(h_snapshot())],
        {type: "application/octet-stream"}
    );
    const snapshot_url = URL.createObjectURL(snapshot_blob);
    const $anchor = document.createElement("a");
    $anchor.download = "ufork_snapshot.bin";
    $anchor.href = snapshot_url;
    $anchor.click();
    URL.revokeObjectURL(snapshot_url);
};
$snapshotButton.title = "Snapshot VM state";
const $restoreInput = document.getElementById("restore-btn");
$restoreInput.onchange = function restore_snapshot_file() {
    $restoreInput.files[0].arrayBuffer().then(function (array_buffer) {
        h_restore(OED.decode(new Uint8Array(array_buffer)));
    });
    $restoreInput.value = ""; // reset
};
$restoreInput.title = "Restore from snapshot";

$sponsor_memory.oninput = function () {
    const num = +($sponsor_memory.value);
    if (Number.isSafeInteger(num) && (num >= 0)) {
        const cc = currentContinuation();
        if (cc) {
            const event = h_read_quad(cc.ep);
            const sponsor = h_read_quad(event.t);
            sponsor.t = h_fixnum(num);
            h_write_quad(event.t, sponsor);
            drawHost();
        }
    }
};
$sponsor_events.oninput = function () {
    const num = +($sponsor_events.value);
    if (Number.isSafeInteger(num) && (num >= 0)) {
        const cc = currentContinuation();
        if (cc) {
            const event = h_read_quad(cc.ep);
            const sponsor = h_read_quad(event.t);
            sponsor.x = h_fixnum(num);
            h_write_quad(event.t, sponsor);
            drawHost();
        }
    }
};
$sponsor_instrs.oninput = function () {
    const num = +($sponsor_instrs.value);
    if (Number.isSafeInteger(num) && (num >= 0)) {
        const cc = currentContinuation();
        if (cc) {
            const event = h_read_quad(cc.ep);
            const sponsor = h_read_quad(event.t);
            sponsor.y = h_fixnum(num);
            h_write_quad(event.t, sponsor);
            drawHost();
        }
    }
};

function test_suite(exports) {
    console.log("h_fixnum(0) =", h_fixnum(0), h_fixnum(0).toString(16), h_print(h_fixnum(0)));
    console.log("h_fixnum(1) =", h_fixnum(1), h_fixnum(1).toString(16), h_print(h_fixnum(1)));
    console.log("h_fixnum(-1) =", h_fixnum(-1), h_fixnum(-1).toString(16), h_print(h_fixnum(-1)));
    console.log("h_fixnum(-2) =", h_fixnum(-2), h_fixnum(-2).toString(16), h_print(h_fixnum(-2)));
    console.log("h_rom_top() =", h_rom_top(), h_print(h_rom_top()));
    console.log("h_ram_top() =", h_ram_top(), h_print(h_ram_top()));
    console.log("h_ramptr(5) =", h_ramptr(5), h_print(h_ramptr(5)));
    console.log("h_ptr_to_cap(h_ramptr(3)) =", h_ptr_to_cap(h_ramptr(3)), h_print(h_ptr_to_cap(h_ramptr(3))));
    console.log("h_memory() =", h_memory());

    const rom_ofs = h_rom_buffer();
    const rom = new Uint32Array(h_memory(), rom_ofs, (h_rawofs(h_rom_top()) << 2));
    console.log("ROM:", rom);

    const ram_ofs = h_ram_buffer(h_gc_phase());
    const ram = new Uint32Array(h_memory(), ram_ofs, (h_rawofs(h_ram_top()) << 2));
    console.log("RAM:", ram);

    const blob_ofs = h_blob_buffer();
    const blob = new Uint8Array(h_memory(), blob_ofs, h_fix_to_i32(h_blob_top()));
    console.log("BLOB:", blob);

    const decoded = {
        space: {origin: [-40, -200], extent: [600, 460]},
        shapes: [
            {origin: [5, 3], extent: [21, 13]},
            {origin: [8, 5], extent: [13, 8]}
        ]
    };
    const encoded = OED.encode(decoded);
    const enc_lite = oed.encode(decoded);
    console.log("OED encoded:", encoded, enc_lite);
    let dec_encoded = OED.decode(encoded);
    let dec_enc_lite = OED.decode(enc_lite);
    let dec_lite_encoded = oed.decode(encoded);
    let dec_lite_enc_lite = oed.decode(enc_lite);
    console.log("OED decoded:", dec_encoded, dec_enc_lite, dec_lite_encoded, dec_lite_enc_lite);
    let dec_at11_encoded = OED.decode(encoded, undefined, 11);
    let dec_at11_enc_lite = oed.decode({ octets: enc_lite, offset: 11 });
    console.log("OED seek:", dec_at11_encoded, dec_at11_enc_lite);
}

WebAssembly.instantiateStreaming(
    fetch("../target/wasm32-unknown-unknown/release/ufork_wasm.wasm"),
    {
        js: {
            host_clock() {  // WASM type: () -> i32
                return performance.now();
            },
            host_print(base, ofs) {  // WASM type: (i32, i32) -> nil
                const mem = new Uint8Array(h_memory(), base);  // u8[] view of blob memory
                const buf = mem.subarray(ofs - 5);  // blob allocation has a 5-octet header
                //const buf = mem.subarray(ofs);  // create window into application-managed memory
                //const blob = OED.decode(buf, undefined, 0);  // decode a single OED value
                //const blob = oed.decode(buf).value;  // decode a single OED value
                const blob = oed.decode(buf);  // decode value and return OED structure
                console.log("PRINT:", blob, base, ofs);
            },
            host_log(x) {  // WASM type: (i32) -> nil
                console.log("LOG:", x, "=", h_print(x), "->", h_pprint(x));
            },
        }
    }
).then(function (wasm) {
    console.log("wasm =", wasm);
    const exports = wasm.instance.exports;
    //debugger;

    h_step = exports.h_step;
    h_event_inject = exports.h_event_inject;
    h_revert = exports.h_revert;
    h_gc_run = exports.h_gc_run;
    h_rom_buffer = exports.h_rom_buffer;
    h_rom_top = exports.h_rom_top;
    h_set_rom_top = exports.h_set_rom_top;
    h_reserve_rom = exports.h_reserve_rom;
    h_ram_buffer = exports.h_ram_buffer;
    h_ram_top = exports.h_ram_top;
    h_reserve = exports.h_reserve;
    h_blob_buffer = exports.h_blob_buffer;
    h_blob_top = exports.h_blob_top;
    h_gc_phase = exports.h_gc_phase;
    h_in_mem = exports.h_in_mem;
    h_car = exports.h_car;
    h_cdr = exports.h_cdr;
    h_next = exports.h_next;

    h_memory = function wasm_memory() {
        // WARNING! The WASM memory buffer can move if it is resized.
        //          We get a fresh pointer each time for safety.
        return exports.memory.buffer;
    }

    test_suite();

    // draw initial state
    updateRomMonitor();
    drawHost();

    //playAction();  // start animation (running)
    pauseAction();  // start animation (paused)
});
