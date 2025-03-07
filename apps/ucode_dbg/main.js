// uCode Debugger
// Dale Schumacher
// created: 2024-07-01

/*jslint browser, bitwise, devel */

import ucode from "https://ufork.org/ucode/ucode.js";
import ucode_sim from "https://ufork.org/ucode/ucode_sim.js";
import hex from "https://ufork.org/lib/hex.js";
//import hexdump from "https://ufork.org/lib/hexdump.js";
//import OED from "https://ufork.org/lib/oed.js";
//import oed from "https://ufork.org/lib/oed_lite.js";
const ucode_href = import.meta.resolve("https://ufork.org/ucode/ucode.f");

function $(el) {
    if (typeof el === "string") {
        el = document.getElementById(el);
    }
    return el;
}
const $program_src = $("program-src");
const $program_compile = $("program-compile");
const $program_mem = $("program-mem");
const $machine_error = $("machine-error");
const $machine_pc = $("machine-pc");
const $machine_step = $("machine-step");
const $machine_delay = $("machine-delay");
const $machine_play = $("machine-play");
const $machine_code = $("machine-code");
const $machine_break = $("machine-break");
const $machine_dstack = $("machine-dstack");
const $machine_rstack = $("machine-rstack");
const $console_out = $("console-out");
const $console_in = $("console-in");
const $console_buffer = $("console-buffer");
const $console_send = $("console-send");
const $ufork_ram = $("ufork-ram");
const $ufork_rom = $("ufork-rom");

function center_program_view(row = 0) {  // center align designated row
    const view_height = $program_mem.getBoundingClientRect().height - 6;
    const line_height = view_height / $program_mem.rows;
    row += 2;  // adjust for headers, etc.
    $program_mem.scrollTop = (line_height * row) - (view_height / 2);
}

const B_FALSE = 0x0000;  // 16-bit Boolean FALSE
const B_TRUE = 0xFFFF;  // 16-bit Boolean TRUE
function uc_bool(value) {
    if (value) {
        return B_TRUE;
    }
    return B_FALSE;
}

function make_uart(receive) {
    let input_buffer = "";
    function display_buffer() {
        $console_buffer.innerText = input_buffer.split("").map(function (c) {
            return hex.from(c.codePointAt(0), 16);
        }).join(" ");
    }
    function inject(text) {
        input_buffer += text;
        display_buffer();
    }
    function rx_ready() {
        return (input_buffer.length > 0);
    }
    let code_point = 0;
    function rx_fetch() {
        if (rx_ready()) {
            code_point = input_buffer.codePointAt(0);
            input_buffer = input_buffer.slice(
                code_point <= 0xFFFF
                ? 1
                : 2
            );
            display_buffer();
        }
        return code_point;
    }

    // 8-bit UART register interface
    const TX_RDY = 0x0;  // ready to transmit
    const TX_DAT = 0x1;  // data to transmit
    const RX_RDY = 0x2;  // receive complete
    const RX_DAT = 0x3;  // data received

    function read(reg) {
        if (reg === RX_RDY) {
            return uc_bool(rx_ready());
        }
        if (reg === RX_DAT) {
            return rx_fetch();
        }
        if (reg === TX_RDY) {
            return uc_bool(B_TRUE);  // always ready...
        }
        return 0;  // infallible read
    }
    function write(reg, data) {
        if (reg === TX_DAT) {
            receive(String.fromCodePoint(data));
        }
    }

    return Object.freeze({
        read,
        write,
        TX_RDY,
        TX_DAT,
        RX_RDY,
        RX_DAT,
        inject
    });
}

function make_spif() {
    let cs = false;

    // 8-bit SPIF register interface
    const SPI_CS = 0x0;  // chip select
    const SPI_OUT = 0x1;  // data to transmit
    const SPI_RDY = 0x2;  // ready to transmit / receive complete
    const SPI_IN = 0x3;  // data received

    function read(reg) {
        if (reg === SPI_RDY) {
            return uc_bool(cs);  // ready if chip selected
        }
        return 0;  // infallible read
    }
    function write(reg, data) {
        if (reg === SPI_CS) {
            cs = (data !== 0);
        }
        // ignore unknown writes
    }

    return Object.freeze({
        read,
        write,
        SPI_CS,
        SPI_OUT,
        SPI_RDY,
        SPI_IN
    });
}

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

