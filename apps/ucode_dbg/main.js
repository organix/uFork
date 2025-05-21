// uCode Debugger
// Dale Schumacher
// created: 2024-07-01

/*jslint browser, bitwise, global */

import base64 from "https://ufork.org/lib/base64.js";
import hex from "https://ufork.org/lib/hex.js";
import gzip from "https://ufork.org/lib/gzip.js";
import ucode from "https://ufork.org/ucode/ucode.js";
import ucode_sim from "https://ufork.org/ucode/ucode_sim.js";
const ucode_href = import.meta.resolve("https://ufork.org/ucode/ucode.f");

function $(el) {
    if (typeof el === "string") {
        el = document.getElementById(el);
    }
    return el;
}
const $program_src = $("program-src");
const $program_compile = $("program-compile");
const $program_error = $("program-error");
const $program_mem = $("program-mem");
const $machine_error = $("machine-error");
const $machine_pc = $("machine-pc");
const $machine_step = $("machine-step");
const $machine_delay = $("machine-delay");
const $machine_play = $("machine-play");
const $machine_code = $("machine-code");
const $machine_break = $("machine-break");
const $machine_pc_history = $("machine-pc-history");
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

function display_machine(state, prog, words, pc_history) {
    // display annotated memory image
    const memh = ucode.print_memh(prog, words, state.pc);
    $program_mem.value = memh;
    center_program_view(state.pc);
    function gc_annotation(index) {
        const symbol = [". ", "x ", "y ", "? "];
        const mem_top = state.qram[0].t & 0x0FFF;
        const note = (
            index < mem_top
            ? symbol[state.gcc[index]]
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
    $machine_pc_history.innerText = "";
    pc_history.forEach(function (pc) {
        if (pc !== undefined) {
            const button = document.createElement("button");
            button.onclick = function () {
                center_program_view(pc);
            };
            button.textContent = hex.from(pc, 12);
            $machine_pc_history.append(button);
        }
    });
    $machine_dstack.innerText = format_stack(state.dstack, state.dstats);
    $machine_rstack.innerText = format_stack(state.rstack, state.rstats);
    $ufork_ram.value = format_memory(state.qram, 0x4000, gc_annotation);
    $ufork_rom.value = format_memory(state.qrom, 0x0000);
}

function format_error(err) {
    return "line " + err.line + ": " + err.error;
}

$program_compile.onclick = function () {
    // compile source program
    const text = $program_src.value;
    const {errors, warnings, words, prog} = ucode.compile(text);
    if (errors !== undefined && errors.length > 0) {
        // report errors
        $program_error.textContent = errors.map(format_error).join("\n");
        $program_error.style.color = "#F30";
        return;  // early exit
    }
    $program_error.textContent = warnings.map(format_error).join("\n");
    $program_error.style.color = "#F90";

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
    let pc_history = [];
    // add step/play/pause controls
    let step_timer;
    function halt(result) {
        // display error and "halt"
        if (result !== undefined) {
            globalThis.console.log("ERROR:", result);
            $machine_error.textContent = "ERROR: " + result.error;
        } else {
            $machine_error.textContent = "Breakpoint hit.";
        }
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
            pc_history.unshift(state.pc);
            pc_history = pc_history.slice(0, 100);
            const result = machine.step();
            if (
                result !== undefined
                || prog[state.pc] === 0x00F0  // DEBUG
            ) {
                display_machine(state, prog, words, pc_history);
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
        display_machine(state, prog, words, pc_history);
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
    display_machine(state, prog, words, pc_history);
};

function forth_dump16(bytes) {
    const nr_quads = bytes.byteLength >> 3;
    let data_view = new DataView(bytes.buffer);
    return Array.from({length: nr_quads}, function (_, quad_nr) {
        const quad_addr = quad_nr << 3;
        return Array.from({length: 4}, function (_, cell_nr) {
            const cell_addr = quad_addr + (cell_nr << 1);
            const cell = data_view.getUint16(cell_addr, false);
            return "0x" + hex.from(cell, 16) + " , ";
        }).join("");
    }).join("\n");
}

const url = new URL(location.href);
Promise.all([
    fetch(ucode_href).then(function (response) {
        return response.text();
    }),
    (
        url.searchParams.has("rom16")
        ? base64.decode(url.searchParams.get("rom16")).then(gzip.decode)
        : undefined
    )
]).then(function ([text, rom16]) {
    if (rom16 !== undefined) {
        // Patch the uCode by replacing the ROM image with the one provided in
        // the query string.
        const lines = text.split("\n");
        const from = lines.findIndex(function (line) {
            return line.startsWith(": boot_rom");
        });
        const to = lines.findIndex(function (line) {
            return line.includes("CONSTANT rom_quads");
        });
        if (from < 0 || to < 0) {
            throw new Error("Failed to patch uCode.");
        }
        const nr_quads = rom16.byteLength >> 3;
        text = [
            ...lines.slice(0, from + 1),
            forth_dump16(rom16.slice(1 << 7)),  // skip reserved ROM
            lines[to].replace(/\d+/, nr_quads),
            ...lines.slice(to + 1)
        ].join("\n");
    }
    $program_src.textContent = text;
    $program_compile.onclick();
});
