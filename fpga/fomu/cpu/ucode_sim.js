// ucode_sim.js -- uCode machine simulator
// Dale Schumacher
// created: 2024-05-24

/*jslint bitwise */

import ucode from "./ucode.js";

const OP_NONE =             0x0;                        // no operation
const OP_ADD =              0x1;                        // remove top
const OP_SUB =              0x2;                        // push onto top
const OP_MUL =              0x3;                        // replace top
const OP_AND =              0x4;                        // swap top and next
const OP_XOR =              0x5;                        // rotate top 3 elements
const OP_OR =               0x6;                        // reverse rotate top 3
const OP_ROL =              0x7;                        // drop 2, push 1
const OP_2ROL =             0x8;                        // no operation
const OP_4ROL =             0x9;                        // remove top
const OP_8ROL =             0xA;                        // push onto top
const OP_ASR =              0xB;                        // replace top
const OP_2ASR =             0xC;                        // swap top and next
const OP_4ASR =             0xD;                        // rotate top 3 elements
const OP_DSP =              0xE;                        // reverse rotate top 3
const OP_MEM =              0xF;                        // drop 2, push 1

const SE_NONE =             0x0;                        // no stack-effect
const SE_DROP =             0x1;                        // remove top
const SE_PUSH =             0x2;                        // push onto top
const SE_RPLC =             0x3;                        // replace top
const SE_SWAP =             0x4;                        // swap top and next
const SE_ROT3 =             0x5;                        // rotate top 3 elements
const SE_RROT =             0x6;                        // reverse rotate top 3
const SE_ALU2 =             0x7;                        // drop 2, push 1

// Create a bounded stack.

function make_stack(depth = 12) {
    let stack = Array(depth);

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
        }
    }
    function copy() {  // return a shallow copy of the stack
        return stack.slice();
    }

    let min = 0;
    let cnt = 0;
    let max = 0;

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
        return { min, cnt, max };
    }

    return {
        tos,
        nos,
        perform,
        copy,
        stats,
    };
}

// Create a virtual uCode processor.

function make_machine(prog) {
    let pc = 0;
    const dstack = make_stack();
    const rstack = make_stack();

    function error(...msg) {
        const err = {
            pc,
            dstack: dstack.copy(),
            rstack: rstack.copy(),
            error: msg.join(" ")
        };
//debug console.log("ERROR!", err);
        return err;
    }

    function step() {  // Execute a single instruction.
        const instr = prog[pc];                         // fetch current instruction
        pc += 1;                                        // increment program counter
        const tos = dstack.tos();                       // top of data stack
        const nos = dstack.nos();                       // next on data stack
        const tors = rstack.tos();                      // top of return stack

        // decode instruction
        const ctrl = (instr & 0x8000);                  // control instruction flag
        const r_pc = (instr & 0x4000);                  // R-stack <--> PC transfer flag
        const r_se = (instr & 0x3000) >> 12;            // R-stack effect (or ctrl selector)
        const d_se = (instr & 0x0700) >> 8;             // D-stack effect
        const alu_op = (instr & 0x000F);                // ALU operation

        let result = 0;                                 // ALU result (default: 0)
        if (ctrl) {
            // control instruction
            return error("control instructions not implemented");
        } else if (alu_op === OP_MEM) {
            // memory operation
            return error("memory operations not implemented");
        } else {
            // evaluation instruction
            return error("illegal instruction");
        }
    }

    return {
        step,
    };
}

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

//debug const source = `
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

export default Object.freeze({
    make_machine,
});
