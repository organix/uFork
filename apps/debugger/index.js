// uFork debugger

/*jslint browser, bitwise, long, devel */

import base64 from "https://ufork.org/lib/base64.js";
import gzip from "https://ufork.org/lib/gzip.js";
import unpercent from "https://ufork.org/lib/unpercent.js";
import hexdump from "https://ufork.org/lib/hexdump.js";
import OED from "https://ufork.org/lib/oed.js";
import assemble from "https://ufork.org/lib/assemble.js";
import compile_humus from "https://ufork.org/lib/humus.js";
import scm from "https://ufork.org/lib/scheme.js";
import ufork from "https://ufork.org/js/ufork.js";
import clock_dev from "https://ufork.org/js/clock_dev.js";
import random_dev from "https://ufork.org/js/random_dev.js";
import io_dev from "https://ufork.org/js/io_dev.js";
import blob_dev from "https://ufork.org/js/blob_dev.js";
import fs_dev from "https://ufork.org/js/fs_dev.js";
import tcp_dev from "https://ufork.org/js/tcp_dev.js";
import host_dev from "https://ufork.org/js/host_dev.js";
import timer_dev from "https://ufork.org/js/timer_dev.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");

const $ram_max = document.getElementById("ram-max");
const $ram_top = document.getElementById("ram-top");
const $ram_next = document.getElementById("ram-next");
const $ram_free = document.getElementById("ram-free");
const $gc_root = document.getElementById("gc-root");
const $gc_state = document.getElementById("gc-state");
const $rom_top = document.getElementById("rom-top");
const $mem_pages = document.getElementById("mem-pages");
const $mem_graph = document.getElementById("mem-graph");
const $mem_graph_used = document.getElementById("mem-graph-used");
const $mem_graph_free = document.getElementById("mem-graph-free");
const $sponsor_ident = document.getElementById("sponsor-ident");
const $sponsor_memory = document.getElementById("sponsor-memory");
const $sponsor_events = document.getElementById("sponsor-events");
const $sponsor_cycles = document.getElementById("sponsor-cycles");
const $sponsor_signal = document.getElementById("sponsor-signal");
const $equeue = document.getElementById("equeue");
const $kqueue = document.getElementById("kqueue");

const $mem_rom = document.getElementById("rom");
const $mem_ram = document.getElementById("ram");
//const $mem_blob = document.getElementById("blob");
const $source_monitor = document.getElementById("source");

const $instr = document.getElementById("instr");
const $stack = document.getElementById("stack");
const $event = document.getElementById("event");
const $self = document.getElementById("self");
const $effect = document.getElementById("effect");
const $state = document.getElementById("state");
const $msg = document.getElementById("msg");

const $gc_button = document.getElementById("gc-btn");
const $revert_button = document.getElementById("revert-btn");
const $next_button = document.getElementById("next-step");
const $step_button = document.getElementById("single-step");
const $pause_button = document.getElementById("play-pause");
const $interval = document.getElementById("play-interval");

const $fault_ctl = document.getElementById("fault-ctl");
const $fault_led = document.getElementById("fault-led");

let timer_id;
let paused = false;  // run/pause toggle
let fault = false;  // execution fault flag
const rx_crlf = /\n|\r\n?/;
let ram_max = 0;
let core;  // uFork wasm processor core
let h_on_stdin;

