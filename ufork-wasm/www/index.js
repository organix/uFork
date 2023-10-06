// uFork debugger

/*jslint browser, bitwise, long, devel */

import ufork from "./ufork.js";
import hexdump from "./hexdump.js";
import OED from "./oed.js";
import clock_device from "./devices/clock_device.js";
import random_device from "./devices/random_device.js";
import io_device from "./devices/io_device.js";
import blob_device from "./devices/blob_device.js";
import timer_device from "./devices/timer_device.js";

const $ram_max = document.getElementById("ram-max");
const $ram_top = document.getElementById("ram-top");
const $ram_next = document.getElementById("ram-next");
const $ram_free = document.getElementById("ram-free");
const $gc_root = document.getElementById("gc-root");
const $gc_state = document.getElementById("gc-state");
const $rom_top = document.getElementById("rom-top");
const $mem_pages = document.getElementById("mem-pages");
const $sponsor_ident = document.getElementById("sponsor-ident");
const $sponsor_memory = document.getElementById("sponsor-memory");
const $sponsor_events = document.getElementById("sponsor-events");
const $sponsor_cycles = document.getElementById("sponsor-cycles");
const $sponsor_signal = document.getElementById("sponsor-signal");
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
const $effect = document.getElementById("effect");
const $state = document.getElementById("state");
const $msg = document.getElementById("msg");

const $fault_ctl = document.getElementById("fault-ctl");
const $fault_led = document.getElementById("fault-led");

let paused = false;  // run/pause toggle
let fault = false;  // execution fault flag
const rx_crlf = /\n|\r\n?/;
const $rate = document.getElementById("frame-rate");
let frame = 1;  // frame-rate countdown
let ram_max = 0;
let core;  // uFork wasm processor core
let on_stdin;

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
        const line = core.u_print(ptr).padStart(9) + ": " + core.u_quad_print(quad);
        a.push(line);
        ofs += 1;
    }
    $mem_rom.textContent = a.join("\n");
}
function update_ram_monitor() {
    let a = [];
    const top = core.u_rawofs(core.h_ram_top());
    let ofs = 0;
    while (ofs < top) {
        const ptr = core.u_ramptr(ofs);
        const color = core.h_gc_color(ptr);
        const line = core.u_disasm(ptr) + " -- " + core.u_print(color);
        a.push(line);
        ofs += 1;
    }
    $mem_ram.textContent = a.join("\n");
}
function update_blob_monitor() {
    $mem_blob.textContent = hexdump(core.u_blob_mem());
}
/*
import oed from "./oed_lite.js";
function update_blob_monitor() {
    const result = oed.decode(core.u_blob_mem());
    $mem_blob.textContent = JSON.stringify(result, undefined, 2);
}
*/
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
        && sourcemap?.source !== undefined
    ) {
        $source_monitor.title = sourcemap.debug.file;
        sourcemap.source.split(rx_crlf).forEach(function (ignore, line_nr) {
            $aside.textContent += line_nr + 1 + "\n";
        });
        if (sourcemap.debug.start !== undefined) {
            const $pre_text = document.createTextNode(sourcemap.source.slice(
                0,
                sourcemap.debug.start
            ));
            const $mark = document.createElement("mark");
            $mark.textContent = sourcemap.source.slice(
                sourcemap.debug.start,
                sourcemap.debug.end
            );
            const $post_text = document.createTextNode(sourcemap.source.slice(
                sourcemap.debug.end
            ));
            $code.append($pre_text, $mark, $post_text);
            keep_centered($mark, $source_monitor);
        } else {
            $code.textContent = sourcemap.source;
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
function gc_host() {
    core.h_gc_run();
    draw_host();
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
    draw_host();
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
function render_loop() {
    //debugger;
    if (paused) {
        return;
    }
    frame -= 1;
    if (frame <= 0) {
        frame = Number($rate.value);
        if (!single_step()) {  // pause on fault signal
            pause_action();
            return;
        }
        let cc = core.u_current_continuation();
        if (cc !== undefined) {
            const instruction_quad = core.u_read_quad(cc.ip);
            const op_code = core.u_fix_to_i32(instruction_quad.x);
            if (op_code === 26) { // 'debug' op
                pause_action(); // breakpoint reached
                return;
            }
        }
    }
    requestAnimationFrame(render_loop);
}

const $gc_button = document.getElementById("gc-btn");
$gc_button.onclick = gc_host;
$gc_button.title = "Run garbage collection (g)";

const $revert_button = document.getElementById("revert-btn");
$revert_button.disabled = true;
$revert_button.onclick = function () {
    core.h_revert();  // FIXME: check `bool` result...
    draw_host();
};
$revert_button.title = "Revert actor message-event";

const $next_button = document.getElementById("next-step");
$next_button.onclick = next_step;
$next_button.title = "Next instruction for this event (n)";

const $step_button = document.getElementById("single-step");
$step_button.onclick = single_step;
$step_button.title = "Next instruction in KQ (s)";

const $pause_button = document.getElementById("play-pause");
const play_action = function () {
    $pause_button.textContent = "Pause";
    $pause_button.onclick = pause_action;
    $pause_button.title = "Pause execution (c)";
    paused = false;
    $step_button.disabled = true;
    render_loop();
};
const pause_action = function () {
    $pause_button.textContent = "Play";
    $pause_button.onclick = play_action;
    $pause_button.title = "Continue execution (c)";
    $step_button.disabled = false;
    paused = true;
    draw_host();
};

function boot(module_specifier) {
    localStorage.setItem("boot", module_specifier);
    const module_url = new URL(module_specifier, window.location.href).href;
    core.h_import(module_url)(function callback(module, reason) {
        if (module === undefined) {
            return console.error("Import failed", module_specifier, reason);
        }
        core.h_boot(module.boot);
        update_rom_monitor();
        draw_host();
    });
}

const $boot_input = document.getElementById("boot-url");
$boot_input.value = localStorage.getItem("boot") ?? "../lib/fib.asm";
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
$sponsor_memory.oninput = function () {
    const num = Number($sponsor_memory.value);
    if (Number.isSafeInteger(num) && (num >= 0)) {
        const spn = current_sponsor();
        const sponsor = core.u_read_quad(spn);
        sponsor.t = core.u_fixnum(num);
        core.u_write_quad(spn, sponsor);
        draw_host();
    }
};
$sponsor_events.oninput = function () {
    const num = Number($sponsor_events.value);
    if (Number.isSafeInteger(num) && (num >= 0)) {
        const spn = current_sponsor();
        const sponsor = core.u_read_quad(spn);
        sponsor.x = core.u_fixnum(num);
        core.u_write_quad(spn, sponsor);
        draw_host();
    }
};
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
    wasm_url: "../target/wasm32-unknown-unknown/debug/ufork_wasm.wasm",
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
    log_level: ufork.LOG_DEBUG
});

core.h_initialize()(function callback(value, reason) {
    if (value === undefined) {
        throw reason;
    }

    // install devices
    clock_device(core);
    random_device(core);
    on_stdin = io_device(core, on_stdout);
    blob_device(core);
    timer_device(core, 1);

    // draw initial state
    update_rom_monitor();
    draw_host();

    //play_action();  // start animation (running)
    pause_action();  // start animation (paused)
});
