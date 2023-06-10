// uFork debugger

/*jslint browser, bitwise, long, devel */

import instantiate_core from "./ufork.js";
import OED from "./oed.js";
import debug_device from "./devices/debug_device.js";
import clock_device from "./devices/clock_device.js";
import io_device from "./devices/io_device.js";
import blob_device from "./devices/blob_device.js";
import timer_device from "./devices/timer_device.js";
import awp_device from "./devices/awp_device.js";

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
    };
    let out = "";
    while (ofs < len) {
        let str = "";
        out += ofs.toString(16).padStart(4, "0") + ":";
        let cnt = 0;
        while (cnt < 16) {
            out += (
                (cnt & 0x3) === 0
                ? "  "
                : " "
            );
            const idx = ofs + cnt;
            if (idx < len) {
                const code = u8buf[idx];
                out += code.toString(16).padStart(2, "0");
                str += String.fromCodePoint(xlt(code));
            } else {
                out += "  ";
                str += " ";
            }
            cnt += 1;
        }
        out += "  " + str + "\n";
        ofs += 16;
    }
    return out;
}

const $ram_max = document.getElementById("ram-max");
const $ram_top = document.getElementById("ram-top");
const $ram_next = document.getElementById("ram-next");
const $ram_free = document.getElementById("ram-free");
const $gc_root = document.getElementById("gc-root");
const $gc_state = document.getElementById("gc-state");
const $rom_top = document.getElementById("rom-top");
const $mem_pages = document.getElementById("mem-pages");
const $sponsor_memory = document.getElementById("sponsor-memory");
const $sponsor_events = document.getElementById("sponsor-events");
const $sponsor_instrs = document.getElementById("sponsor-instrs");
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
const $rate = document.getElementById("frame-rate");
let frame = 1;  // frame-rate countdown
let ram_max = 0;
let core;

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
function keep_centered(child, parent) {
    const child_rect = child.getBoundingClientRect();
    const parent_rect = parent.getBoundingClientRect();
    const offset = parent.scrollTop + child_rect.top - parent_rect.top;
    parent.scrollTop = offset - parent_rect.height / 2 + child_rect.height / 2;
}
function update_source_monitor(ip) {
    const sourcemap = core.u_sourcemap(ip);
    if (core.u_is_rom(ip) && ip !== core.UNDEF_RAW && sourcemap !== undefined) {
        if (sourcemap.source !== undefined) {
            $source_monitor.href = sourcemap.debug.file;
            $source_monitor.innerHTML = "";
            let highlighted;
            sourcemap.source.split(/\n|\r\n?/).forEach(function (line, line_nr) {
                const line_element = document.createElement("span");
                line_element.textContent = (
                    String(line_nr + 1).padStart(4, " ") + "  " + line
                );
                if (sourcemap.debug.line === line_nr + 1) {
                    line_element.className = "highlighted";
                    highlighted = line_element;
                }
                $source_monitor.append(line_element);
            });
            if (highlighted !== undefined) {
                keep_centered(highlighted, $source_monitor);
            }
            return;
        }
    }
    $source_monitor.textContent = "No source available.";
    delete $source_monitor.href;
}
function current_continuation() {
    const ddeque_quad = core.u_read_quad(core.u_ramptr(core.DDEQUE_OFS));
    const k_first = ddeque_quad.y;
    if (core.u_in_mem(k_first)) {
        const cont_quad = core.u_read_quad(k_first);
        return {
            ip: cont_quad.t,
            sp: cont_quad.x,
            ep: cont_quad.y
        };
    }
}
function enable_next() {
    if (paused) {
        const cc = current_continuation();
        if (cc) {
            const instr = core.u_read_quad(cc.ip);
            if ((instr.t === core.INSTR_T) && (instr.x !== core.VM_END)) {
                $next_button.disabled = false;
                return;
            }
        }
    }
    $next_button.disabled = true;
}
function draw_host() {
    $revert_button.disabled = !fault;
    if (fault) {
        $fault_led.setAttribute("fill", "#F30");
        $fault_led.setAttribute("stroke", "#900");
    } else {
        $fault_led.setAttribute("fill", "#0F3");
        $fault_led.setAttribute("stroke", "#090");
    }
    update_blob_monitor();
    update_ram_monitor();
    const top = core.u_rawofs(core.h_ram_top());
    if (top > ram_max) {
        ram_max = top;
    }
    update_element_text($ram_max, ram_max.toString());
    const memory_quad = core.u_read_quad(core.u_ramptr(core.MEMORY_OFS));
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
    const ddeque_quad = core.u_read_quad(core.u_ramptr(core.DDEQUE_OFS));
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
    const sponsor_quad = core.u_read_quad(sponsor);
    update_element_value($sponsor_memory, core.u_fix_to_i32(sponsor_quad.t));
    update_element_value($sponsor_events, core.u_fix_to_i32(sponsor_quad.x));
    update_element_value($sponsor_instrs, core.u_fix_to_i32(sponsor_quad.y));
    enable_next();
}
function gc_host() {
    core.h_gc_run();
    draw_host();
}
function single_step() {
    const err = core.h_step();
    $fault_ctl.title = core.u_fault_msg(err);
    if (err === 0) {  // 0 = E_OK = no error
        fault = false;
    } else {
        fault = true;
        console.log("single_step: error = ", err);
    }
    draw_host();
    return !fault;
}
function next_step() {
    // execute next instruction for current event
    let cc = current_continuation();
    if (!cc) {
        return single_step();
    }
    let next_event = cc.ep;
    while (true) {
        const err = core.h_step();
        $fault_ctl.title = core.u_fault_msg(err);
        if (err === 0) {  // 0 = E_OK = no error
            fault = false;
        } else {
            fault = true;
            console.log("next_step: error = ", err);
            break;
        }
        cc = current_continuation();
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
    core.h_import(module_url).then(function (module) {
        core.h_boot(module.boot);
        update_rom_monitor();
        draw_host();
    });
}

const $boot_input = document.getElementById("boot-url");
$boot_input.value = localStorage.getItem("boot") ?? "../lib/test.asm";
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

$sponsor_memory.oninput = function () {
    const num = Number($sponsor_memory.value);
    if (Number.isSafeInteger(num) && (num >= 0)) {
        const cc = current_continuation();
        if (cc) {
            const event = core.u_read_quad(cc.ep);
            const sponsor = core.u_read_quad(event.t);
            sponsor.t = core.u_fixnum(num);
            core.u_write_quad(event.t, sponsor);
            draw_host();
        }
    }
};
$sponsor_events.oninput = function () {
    const num = Number($sponsor_events.value);
    if (Number.isSafeInteger(num) && (num >= 0)) {
        const cc = current_continuation();
        if (cc) {
            const event = core.u_read_quad(cc.ep);
            const sponsor = core.u_read_quad(event.t);
            sponsor.x = core.u_fixnum(num);
            core.u_write_quad(event.t, sponsor);
            draw_host();
        }
    }
};
$sponsor_instrs.oninput = function () {
    const num = Number($sponsor_instrs.value);
    if (Number.isSafeInteger(num) && (num >= 0)) {
        const cc = current_continuation();
        if (cc) {
            const event = core.u_read_quad(cc.ep);
            const sponsor = core.u_read_quad(event.t);
            sponsor.y = core.u_fixnum(num);
            core.u_write_quad(event.t, sponsor);
            draw_host();
        }
    }
};

instantiate_core(
    "../target/wasm32-unknown-unknown/debug/ufork_wasm.wasm",
    console.log
).then(function (the_core) {
    core = the_core;

    // install devices
    debug_device(core);
    clock_device(core);
    io_device(core);
    blob_device(core);
    timer_device(core, single_step);
    awp_device(core, single_step);

    // draw initial state
    update_rom_monitor();
    draw_host();

    //play_action();  // start animation (running)
    pause_action();  // start animation (paused)
});