const memory_header = "ADDR:  T    X    Y    Z     ADDR:  T    X    Y    Z";
function no_annotation(index) {
    return (
        index < 0
        ? "- "
        : ": "
    );
}
function format_memory(mem, base = 0, annotation = no_annotation) {
    return memory_header + mem.map(function (value, index) {
        let s = "";
        if ((index & 0x1) === 0) {
            s += "\n";
        }
        s += hex.from(base + index, 16);
        s += annotation(index);
        s += hex.from(value.t, 16);
        s += " ";
        s += hex.from(value.x, 16);
        s += " ";
        s += hex.from(value.y, 16);
        s += " ";
        s += hex.from(value.z, 16);
        s += "   ";
        return s;
    }).join("");
}

function display_machine(state, prog, words) {
    // display annotated memory image
    const memh = ucode.print_memh(prog, words, state.pc);
    $program_mem.value = memh;
    center_program_view(state.pc);
    function gc_annotation(index) {
        const base = words.rsvd_rom & 0x0FFF;
        const symbol = [". ", "x ", "y ", "? "];
        const mem_top = state.qram[0].t & 0x0FFF;
        const note = (
            index < mem_top
            ? symbol[prog[base + index]]
            : "- "
        );
        return (
            typeof note === "string"
            ? note
            : ": "
        );
    }
    $machine_pc.value = hex.from(state.pc, 12);
    $machine_code.value = ucode.disasm(prog[state.pc], words);
    $machine_dstack.innerText = format_stack(state.dstack, state.dstats);
    $machine_rstack.innerText = format_stack(state.rstack, state.rstats);
    $ufork_ram.value = format_memory(state.qram, 0x4000, gc_annotation);
    $ufork_rom.value = format_memory(state.qrom, 0x0000);
}

$program_compile.onclick = function () {
    // compile source program
    const text = $program_src.value;
    const {errors, words, prog} = ucode.compile(text);
    if (errors !== undefined && errors.length > 0) {
        // report errors
        let report = "";
        errors.forEach(function (err) {
            report += "line " + err.line + ": " + err.error + "\n";
        });
        $program_mem.value = report;
        return;  // early exit
    }

    // create simluated UART interface
    $console_out.value = "";
    $console_in.value = "";
    const uart = make_uart(function receive(text) {
        $console_out.value += text;
    });
    $console_send.disabled = false;
    $console_send.onclick = function () {
        const send_char = (
            document.querySelector("input[name='send-char']:checked").value
        );
        uart.inject($console_in.value + send_char);
        $console_in.value = "";
    };

    // create new machine with compiled program
    $machine_error.textContent = "";
    $machine_break.textContent = "";
    const devs = [uart];
    devs[0xF] = make_spif();
    const machine = ucode_sim.make_machine(prog, devs);
    let state = machine.copy();
    display_machine(state, prog, words);

    // add step/play/pause controls
    let step_timer;
    function halt(result) {
        // display error and "halt"
        console.log("ERROR:", result);
        $machine_error.textContent = "ERROR: " + result.error;
        $machine_step.disabled = true;
        $machine_play.textContent = "Play";
        $machine_play.disabled = true;
        $console_send.disabled = true;
    }
    function pause() {
        clearTimeout(step_timer);
        $machine_play.textContent = "Play";
        $machine_step.disabled = false;
    }
    function step() {
        const delay = Number($machine_delay.value);
        const begin = Date.now();
        while (true) {
            const result = machine.step();
            if (result !== undefined) {
                display_machine(state, prog, words);
                halt(result);
                return;
            }
            state = machine.copy();
            const breakpoint = Number("0x" + $machine_break.value);
            if (Number.isSafeInteger(breakpoint) && (breakpoint === state.pc)) {
                pause();
                break;
            }
            if ($machine_play.textContent !== "Pause") {
                break;
            }
            // Defer the next iteration if a non-zero interval has been
            // specified, or if the frame rate drops too low.
            const elapsed = Date.now() - begin;
            if (delay > 0 || elapsed > 16) {
                step_timer = setTimeout(step, delay);
                break;
            }
        }
        display_machine(state, prog, words);
    }
    function play() {
        $machine_play.textContent = "Pause";
        $machine_step.disabled = true;
        step();
    }
    $machine_step.disabled = false;
    $machine_step.onclick = function () {
        step();
    };
    $machine_play.disabled = false;
    $machine_play.onclick = function () {
        if ($machine_play.textContent === "Pause") {
            pause();
        } else {
            play();
        }
    };
};

fetch(ucode_href).then(function (response) {
    if (response.ok) {
        response.text().then(function (text) {
            $program_src.textContent = text;
            $program_compile.onclick();
        });
    }
});