function memory_dump(bytes, bottom_ptr, gc_colors = []) {
    const nr_quads = Math.floor(bytes.length / 16);
    const lines = new Array(nr_quads).fill().map(function (_, quad_nr) {
        const address = ufork.print(bottom_ptr + quad_nr).padStart(9);
        const quad = ufork.read_quad(bytes, quad_nr);
        const line = address + ": " + ufork.print_quad(quad);
        if (gc_colors[quad_nr] !== undefined) {
            const color = gc_colors[quad_nr];
            return line.padEnd(64) + ufork.print_gc_color(color).toUpperCase();
        }
        return line;
    });
    return lines.join("\n");
}
function read_state(name) {
    // pluses are not spaces
    const url = new URL(location.href.replaceAll("+", "%2B"));
    if (url.searchParams.has(name)) {
        return url.searchParams.get(name);
    }
}
function write_state(name, value) {
    const url = new URL(location.href);
    if (value !== undefined) {
        url.searchParams.set(name, value);
    } else {
        url.searchParams.delete(name);
    }
    history.replaceState(undefined, "", unpercent(url));
}
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
    $mem_rom.textContent = memory_dump(
        core.h_rom(),
        ufork.romptr(0)
    );
}
function update_ram_monitor() {
    const ram_size = ufork.rawofs(core.h_ram_top());
    const gc_colors = new Array(ram_size).fill().map(function (_, ofs) {
        return core.h_gc_color(ufork.ramptr(ofs));
    });
    $mem_ram.textContent = memory_dump(
        core.h_ram(),
        ufork.ramptr(0),
        gc_colors
    );
}
/*
function update_blob_monitor() {
    $mem_blob.textContent = hexdump(core.u_blob_mem());
}

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
    const debug = core.u_rom_debugs()[ip];
    const text = core.u_module_texts()[debug?.src];
    if (
        ufork.is_rom(ip)
        && ip !== ufork.UNDEF_RAW
        && text !== undefined
    ) {
        $source_monitor.title = debug.src;
        text.split(rx_crlf).forEach(function (_, line_nr) {
            $aside.textContent += line_nr + 1 + "\n";
        });
        if (debug.start !== undefined) {
            const pre_text = text.slice(0, debug.start);
            const $mark = document.createElement("mark");
            $mark.textContent = text.slice(debug.start, debug.end);
            const post_text = text.slice(debug.end);
            $code.append(pre_text, $mark, post_text);
            keep_centered($mark, $source_monitor);
        } else {
            $code.textContent = text;
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
const mem_history = [];
function draw_mem_graph(free_cnt) {
    if (mem_history.length >= 512) {
        mem_history.shift();
    }
    mem_history.push({ free: free_cnt, max: ram_max });
    let pts = "";
    mem_history.forEach(function draw(data, index) {
        const free = 256 - (data.max >> 4);
        pts += " " + index + "," + free;
    });
    $mem_graph_free.setAttribute("points", pts);
    pts = "";
    mem_history.forEach(function draw(data, index) {
        const used = 256 - ((data.max - data.free) >> 4);
        pts += " " + index + "," + used;
    });
    $mem_graph_used.setAttribute("points", pts);
}
function draw_host() {
//    update_blob_monitor();
    update_ram_monitor();
    const top = ufork.rawofs(core.h_ram_top());
    if (top > ram_max) {
        ram_max = top;
    }
    update_element_text($ram_max, ram_max.toString());
    const memory_quad = core.u_read_quad(ufork.ramptr(ufork.MEMORY_OFS));
    const ram_top = memory_quad.t;
    const ram_next = memory_quad.x;
    const ram_free = memory_quad.y;
    const gc_root = memory_quad.z;
    const gc_state = core.h_gc_state();
    const rom_top = ufork.rawofs(core.h_rom_top());
    update_element_text($ram_top, ufork.print(ram_top));
    update_element_text($ram_next, ufork.print(ram_next));
    update_element_text($ram_free, ufork.print(ram_free));
    update_element_text($gc_root, ufork.print(gc_root));
    update_element_text($gc_state, ufork.print(gc_state));
    update_element_text($rom_top, ufork.print(rom_top));
    update_element_text($mem_pages, core.u_mem_pages());
    draw_mem_graph(ufork.rawofs(ram_free));
    const ddeque_quad = core.u_read_quad(ufork.ramptr(ufork.DDEQUE_OFS));
    const e_first = ddeque_quad.t;
    //const e_last = ddeque_quad.x;
    const k_first = ddeque_quad.y;
    //const k_last = ddeque_quad.z;
    let p;
    let a;
    if (ufork.in_mem(k_first)) {
        p = k_first;
        a = [];
        while (ufork.in_mem(p)) {
            a.push(core.u_disasm(p));  // disasm continuation
            p = core.u_next(p);
        }
        update_element_text($kqueue, a.join("\n"));
    } else {
        update_element_text($kqueue, "--");
    }
    if (ufork.in_mem(e_first)) {
        p = e_first;
        a = [];
        while (ufork.in_mem(p)) {
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
    if (ufork.in_mem(ip)) {
        let n = 5;
        p = ip;
        a = [];
        while ((n > 0) && ufork.in_mem(p)) {
            a.push(core.u_disasm(p));
            p = core.u_next(p);
            n -= 1;
        }
        if (ufork.in_mem(p)) {
            a.push("...");
        }
        update_element_text($instr, a.join("\n"));
    } else {
        update_element_text($instr, "--");
    }
    update_source_monitor(ip);
    if (ufork.in_mem(sp)) {
        p = sp;
        a = [];
        while (ufork.in_mem(p)) {
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
    const actor = core.u_read_quad(ufork.cap_to_ptr(target));
    const effect = actor.z;
    const state = actor.y;
    update_element_text($self, core.u_disasm(target));
    //update_element_text($effect, core.h_disasm(effect));
    if (ufork.in_mem(effect)) {
        p = effect;
        a = [];
        while (ufork.in_mem(p)) {
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
    let spn = ufork.ramptr(ufork.SPONSOR_OFS);
    let spn_quad = core.u_read_quad(spn);
    if (!ufork.is_fix(spn_quad.z) && ufork.is_ram(sponsor)) {
        // if no error and current continuation valid, show event sponsor...
        spn = sponsor;
        spn_quad = core.u_read_quad(spn);
        if (ufork.is_fix(spn_quad.z)) {
            // display idle (yellow) indicator
            $fault_led.setAttribute("fill", "#FF3");
            $fault_led.setAttribute("stroke", "#990");
            err = ufork.fix_to_i32(spn_quad.z);
        } else {
            // display run (green) indicator
            $fault_led.setAttribute("fill", "#0F3");
            $fault_led.setAttribute("stroke", "#090");
        }
    } else {
        // display fault (red) indicator
        $fault_led.setAttribute("fill", "#F30");
        $fault_led.setAttribute("stroke", "#900");
        err = ufork.fix_to_i32(spn_quad.z);
    }
    $fault_ctl.title = ufork.fault_msg(err);
    update_element_text($sponsor_ident, ufork.print(spn));
    update_element_value($sponsor_memory, ufork.fix_to_i32(spn_quad.t));
    update_element_value($sponsor_events, ufork.fix_to_i32(spn_quad.x));
    update_element_value($sponsor_cycles, ufork.fix_to_i32(spn_quad.y));
    update_element_text($sponsor_signal, ufork.print(spn_quad.z));
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
function gc_host() {
    core.h_gc_run();
    draw_host();
}
function single_step() {
    fault = false;
    const sig = core.h_run_loop(1);
    if (ufork.is_fix(sig)) {
        const err = ufork.fix_to_i32(sig);
        const msg = ufork.fault_msg(err);
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

function pause_action() {
    $pause_button.textContent = "Play";
    $pause_button.onclick = play_action;
    $pause_button.title = "Continue execution (c)";
    $step_button.disabled = false;
    paused = true;
    draw_host();
}
function render_loop() {
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
function play_action() {
    $pause_button.textContent = "Pause";
    $pause_button.onclick = pause_action;
    $pause_button.title = "Pause execution (c)";
    paused = false;
    $step_button.disabled = true;
    render_loop();
}

$gc_button.onclick = gc_host;
$gc_button.title = "Run garbage collection (g)";

function revert_action() {
    core.h_revert();  // FIXME: check `bool` result...
    draw_host();
}
$revert_button.disabled = true;
$revert_button.onclick = revert_action;
$revert_button.title = "Revert actor message-event";

$next_button.onclick = next_step;
$next_button.title = "Next instruction for this event (n)";

$step_button.onclick = single_step;
$step_button.title = "Next instruction in KQ (s)";

function boot(unqualified_src, text) {
    const src = new URL(unqualified_src, location.href).href;
    core.h_import(src, text)(function callback(module, reason) {
        if (module === undefined) {
            return console.error("Import failed", src, reason);
        }
        core.h_boot();
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
    return ufork.ramptr(ufork.SPONSOR_OFS);
}
$sponsor_memory.oninput = function () {
    const num = Number($sponsor_memory.value);
    if (Number.isSafeInteger(num) && (num >= 0)) {
        const spn = current_sponsor();
        const sponsor = core.u_read_quad(spn);
        sponsor.t = ufork.fixnum(num);
        core.u_write_quad(spn, sponsor);
        draw_host();
    }
};
$sponsor_events.oninput = function () {
    const num = Number($sponsor_events.value);
    if (Number.isSafeInteger(num) && (num >= 0)) {
        const spn = current_sponsor();
        const sponsor = core.u_read_quad(spn);
        sponsor.x = ufork.fixnum(num);
        core.u_write_quad(spn, sponsor);
        draw_host();
    }
};
$sponsor_cycles.oninput = function () {
    const num = Number($sponsor_cycles.value);
    if (Number.isSafeInteger(num) && (num >= 0)) {
        const spn = current_sponsor();
        const sponsor = core.u_read_quad(spn);
        sponsor.y = ufork.fixnum(num);
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
        h_on_stdin(text);
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

// Capture event data in a JS object.
function event_as_object(event) {
    const obj = Object.create(null);
    let quad = core.u_read_quad(event);
    const evt = quad;
    obj.message = core.u_pprint(evt.y);
    quad = core.u_read_quad(ufork.cap_to_ptr(evt.x));
    const prev = quad;
    obj.target = Object.create(null);
    obj.target.raw = ufork.print(evt.x);
    if (ufork.is_ram(prev.z)) {
        // actor effect
        const next = core.u_read_quad(prev.z);
        obj.target.code = ufork.print(prev.x);
        obj.target.data = core.u_pprint(prev.y);
        obj.become = Object.create(null);
        obj.become.code = core.u_pprint(next.x);
        obj.become.data = core.u_pprint(next.y);
        obj.sent = [];
        let pending = next.z;
        while (ufork.is_ram(pending)) {
            quad = core.u_read_quad(pending);
            obj.sent.push({
                target: ufork.print(quad.x),
                message: core.u_pprint(quad.y),
                sponsor: ufork.print(quad.t)
            });
            pending = pending.z;
        }
    } else {
        // device effect
        obj.target.device = ufork.print(prev.x);
        obj.target.data = core.u_pprint(prev.y);
    }
    quad = core.u_read_quad(evt.t);
    obj.sponsor = Object.create(null);
    obj.sponsor.raw = ufork.print(evt.t);
    obj.sponsor.memory = ufork.fix_to_i32(quad.t);
    obj.sponsor.events = ufork.fix_to_i32(quad.x);
    obj.sponsor.cycles = ufork.fix_to_i32(quad.y);
    obj.sponsor.signal = ufork.print(quad.z);
    return obj;
}

function log_event_object(event) {
    if (event.target.device) {
        // device effect
        console.log(event.message
            + "->"
            + event.target.raw
            + " "
            + event.target.device
            + "."
            + event.target.data
        );
    } else {
        // actor effect
        let messages = [];
        event.sent.forEach(function ({target, message}) {
            messages.push(message + "->" + target);
        });
        console.log(event.message
            + "->"
            + event.target.raw
            + " "
            + event.target.code
            + "."
            + event.target.data
            + " => "
            + event.become.code
            + "."
            + event.become.data
            + " "
            + messages.join(" ")
        );
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
        event = event_as_object(event);
        // log_event_object(event);
        core.u_trace(event);
        // console.log(JSON.stringify(event, undefined, 4));
    },
    on_audit(code, evidence, ep, kp) {
        console.error(
            "AUDIT:",
            ufork.fault_msg(ufork.fix_to_i32(code)),
            core.u_pprint(evidence),
            core.u_pprint(ep),
            core.u_pprint(kp)
        );
        //debugger;
    },
    log_level: ufork.LOG_TRACE,
    import_map: (
        location.hostname !== "ufork.org"
        ? {"https://ufork.org/lib/": lib_url}
        : {}
    ),
    compilers: {
        asm: assemble,
        hum: compile_humus,
        scm: scm.compile
    }
});

core.h_initialize()(function callback(value, reason) {
    if (value === undefined) {
        throw reason;
    }

    // install devices
    clock_dev(core);
    random_dev(core);
    h_on_stdin = io_dev(core, on_stdout);
    const make_ddev = host_dev(core);
    const the_blob_dev = blob_dev(core, make_ddev);
    tcp_dev(core, make_ddev, the_blob_dev, ["127.0.0.1:8370"]);
    fs_dev(core, make_ddev, the_blob_dev);
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
            const lang = read_state("lang") || "asm";
            boot(src || "untitled." + lang, text);
        });
    } else if (src) {
        boot(src);
    }
});
