// ucode_sim.js -- uCode machine simulator
// Dale Schumacher
// created: 2024-05-24

/*jslint bitwise */

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
            cnt = delta;  // reset after underflow
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

    function step() {  // Execute a single instruction.
        const instr = code[pc];                         // fetch current instruction
        pc += 1;                                        // increment program counter
        const tos = dstack.tos();                       // top of data stack
        const nos = dstack.nos();                       // next on data stack
        const tors = rstack.tos();                      // top of return stack
        //...
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

export default Object.freeze({
    make_machine,
});
