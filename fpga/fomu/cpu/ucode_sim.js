// ucode_sim.js -- uCode machine simulator
// Dale Schumacher
// created: 2024-05-24

/*jslint bitwise, long */

import hex from "https://ufork.org/lib/hex.js";

const OP_NONE = 0x0;  // a
const OP_ADD = 0x1;  // a+b
const OP_SUB = 0x2;  // a-b
const OP_MUL = 0x3;  // a*b
const OP_AND = 0x4;  // a&b
const OP_XOR = 0x5;  // a^b
const OP_OR = 0x6;  // a|b
const OP_ROL = 0x7;  // {a[14:0],a[15]}
const OP_2ROL = 0x8;  // {a[13:0],a[15:14]}
const OP_4ROL = 0x9;  // {a[11:0],a[15:12]}
const OP_8ROL = 0xA;  // {a[7:0],a[15:8]}
const OP_ASR = 0xB;  // {a[15],a[15:1]}
const OP_2ASR = 0xC;  // {a[15],a[15],a[15:2]}
const OP_4ASR = 0xD;  // {a[15],a[15],a[15],a[15],a[15:4]}
//const OP_DSP = 0xE;  // RESERVED (default: 0)
const OP_MEM = 0xF;  // memory operation

//const SE_NONE = 0x0;  // no stack-effect
const SE_DROP = 0x1;  // remove top
const SE_PUSH = 0x2;  // push onto top
const SE_RPLC = 0x3;  // replace top
const SE_SWAP = 0x4;  // swap top and next
const SE_ROT3 = 0x5;  // rotate top 3 elements
const SE_RROT = 0x6;  // reverse rotate top 3
const SE_ALU2 = 0x7;  // drop 2, push 1

const MEM_UC = 0x0;  // uCode memory
const MEM_PC = 0x1;  // contents of PC+1 & increment
//const MEM_ERR = 0x2;  // RESERVED (signals failure)
const MEM_DEV = 0x3;  // memory-mapped devices
const MEM_Q_T = 0x4;  // uFork quad-memory field T
//const MEM_Q_X = 0x5;  // uFork quad-memory field X
//const MEM_Q_Y = 0x6;  // uFork quad-memory field Y
//const MEM_Q_Z = 0x7;  // uFork quad-memory field Z

// Create a bounded stack.

function make_stack(depth = 12) {
    let stack = new Array(depth);
    let min = 0;
    let cnt = 0;
    let max = 0;

    function copy() {  // return a shallow copy of the stack (for debugging)
        return stack.slice();
    }
    function adjust(delta) {  // adjust usage statistics
        if (cnt < 0 && delta > 0) {
            cnt = delta;  // reset after underflow (FIXME: what about underflow?)
        } else {
            cnt += delta;
        }
        if (cnt < min) {
            min = cnt;
        }
        if (cnt > max) {
            max = cnt;
        }
    }
    function stats() {  // return stack usage statistics
        return {min, cnt, max};
    }
    function tos() {  // top of stack
        return stack[0];
    }
    function nos() {  // next on stack
        return stack[1];
    }
    function perform(se, data = 0) {  // perform stack-effect (default: SE_NONE)
        if (se === SE_DROP) {
            stack = [...stack.slice(1), ...stack.slice(-1)];
            adjust(-1);
        } else if (se === SE_PUSH) {
            stack = [data, ...stack.slice(0, -1)];
            adjust(1);
        } else if (se === SE_RPLC) {
            stack[0] = data;
        } else if (se === SE_SWAP) {
            data = stack[0];
            stack[0] = stack[1];
            stack[1] = data;
        } else if (se === SE_ROT3) {
            data = stack[2];
            stack[2] = stack[1];
            stack[1] = stack[0];
            stack[0] = data;
        } else if (se === SE_RROT) {
            data = stack[0];
            stack[0] = stack[1];
            stack[1] = stack[2];
            stack[2] = data;
        } else if (se === SE_ALU2) {
            stack = [data, ...stack.slice(2), ...stack.slice(-1)];
            adjust(-1);
        }
    }

    return {
        tos,
        nos,
        perform,
        copy,
        stats
    };
}

