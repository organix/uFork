// uFork debugger

const $mem_max = document.getElementById("ufork-mem-max");
const $mem_top = document.getElementById("ufork-mem-top");
const $mem_next = document.getElementById("ufork-mem-next");
const $mem_free = document.getElementById("ufork-mem-free");
const $mem_root = document.getElementById("ufork-mem-root");
const $mem_pages = document.getElementById("ufork-mem-pages");
const $gc_phase = document.getElementById("ufork-gc-phase");
const $sponsor_memory = document.getElementById("ufork-sponsor-memory");
const $sponsor_events = document.getElementById("ufork-sponsor-events");
const $sponsor_instrs = document.getElementById("ufork-sponsor-instrs");
const $equeue = document.getElementById("ufork-equeue");
const $kqueue = document.getElementById("ufork-kqueue");

const $mem_rom = document.getElementById("ufork-rom");
const $mem_ram = document.getElementById("ufork-ram");
const $mem_blob = document.getElementById("ufork-blob");

const $instr = document.getElementById("ufork-instr");
const $stack = document.getElementById("ufork-stack");
const $event = document.getElementById("ufork-event");
const $self = document.getElementById("ufork-self");
const $msg = document.getElementById("ufork-msg");

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
const UNIT_RAW 	= 0x0000_0004;
const TYPE_T    = 0x0000_0005;
const GC_FWD_T  = 0x0000_0006;
const INSTR_T   = 0x0000_0007;
const ACTOR_T   = 0x0000_0008;
const FIXNUM_T  = 0x0000_0009;
const SYMBOL_T  = 0x0000_000A;
const PAIR_T    = 0x0000_000B;
const DICT_T    = 0x0000_000C;
const PROXY_T   = 0x0000_000D;
const STUB_T    = 0x0000_000E;
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
// ram offets
const MEMORY_OFS = 0;
const DDEQUE_OFS = 1;
// local helper functions
function h_warning(message) {
    console.log("WARNING!", message);
    return UNDEF_RAW;
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
// functions bound during WASM initialization
const h_no_init = function uninitialized() {
    return h_warning("WASM not initialized.");
};
let h_mem_pages = h_no_init;
let h_read_quad = h_no_init;
let h_write_quad = h_no_init;
let h_blob_mem = h_no_init;
// functions imported from uFork WASM module
let h_step = h_no_init;
let h_gc_run = h_no_init;
let h_rom_buffer = h_no_init;
let h_rom_top = h_no_init;
let h_ram_buffer = h_no_init;
let h_ram_top = h_no_init;
let h_blob_buffer = h_no_init;
let h_blob_top = h_no_init;
let h_gc_phase = h_no_init;
let h_in_mem = h_no_init;
let h_car = h_no_init;
let h_cdr = h_no_init;
let h_next = h_no_init;

const rom_label = [
    "#?",
    "()",
    "#f",
    "#t",
    "#unit",
    "TYPE_T",
    "GC_FWD_T",
    "INSTR_T",
    "ACTOR_T",
    "FIXNUM_T",
    "SYMBOL_T",
    "PAIR_T",
    "DICT_T",
    "PROXY_T",
    "STUB_T",
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

const updateElementText = (el, txt) => {
    if (el.textContent == txt) {
        el.style.color = '#000';
    } else {
        el.style.color = '#03F';
    }
    el.textContent = txt;
}
function updateRomMonitor() {
    let a = [];
    for (let ofs = 0; ofs < h_rawofs(h_rom_top()); ofs += 1) {
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
    for (let ofs = 0; ofs < h_rawofs(h_ram_top()); ofs += 1) {
        const ptr = h_ramptr(ofs);
        const line = h_disasm(ptr);
        a.push(line);
    }
    $mem_ram.textContent = a.join("\n");
}
function updateBlobMonitor() {
    $mem_blob.textContent = hexdump(h_blob_mem());
}
const drawHost = () => {
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
    updateElementText($mem_max, ram_max.toString());
    const memory_quad = h_read_quad(h_ramptr(MEMORY_OFS));
    const ram_top = memory_quad.t;
    const ram_next = memory_quad.x;
    const ram_free = memory_quad.y;
    const ram_root = memory_quad.z;
    updateElementText($mem_top, h_print(ram_top));
    updateElementText($mem_next, h_print(ram_next));
    updateElementText($mem_free, h_print(ram_free));
    updateElementText($mem_root, h_print(ram_root));
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
    updateElementText($sponsor_memory, h_print(sponsor_quad.t));
    updateElementText($sponsor_events, h_print(sponsor_quad.x));
    updateElementText($sponsor_instrs, h_print(sponsor_quad.y));
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
//$mem_root.onclick = logClick;

const $gcButton = document.getElementById("ufork-gc-btn");
$gcButton.onclick = gcHost;

const $stepButton = document.getElementById("single-step");
$stepButton.onclick = singleStep;

const $pauseButton = document.getElementById("play-pause");
const playAction = () => {
    $pauseButton.textContent = "Pause";
    $pauseButton.onclick = pauseAction;
    paused = false;
    $stepButton.disabled = true;
    renderLoop();
}
const pauseAction = () => {
    $pauseButton.textContent = "Play";
    $pauseButton.onclick = playAction;
    $stepButton.disabled = false;
    paused = true;
}

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

function test_suite(exports) {
    console.log("h_fixnum(0) =", h_fixnum(0), h_fixnum(0).toString(16), h_print(h_fixnum(0)));
    console.log("h_fixnum(1) =", h_fixnum(1), h_fixnum(1).toString(16), h_print(h_fixnum(1)));
    console.log("h_fixnum(-1) =", h_fixnum(-1), h_fixnum(-1).toString(16), h_print(h_fixnum(-1)));
    console.log("h_fixnum(-2) =", h_fixnum(-2), h_fixnum(-2).toString(16), h_print(h_fixnum(-2)));
    console.log("h_rom_top() =", h_rom_top(), h_print(h_rom_top()));
    console.log("h_ram_top() =", h_ram_top(), h_print(h_ram_top()));
    console.log("h_ramptr(5) =", h_ramptr(5), h_print(h_ramptr(5)));
    console.log("h_ptr_to_cap(h_ramptr(3)) =", h_ptr_to_cap(h_ramptr(3)), h_print(h_ptr_to_cap(h_ramptr(3))));

    const rom_ofs = h_rom_buffer();
    const rom = new Uint32Array(exports.memory.buffer, rom_ofs, (h_rawofs(h_rom_top()) << 2));
    console.log("ROM:", rom);

    const ram_ofs = h_ram_buffer(h_gc_phase());
    const ram = new Uint32Array(exports.memory.buffer, ram_ofs, (h_rawofs(h_ram_top()) << 2));
    console.log("RAM:", ram);

    const blob_ofs = h_blob_buffer();
    const blob = new Uint8Array(exports.memory.buffer, blob_ofs, h_fix_to_i32(h_blob_top()));
    console.log("BLOB:", blob);
}

WebAssembly.instantiateStreaming(
    fetch("../target/wasm32-unknown-unknown/release/ufork_wasm.wasm"),
    {
        js: {
            host_clock() {
                return performance.now();
            },
            host_log(x) {
                if (Number.isSafeInteger(x)) {
                    x = "$" + ("00000000" + x.toString(16)).slice(-8);
                }
                console.log("LOG:", x);
            }
        }
    }
).then(function (wasm) {
    console.log("wasm =", wasm);
    const exports = wasm.instance.exports;
    //debugger;

    h_step = exports.h_step;
    h_gc_run = exports.h_gc_run;
    h_rom_buffer = exports.h_rom_buffer;
    h_rom_top = exports.h_rom_top;
    h_ram_buffer = exports.h_ram_buffer;
    h_ram_top = exports.h_ram_top;
    h_blob_buffer = exports.h_blob_buffer;
    h_blob_top = exports.h_blob_top;
    h_gc_phase = exports.h_gc_phase;
    h_in_mem = exports.h_in_mem;
    h_car = exports.h_car;
    h_cdr = exports.h_cdr;
    h_next = exports.h_next;

    test_suite(exports);

    h_mem_pages = function mem_pages() {
        return exports.memory.buffer.byteLength / 65536;
    }
    h_read_quad = function read_quad(ptr) {
        if (h_is_ram(ptr)) {
            // WARNING! The WASM memory buffer can move if it is resized.
            //          We get a fresh pointer each time for safety.
            const ofs = h_rawofs(ptr);
            const ram_ofs = h_ram_buffer(h_gc_phase());
            const ram_top = h_rawofs(h_ram_top());
            if (ofs < ram_top) {
                const ram_len = ram_top << 2;
                const ram = new Uint32Array(exports.memory.buffer, ram_ofs, ram_len);
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
            // WARNING! The WASM memory buffer can move if it is resized.
            //          We get a fresh pointer each time for safety.
            const ofs = h_rawofs(ptr);
            const rom_ofs = h_rom_buffer();
            const rom_top = h_rawofs(h_rom_top());
            if (ofs < rom_top) {
                const rom_len = rom_top << 2;
                const rom = new Uint32Array(exports.memory.buffer, rom_ofs, rom_len);
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
    };
    h_write_quad = function write_quad(ptr, quad) {
        if (h_is_ram(ptr)) {
            // WARNING! The WASM memory buffer can move if it is resized.
            //          We get a fresh pointer each time for safety.
            const ram_ofs = h_ram_buffer(h_gc_phase());
            const ram_top = h_rawofs(h_ram_top());
            if (ofs < ram_top) {
                const ram_len = ram_top << 2;
                const ram = new Uint32Array(exports.memory.buffer, ram_ofs, ram_len);
                const ofs = h_rawofs(ptr);
                const idx = ofs << 2;  // convert quad address to Uint32Array index
                ram[idx + 0] = quad.t;
                ram[idx + 1] = quad.x;
                ram[idx + 2] = quad.y;
                ram[idx + 3] = quad.z;
            } else {
                return h_warning("h_write_quad: RAM ptr out of bounds "+h_print(ptr));
            }
        }
        return h_warning("h_write_quad: required RAM ptr, got "+h_print(ptr));
    };
    h_blob_mem = function blob_mem() {
        // WARNING! The WASM memory buffer can move if it is resized.
        //          We get a fresh pointer each time for safety.
        const blob_ofs = h_blob_buffer();
        const blob_len = h_fix_to_i32(h_blob_top());
        const blob = new Uint8Array(exports.memory.buffer, blob_ofs, blob_len);
        return blob;
    };

    // draw initial state
    updateRomMonitor();
    drawHost();

    //playAction();  // start animation (running)
    pauseAction();  // start animation (paused)
});
