// ucode_dbg.js -- uCode Debugger
// Dale Schumacher
// created: 2024-07-01

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
const $machine_delay = $("machine-delay");
const $machine_play = $("machine-play");
const $machine_code = $("machine-code");
const $machine_break = $("machine-break");
const $machine_dstack = $("machine-dstack");
const $machine_rstack = $("machine-rstack");
const $console_out = $("console-out");
const $console_in = $("console-in");
const $console_send = $("console-send");

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
    function inject(text) {
        input_buffer += text;
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
    return state;
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
    } else {
        // display annotated memory image
        const memh = ucode.print_memh(prog, words);
        $program_mem.value = memh;
    }

    // create simluated UART interface
    const uart = make_uart(function receive(text) {
        $console_out.value += text;
    });
    $console_send.onclick = function () {
        const send_char = (
            document.querySelector("input[name='send-char']:checked").value
        );
        uart.inject($console_in.value + send_char);
        $console_in.value = "";
    };

    // create new machine with compiled program
    const machine = ucode_sim.make_machine(prog, [uart]);
    machine.disasm = function disasm(pc) {
        return ucode.disasm(prog[pc], words);
    };
    display_machine(machine);

    // add step/play/pause controls
    let step_timer;
    function halt(error) {
        // display error and "halt"
        console.log("ERROR:", error);
        $machine_step.disabled = true;
        $machine_play.textContent = "Play";
        $machine_play.disabled = true;
    }
    function pause() {
        clearTimeout(step_timer);
        $machine_play.textContent = "Play";
        $machine_step.disabled = false;
    }
    function step() {
        const delay = Number($machine_delay.value);
        step_timer = setTimeout(function () {
            const result = machine.step();
            if (result !== undefined) {
                halt(result);
            }
            const state = display_machine(machine);
            const breakpoint = Number("0x" + $machine_break.value);
            if (Number.isSafeInteger(breakpoint) && (breakpoint === state.pc)) {
                pause();
            }
            if ($machine_play.textContent === "Pause") {
                step();
            }
        }, delay);
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


/*
function update_element_text(el, txt) {
    if (el.textContent === txt) {
        el.style.color = "#000";
    } else {
        el.style.color = "#03F";
    }
    el.textContent = txt;
}
function update_element_value(el, val) {
    const txt = String(val);
    if (el.value === txt) {
        el.style.color = "#000";
    } else {
        el.style.color = "#03F";
    }
    el.value = txt;
}
function update_rom_monitor() {
    let a = [];
    const top = core.u_rawofs(core.h_rom_top());
    let ofs = 0;
    while (ofs < top) {
        const ptr = core.u_romptr(ofs);
        const quad = core.u_read_quad(ptr);
        const line = core.u_print(ptr).padStart(9)
            + ": " + core.u_quad_print(quad);
        a.push(line);
        ofs += 1;
    }
    $mem_rom.textContent = a.join("\n");
}
function update_blob_monitor() {
    $mem_blob.textContent = hexdump(core.u_blob_mem());
}
function update_oed_monitor() {
    const result = oed.decode(core.u_blob_mem());
    $mem_blob.textContent = JSON.stringify(result, undefined, 2);
}
function keep_centered(child, parent) {
    const child_rect = child.getBoundingClientRect();
    const parent_rect = parent.getBoundingClientRect();
    const offset = parent.scrollTop + child_rect.top - parent_rect.top;
    parent.scrollTop = offset - parent_rect.height / 2 + child_rect.height / 2;
}
function update_source_monitor(ip) {
    const $aside = $source_monitor.querySelector("aside");
    const $code = $source_monitor.querySelector("code");
    $aside.innerHTML = "";
    $code.innerHTML = "";
    const sourcemap = core.u_sourcemap(ip);
    if (
        core.u_is_rom(ip)
        && ip !== ufork.UNDEF_RAW
        && sourcemap?.text !== undefined
    ) {
        $source_monitor.title = sourcemap.debug.src;
        sourcemap.text.split(rx_crlf).forEach(function (_, line_nr) {
            $aside.textContent += line_nr + 1 + "\n";
        });
        if (sourcemap.debug.start !== undefined) {
            const $pre_text = document.createTextNode(sourcemap.text.slice(
                0,
                sourcemap.debug.start
            ));
            const $mark = document.createElement("mark");
            $mark.textContent = sourcemap.text.slice(
                sourcemap.debug.start,
                sourcemap.debug.end
            );
            const $post_text = document.createTextNode(sourcemap.text.slice(
                sourcemap.debug.end
            ));
            $code.append($pre_text, $mark, $post_text);
            keep_centered($mark, $source_monitor);
        } else {
            $code.textContent = sourcemap.text;
        }
    } else {
        $code.textContent = "No source available.";
        $source_monitor.title = "";
    }
}
function enable_next() {
    if (paused) {
        const cc = core.u_current_continuation();
        if (cc) {
            const instr = core.u_read_quad(cc.ip);
            if ((instr.t === ufork.INSTR_T)
            &&  (instr.x !== ufork.VM_JUMP)
            &&  (instr.x !== ufork.VM_END)) {
                $next_button.disabled = false;
                return;
            }
        }
    }
    $next_button.disabled = true;
}
function draw_host() {
    update_blob_monitor();
    update_ram_monitor();
    const top = core.u_rawofs(core.h_ram_top());
    if (top > ram_max) {
        ram_max = top;
    }
    update_element_text($ram_max, ram_max.toString());
    const memory_quad = core.u_read_quad(core.u_ramptr(ufork.MEMORY_OFS));
    const ram_top = memory_quad.t;
    const ram_next = memory_quad.x;
    const ram_free = memory_quad.y;
    const gc_root = memory_quad.z;
    const gc_state = core.h_gc_state();
    const rom_top = core.u_rawofs(core.h_rom_top());
    update_element_text($ram_top, core.u_print(ram_top));
    update_element_text($ram_next, core.u_print(ram_next));
    update_element_text($ram_free, core.u_print(ram_free));
    update_element_text($gc_root, core.u_print(gc_root));
    update_element_text($gc_state, core.u_print(gc_state));
    update_element_text($rom_top, core.u_print(rom_top));
    update_element_text($mem_pages, core.u_mem_pages());
    const ddeque_quad = core.u_read_quad(core.u_ramptr(ufork.DDEQUE_OFS));
    const e_first = ddeque_quad.t;
    //const e_last = ddeque_quad.x;
    const k_first = ddeque_quad.y;
    //const k_last = ddeque_quad.z;
    let p;
    let a;
    if (core.u_in_mem(k_first)) {
        p = k_first;
        a = [];
        while (core.u_in_mem(p)) {
            a.push(core.u_disasm(p));  // disasm continuation
            p = core.u_next(p);
        }
        update_element_text($kqueue, a.join("\n"));
    } else {
        update_element_text($kqueue, "--");
    }
    if (core.u_in_mem(e_first)) {
        p = e_first;
        a = [];
        while (core.u_in_mem(p)) {
            a.push(core.u_disasm(p));  // disasm event
            p = core.u_next(p);
        }
        update_element_text($equeue, a.join("\n"));
    } else {
        update_element_text($equeue, "--");
    }
    const cont_quad = core.u_read_quad(k_first);
    const ip = cont_quad.t;
    const sp = cont_quad.x;
    const ep = cont_quad.y;
    if (core.u_in_mem(ip)) {
        let n = 5;
        p = ip;
        a = [];
        while ((n > 0) && core.u_in_mem(p)) {
            a.push(core.u_disasm(p));
            p = core.u_next(p);
            n -= 1;
        }
        if (core.u_in_mem(p)) {
            a.push("...");
        }
        update_element_text($instr, a.join("\n"));
    } else {
        update_element_text($instr, "--");
    }
    update_source_monitor(ip);
    if (core.u_in_mem(sp)) {
        p = sp;
        a = [];
        while (core.u_in_mem(p)) {
            //a.push(core.h_disasm(p));  // disasm stack Pair
            //a.push(core.h_print(core.h_car(p)));  // print stack item
            a.push(core.u_pprint(core.h_car(p)));  // pretty-print stack item
            p = core.h_cdr(p);
        }
        update_element_text($stack, a.join("\n"));
    } else {
        update_element_text($stack, "--");
    }
    $stack.title = core.u_disasm(sp);
    update_element_text($event, core.u_disasm(ep));
    const event_quad = core.u_read_quad(ep);
    const sponsor = event_quad.t;
    const target = event_quad.x;
    const message = event_quad.y;
    const actor = core.u_read_quad(core.u_cap_to_ptr(target));
    const effect = actor.z;
    const state = actor.y;
    update_element_text($self, core.u_disasm(target));
    //update_element_text($effect, core.h_disasm(effect));
    if (core.u_in_mem(effect)) {
        p = effect;
        a = [];
        while (core.u_in_mem(p)) {
            a.push(core.u_disasm(p));  // disasm event
            p = core.u_next(p);
        }
        update_element_text($effect, a.join("\n"));
    } else {
        update_element_text($effect, "--");
    }
    update_element_text($state, core.u_pprint(state));  // pretty-print state
    update_element_text($msg, core.u_pprint(message));  // pretty-print message
    // sponsor details
    let err = ufork.E_OK;
    let spn = core.u_ramptr(ufork.SPONSOR_OFS);
    let spn_quad = core.u_read_quad(spn);
    if (!core.u_is_fix(spn_quad.z) && core.u_is_ram(sponsor)) {
        // if no error and current continuation valid, show event sponsor...
        spn = sponsor;
        spn_quad = core.u_read_quad(spn);
        if (core.u_is_fix(spn_quad.z)) {
            // display idle (yellow) indicator
            $fault_led.setAttribute("fill", "#FF3");
            $fault_led.setAttribute("stroke", "#990");
            err = core.u_fix_to_i32(spn_quad.z);
        } else {
            // display run (green) indicator
            $fault_led.setAttribute("fill", "#0F3");
            $fault_led.setAttribute("stroke", "#090");
        }
    } else {
        // display fault (red) indicator
        $fault_led.setAttribute("fill", "#F30");
        $fault_led.setAttribute("stroke", "#900");
        err = core.u_fix_to_i32(spn_quad.z);
    }
    $fault_ctl.title = core.u_fault_msg(err);
    update_element_text($sponsor_ident, core.u_print(spn));
    update_element_value($sponsor_memory, core.u_fix_to_i32(spn_quad.t));
    update_element_value($sponsor_events, core.u_fix_to_i32(spn_quad.x));
    update_element_value($sponsor_cycles, core.u_fix_to_i32(spn_quad.y));
    update_element_text($sponsor_signal, core.u_print(spn_quad.z));
    $revert_button.disabled = !fault;
    enable_next();
}
function schedule_draw_host() {
    // Calling 'draw_host' on each instruction can introduce long delays. This
    // function is a cheaper alternative. It schedules a single draw to occur
    // right before the upcoming paint.
    cancelAnimationFrame(timer_id);
    timer_id = requestAnimationFrame(draw_host);
}
function single_step() {
    fault = false;
    const sig = core.h_run_loop(1);
    if (core.u_is_fix(sig)) {
        const err = core.u_fix_to_i32(sig);
        const msg = core.u_fault_msg(err);
        fault = true;
        console.log("single_step:", err, "=", msg);
    }
    schedule_draw_host();
    return !fault;
}
function next_step() {
    // execute next instruction for current event
    let cc = core.u_current_continuation();
    if (!cc) {
        return single_step();
    }
    let next_event = cc.ep;
    while (true) {
        if (!single_step()) {
            break;
        }
        cc = core.u_current_continuation();
        if (!cc || cc.ep === next_event) {
            break;
        }
    }
    draw_host();
    return !fault;
}

const $interval = document.getElementById("play-interval");
function render_loop() {
    //debugger;
    if (paused) {
        return;
    }
    const interval = Number($interval.value);
    const begin = Date.now();
    while (true) {
        if (!single_step()) {  // pause on fault signal
            pause_action();
            return;
        }
        const cc = core.u_current_continuation();
        if (cc !== undefined) {
            const instruction_quad = core.u_read_quad(cc.ip);
            const op_code = instruction_quad.x;
            if (op_code === ufork.VM_DEBUG) { // 'debug' op
                pause_action(); // breakpoint reached
                return;
            }
        }
        // Defer the next iteration if a non-zero interval has been specified,
        // or if the render loop is being blocked.
        const elapsed = Date.now() - begin;
        if (interval > 0 || elapsed > 20) {
            return setTimeout(render_loop, interval);
        }
    }
}

const $gc_button = document.getElementById("gc-btn");
$gc_button.onclick = gc_host;
$gc_button.title = "Run garbage collection (g)";

const $revert_button = document.getElementById("revert-btn");
function revert_action() {
    core.h_revert();  // FIXME: check `bool` result...
    draw_host();
}
$revert_button.disabled = true;
$revert_button.onclick = revert_action;
$revert_button.title = "Revert actor message-event";

const $next_button = document.getElementById("next-step");
$next_button.onclick = next_step;
$next_button.title = "Next instruction for this event (n)";

const $step_button = document.getElementById("single-step");
$step_button.onclick = single_step;
$step_button.title = "Next instruction in KQ (s)";

const $pause_button = document.getElementById("play-pause");
function play_action() {
    $pause_button.textContent = "Pause";
    $pause_button.onclick = pause_action;
    $pause_button.title = "Pause execution (c)";
    paused = false;
    $step_button.disabled = true;
    render_loop();
}
function pause_action() {
    $pause_button.textContent = "Play";
    $pause_button.onclick = play_action;
    $pause_button.title = "Continue execution (c)";
    $step_button.disabled = false;
    paused = true;
    draw_host();
}

function boot(unqualified_src, text) {
    const src = new URL(unqualified_src, window.location.href).href;
    core.h_import(src, text)(function callback(module, reason) {
        if (module === undefined) {
            return console.error("Import failed", src, reason);
        }
        core.h_boot(module.boot);
        update_rom_monitor();
        draw_host();
    });
}

const $boot_input = document.getElementById("boot-src");
$boot_input.oninput = function () {
    write_state("src", $boot_input.value || undefined);
    write_state("text", undefined);
};
const $boot_form = document.getElementById("boot-form");
$boot_form.onsubmit = function (event) {
    boot($boot_input.value);
    $boot_input.blur(); // become responsive to keybindings
    event.preventDefault();
};
const $boot_button = document.getElementById("boot");
$boot_button.title = "Boot from module (b)";

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
            play_action();
        } else {
            pause_action();
        }
    } else if (event.key === "s" && !$step_button.disabled) {
        single_step();
    } else if (event.key === "n" && !$next_button.disabled) {
        next_step();
    } else if (event.key === "b") {
        boot($boot_input.value);
    } else if (event.key === "g") {
        gc_host();
    }
};

const $snapshot_button = document.getElementById("snapshot-btn");
$snapshot_button.onclick = function download_snapshot_file() {
    const snapshot_blob = new Blob(
        [OED.encode(core.h_snapshot())],
        {type: "application/octet-stream"}
    );
    const snapshot_url = URL.createObjectURL(snapshot_blob);
    const $anchor = document.createElement("a");
    $anchor.download = "ufork_snapshot.bin";
    $anchor.href = snapshot_url;
    $anchor.click();
    URL.revokeObjectURL(snapshot_url);
};
$snapshot_button.title = "Snapshot VM state";
const $restore_input = document.getElementById("restore-btn");
$restore_input.onchange = function restore_snapshot_file() {
    $restore_input.files[0].arrayBuffer().then(function (array_buffer) {
        core.h_restore(OED.decode(new Uint8Array(array_buffer)));
        update_rom_monitor();
        draw_host();
    });
    $restore_input.value = ""; // reset
};
$restore_input.title = "Restore from snapshot";

function current_sponsor() {
    const cc = core.u_current_continuation();
    if (cc) {
        return cc.spn;
    }
    return core.u_ramptr(ufork.SPONSOR_OFS);
}
$sponsor_cycles.oninput = function () {
    const num = Number($sponsor_cycles.value);
    if (Number.isSafeInteger(num) && (num >= 0)) {
        const spn = current_sponsor();
        const sponsor = core.u_read_quad(spn);
        sponsor.y = core.u_fixnum(num);
        core.u_write_quad(spn, sponsor);
        draw_host();
    }
};

const utf8encoder = new TextEncoder();
const $stdin = document.getElementById("stdin");
const $send_button = document.getElementById("send-btn");
$send_button.onclick = function () {
    let text = $stdin.value;
    if (text.length > 0) {
        text += "\n";
        on_stdin(text);
        const utf8 = utf8encoder.encode(text);
        console.log("Send", hexdump(utf8, 0, utf8.length));
        $stdin.value = "";
    }
};
const $stdout = document.getElementById("stdout");
function on_stdout(char) {
    if ($stdout) {
        const text = $stdout.value;
        //console.log("$stdout.value =", text);
        if (typeof text === "string") {
            $stdout.value = text + char;
        }
    }
}

core = ufork.make_core({
    wasm_url,
    on_wakeup(device_offset) {
        console.log("WAKE:", device_offset);
        //single_step();
        draw_host();
    },
    on_log(level, ...args) {
        //console.log(level + ": " + args.join(" "));
        console.log(level, ...args);
    },
    on_trace(event) {
        event = core.u_event_as_object(event);
        //core.u_log_event(event, core.u_debug);
        core.u_debug(event);
        //console.log(JSON.stringify(event, undefined, 2));
    },
    log_level: ufork.LOG_DEBUG,
    import_map: (
        $importmap
        ? JSON.parse($importmap.textContent).imports
        : {}
    ),
    compilers: {asm: assemble, scm: scm.compile}
});

core.h_initialize()(function callback(value, reason) {
    if (value === undefined) {
        throw reason;
    }

    // install devices
    clock_dev(core);
    random_dev(core);
    on_stdin = io_dev(core, on_stdout);
    blob_dev(core);
    timer_dev(core, 1);

    // draw initial state
    update_rom_monitor();
    draw_host();

    //play_action();  // start animation (running)
    pause_action();  // start animation (paused)

    const src = read_state("src");
    const text_enc = read_state("text");
    $boot_input.value = src || "./examples/fib.asm";
    if (text_enc) {
        base64.decode(text_enc).then(gzip.decode).then(function (bytes) {
            const text = new TextDecoder().decode(bytes);
            boot(
                src || (
                    read_state("lang") === "scm"
                    ? "untitled.scm"
                    : "untitled.asm"
                ),
                text
            );
        });
    } else if (src) {
        boot(src);
    }
});
*/