// Create a virtual uCode processor.

function make_machine(prog = [], device = []) {
    let pc = 0;
    const dstack = make_stack();
    const rstack = make_stack();
    const qram = new Array(1 << 12).fill(0).map(function (n) {
        return {t: n, x: n, y: n, z: n};
    });
    const qrom = new Array(1 << 13).fill(0).map(function (n) {
        return {t: n, x: n, y: n, z: n};
    });

    function copy() {  // return a shallow copy of the machine state (for debugging)
        const state = {
            dstack: dstack.copy(),
            dstats: dstack.stats(),
            rstack: rstack.copy(),
            rstats: rstack.stats(),
            qram,           // FIXME: can we make a cheap read-only view?
            qrom,           // FIXME: can we make a cheap read-only view?
            pc
        };
        return state;
    }
    function error(...msg) {
        const err = {
            next_pc: pc,
            dstack: dstack.copy(),
            rstack: rstack.copy(),
            error: msg.join(" ")
        };
//debug console.log("ERROR!", err);
        return err;
    }

    // FIXME: warning() should be a machine option
    function warning(...msg) {
        const err = msg.join(" ");
//debug console.log("WARNING!", err);
        return err;
    }

    function alu_perform(op, a, b) {
//debug console.log("alu_perform:", "op=", op, "a=", a, "b=", b);
        if (op === OP_NONE) {
            return a;
        }
        if (op === OP_ADD) {
            return (a + b);
        }
        if (op === OP_SUB) {
            return (a - b);
        }
        if (op === OP_MUL) {
            return (a * b);
        }
        if (op === OP_AND) {
            return (a & b);
        }
        if (op === OP_XOR) {
            return (a ^ b);
        }
        if (op === OP_OR) {
            return (a | b);
        }
        if (op === OP_ROL) {
            return (a << 1) | (a >> 15);
        }
        if (op === OP_2ROL) {
            return (a << 2) | (a >> 14);
        }
        if (op === OP_4ROL) {
            return (a << 4) | (a >> 12);
        }
        if (op === OP_8ROL) {
            return (a << 8) | (a >> 8);
        }
        const msb = a & 0x8000;
        if (op === OP_ASR) {
            return (a >> 1) | msb;
        }
        if (op === OP_2ASR) {
            return (a >> 2) | msb | (msb >> 1);
        }
        if (op === OP_4ASR) {
            return (a >> 4) | msb | (msb >> 1) | (msb >> 2) | (msb >> 3);
        }
        return 0;
    }

    function mem_perform(range, wr_en, addr, data) {
//debug console.log("mem_perform:", "range=", range, "wr_en=", wr_en, "addr=", addr, "data=", data);
        if (range === MEM_UC) {
            if (wr_en) {
                prog[addr] = data;
            }
            return prog[addr];
        }
        if (range === MEM_PC) {
            return prog[pc];  // writes ignored
        }
        if (range === MEM_DEV) {
            const id = (addr & 0xF0) >> 4;
            const reg = (addr & 0x0F);
            const dev = device[id];
//debug console.log("mem_perform MEM_DEV:", "id=", id, "reg=", reg, "dev=", dev);
            if (typeof dev === "object") {
                if (wr_en) {
                    dev.write(reg, data);
                } else {
                    data = dev.read(reg);
                }
                return data;
            }
            return error("unknown device.", "id:", id, "reg:", reg);
        }
        if ((range & MEM_Q_T) !== 0) {
            const quad = (
                ((addr & 0xC000) === 0x4000)
                ? qram[addr & 0x0FFF]
                : (
                    ((addr & 0xC000) === 0x0000)
                    ? qrom[addr & 0x1FFF]
                    : {t: 0, x: 0, y: 0, z: 0}
                )
            );
            const field_names = ["t", "x", "y", "z"];
            const field = field_names[range & 0x3];
//debug console.log("mem_perform MEM_QUAD:", "range=", "0x" + hex.from(range, 3), "addr=", "0x" + hex.from(addr, 16), "quad=", quad, "field=", field);
            if (wr_en) {
                quad[field] = data;
            }
            return quad[field];
        }
        return error("illegal memory operation.", "range:", range, "addr:", addr);
    }

    function step() {  // Execute a single instruction.
        const tos = dstack.tos();                       // top of data stack
        const nos = dstack.nos();                       // next on data stack
        const tors = rstack.tos();                      // top of return stack
//debug console.log("step:", "pc=", pc, "tos=", tos, "nos=", nos, "tors=", tors);
        const instr = prog[pc];                         // fetch current instruction
        if (typeof instr !== "number") {
            return error("program address", pc, "out of range!");
        }
        pc += 1;                                        // increment program counter

        // decode instruction
        const ctrl = (instr & 0x8000);                  // control instruction flag
        const r_pc = (instr & 0x4000);                  // R-stack <--> PC transfer flag
        const r_se = (instr & 0x3000) >> 12;            // R-stack effect (or ctrl selector)
        const d_se = (instr & 0x0700) >> 8;             // D-stack effect
        const sel_a = (instr & 0x00C0) >> 6;            // ALU A selector
        const sel_b = (instr & 0x0030) >> 4;            // ALU B selector
        const alu_op = (instr & 0x000F);                // ALU operation

        // execute instruction
        let result = 0;                                 // ALU result (default: 0)
        if (ctrl) {
            // control instruction
            const addr = (instr & 0x0FFF);
//debug console.log("step ctrl:", "pc=", pc, "r_pc=", r_pc, "r_se=", r_se, "addr=", addr);
            if (r_pc) {
                rstack.perform(SE_PUSH, pc);
            }
            if (r_se === 0x0) {  // unconditional jump/call
                pc = addr;
            } else if (r_se === 0x1) {  // jump/call, if zero
                if (tos === 0) {
                    pc = addr;
                }
                dstack.perform(SE_DROP);
            } else if (!r_pc && (r_se & 0x2)) {  // branch and increment/decrement, if not zero
                if (tors === 0) {
                    rstack.perform(SE_DROP);
                } else {
                    pc = addr;
                    const data = (
                        r_se & 0x1
                        ? tors - 1
                        : tors + 1
                    );
                    rstack.perform(SE_RPLC, data);
                }
            } else {
                return error("illegal control instruction");
            }
        } else {
            if (alu_op === OP_MEM) {
                // memory operation
                const wr_en = (instr & 0x0080);             // {0:read, 1:write}
                const d_drop = (instr & 0x0800) >> 4;       // 2DROP flag **deprecated**
                if (d_drop !== wr_en) {
                    warning(
                        "W/R does not match 2DROP.",
                        "next_pc=",
                        pc,
                        "instr=",
                        "0x" + hex.from(instr, 16)
                    );
                }
                const range = (instr & 0x0070) >> 4;        // memory range
                result = mem_perform(range, wr_en, tos, nos);
//debug console.log(result, "=", "mem_perform()");
                if (typeof result !== "number") {
                    return result;                          // propagate error
                }
                if (range === MEM_PC) {
                    pc += 1;                                // extra increment past data
                }
                if (wr_en) {
                    dstack.perform(SE_DROP);                // extra drop on memory write (2DROP)
                }
            } else {
                // evaluation instruction
                const src_a = [tos, nos, tors, 0x0000];
                const alu_a = src_a[sel_a & 0x3];
                const src_b = [tos, 0x0001, 0x8000, 0xFFFF];
                const alu_b = src_b[sel_b & 0x3];
                result = alu_perform(alu_op, alu_a, alu_b) & 0xFFFF;
//debug console.log(result, "=", "alu_perform()");
            }
            // stack operations
//debug console.log("step stack:", "r_pc=", r_pc, "d_se=", d_se, "r_se=", r_se, "result=", result);
            if (r_pc) {
                pc = tors & 0x0FFF;
            }
            dstack.perform(d_se, result);
            rstack.perform(r_se, result);
        }
    }

    return {step, copy};
}

