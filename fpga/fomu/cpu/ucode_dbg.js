// uCode Debugger

/*jslint browser, bitwise, devel */

import ucode from "./ucode.js";
import ucode_sim from "./ucode_sim.js";
import hex from "https://ufork.org/lib/hex.js";
//import hexdump from "https://ufork.org/lib/hexdump.js";
//import OED from "https://ufork.org/lib/oed.js";
//import oed from "https://ufork.org/lib/oed_lite.js";

//const $importmap = document.querySelector("script[type=importmap]");

function $(el) {
    if (typeof el === "string") {
        el = document.getElementById(el);
    }
    return el;
}
const $program_src = $("program-src");
const $program_compile = $("program-compile");
const $program_mem = $("program-mem");
const $machine_pc = $("machine-pc");
const $machine_step = $("machine-step");
const $machine_code = $("machine-code");
const $machine_dstack = $("machine-dstack");
const $machine_rstack = $("machine-rstack");
const $console_out = $("console-out");
const $console_in = $("console-in");
const $console_send = $("console-send");

let machine;  // uCode virtual machine

function format_stack(stack, stats) {
    let s = "";
    if (typeof stats === "object") {
        s += "[";
        s += stats.min;
        s += ",";
        s += stats.cnt;
        s += ",";
        s += stats.max;
        s += "] ";
    }
    s += stack.slice(0, stats.cnt).map(function (value) {
        return hex.from(value, 16);
    }).reverse().join(" ");
    return s;
}

function display_machine(machine) {
    const state = machine.copy();
//    console.log("machine_state:", state);
    $machine_pc.value = hex.from(state.pc, 12);
    $machine_code.value = machine.disasm(state.pc);
    $machine_dstack.innerText = format_stack(state.dstack, state.dstats);
    $machine_rstack.innerText = format_stack(state.rstack, state.rstats);
}

$program_compile.onclick = function () {
    const text = $program_src.value;
    const {errors, words, prog} = ucode.compile(text);
    if (errors !== undefined && errors.length > 0) {
        // report errors
        let report = "";
        errors.forEach(function (err) {
            report += "line " + err.line + ": " + err.error + "\n";
        });
        $program_mem.value = report;
    } else {
        // display annotated memory image
        const memh = ucode.print_memh(prog, words);
        $program_mem.value = memh;
    }
    // create new machine with compiled program
    machine = ucode_sim.make_machine(prog);
    machine.disasm = function disasm(pc) {
        return ucode.disasm(prog[pc], words);
    };
    display_machine(machine);
};

$machine_step.onclick = function () {
    const result = machine.step();
    if (result !== undefined) {
        console.log("ERROR:", result);  // FIXME: display error and "halt"
    }
    display_machine(machine);
};

$console_send.onclick = function () {
    const send_char = (
        document.querySelector("input[name='send-char']:checked").value
    );
    const text = $console_in.value + send_char;
    $console_out.value += text;
    $console_in.value = "";
};