//debug import ucode from "./ucode.js";
// const s = make_stack();
//debug const s = make_stack(4);
//debug console.log(s.tos(), s.nos(), s.copy());
//debug console.log(s.stats());
//debug s.perform(SE_DROP);
//debug console.log(s.tos(), s.nos(), s.copy());
//debug s.perform(SE_PUSH, 123);
//debug console.log(s.tos(), s.nos(), s.copy());
//debug s.perform(SE_PUSH, 45);
//debug console.log(s.tos(), s.nos(), s.copy());
//debug s.perform(SE_PUSH, 6);
//debug console.log(s.tos(), s.nos(), s.copy());
//debug s.perform(SE_DROP);
//debug console.log(s.tos(), s.nos(), s.copy());
//debug s.perform(SE_PUSH, 78);
//debug console.log(s.tos(), s.nos(), s.copy());
//debug s.perform(SE_PUSH, 9);
//debug console.log(s.tos(), s.nos(), s.copy());
//debug s.perform(SE_PUSH, 10);
//debug console.log(s.tos(), s.nos(), s.copy());
//debug s.perform(SE_DROP);
//debug console.log(s.tos(), s.nos(), s.copy());
//debug s.perform(SE_DROP);
//debug console.log(s.tos(), s.nos(), s.copy());
//debug console.log(s.stats());

//debug const source = String.raw`
//debug : PANIC! FAIL PANIC! ;      ( if BOOT returns... )
//debug
//debug 0x03 CONSTANT ^C
//debug 0x0A CONSTANT '\n'
//debug 0x0D CONSTANT '\r'
//debug 0x20 CONSTANT BL
//debug
//debug : = ( a b -- a==b )
//debug     XOR
//debug : 0= ( n -- n==0 )
//debug : NOT ( flag -- !flag )
//debug     IF FALSE ELSE TRUE THEN ;
//debug
//debug : TX? ( -- ready )
//debug : EMIT?
//debug     0x00 IO@ ;
//debug : EMIT ( char -- )
//debug     BEGIN TX? UNTIL
//debug : TX! ( char -- )
//debug     0x01 IO! ;
//debug : RX? ( -- ready )
//debug : KEY?
//debug     0x02 IO@ ;
//debug : KEY ( -- char )
//debug     BEGIN RX? UNTIL
//debug : RX@ ( -- char )
//debug     0x03 IO@ ;
//debug : ECHO ( char -- )
//debug     DUP EMIT
//debug     '\r' = IF
//debug         '\n' EMIT
//debug     THEN ;
//debug
//debug : ECHOLOOP
//debug     KEY DUP ECHO
//debug     ^C = IF EXIT THEN       ( abort! )
//debug     ECHOLOOP ;
//debug
//debug ( WARNING! if BOOT returns we PANIC! )
//debug : BOOT
//debug     ECHOLOOP EXIT
//debug `;
//debug const {errors, words, prog} = ucode.compile(source);
//debug if (errors !== undefined && errors.length > 0) {
//debug     console.log(errors);
//debug } else {
//debug     const memh = ucode.print_memh(prog, words);
//debug     console.log(memh);
//debug     const mach = make_machine(prog);
//debug     let rv;
//debug     while (rv === undefined) {
//debug         rv = mach.step();
//debug     }
//      console.log("rv:", rv);
//debug }

export default Object.freeze({make_machine});
