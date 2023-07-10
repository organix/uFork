// uFork debugger

/*jslint browser, bitwise, long, devel */

import instantiate_core from "/www/ufork.js";
import debug_device from "/www/devices/debug_device.js";
import clock_device from "/www/devices/clock_device.js";
import io_device from "/www/devices/io_device.js";
import blob_device from "/www/devices/blob_device.js";
import timer_device from "/www/devices/timer_device.js";
//import OED from "/www/oed.js";
import parseq from "/www/parseq.js";
import lazy from "/www/requestors/lazy.js";
import requestorize from "/www/requestors/requestorize.js";

let core = { UNDEF_RAW: 0 };  // uFork wasm processor core

function current_continuation() {
    const dd_quad = core.u_read_quad(core.u_ramptr(core.DDEQUE_OFS));
    const k_first = dd_quad.y;
    if (core.u_in_mem(k_first)) {
        const k_quad = core.u_read_quad(k_first);
        const e_quad = core.u_read_quad(k_quad.y);
        return {
            ip: k_quad.t,
            sp: k_quad.x,
            ep: k_quad.y,
            act: e_quad.x,
            msg: e_quad.y,
            spn: e_quad.t
        };
    }
}
function refill_quota(status) {
    if (status < 0) {
        const cc = current_continuation();
        if (cc) {
            const sponsor = core.u_read_quad(cc.spn);
            if (status === core.E_MEM_LIM) {
                sponsor.t = core.u_fixnum(1024);
            }
            if (status === core.E_MSG_LIM) {
                sponsor.x = core.u_fixnum(256);
            }
            if (status === core.E_CPU_LIM) {
                sponsor.y = core.u_fixnum(4096);
            }
            core.u_write_quad(cc.spn, sponsor);
            console.log("refilled sponsor:", core.u_disasm(cc.spn));
        }
    }
}
function ufork_idle(status) {
    console.log("IDLE", core.u_fault_msg(status));
    refill_quota(status);
    return status;
}

const $choice_tab = document.getElementById("choice");
const $room_tab = document.getElementById("room");

const $join_button = document.getElementById("join-btn");
$join_button.onclick = function () {
    $choice_tab.style.display = "none";
    $room_tab.style.display = "flex";
}
const $host_button = document.getElementById("host-btn");
$host_button.onclick = function () {
    $choice_tab.style.display = "none";
    $room_tab.style.display = "flex";
}

let stdin_buffer = "";
let stdin_stub = core.UNDEF_RAW;
function read_stdin(stub) {
    if (core.u_is_ram(stdin_stub)) {
        throw new Error("stdin_stub already set to " + core.u_pprint(stdin_stub));
    }
    stdin_stub = stub;
    poll_stdin();
}
function poll_stdin() {
    if (core.u_is_ram(stdin_stub)) {
        if (stdin_buffer.length > 0) {
            const first = stdin_buffer.slice(0, 1);
            const rest = stdin_buffer.slice(1);
            const code = first.codePointAt(0);
            const char = core.u_fixnum(code);  // character read
            stdin_buffer = rest;
            const quad = core.u_read_quad(stdin_stub);
            const event = core.u_read_quad(quad.y);
            const sponsor = event.t;
            const target = event.x;
            //const message = event.y;
            console.log(
                "READ: " + code + " = " + first
            );
            const message = core.h_reserve_ram({  // (char)
                t: core.PAIR_T,
                x: char,
                y: core.NIL_RAW,
                z: core.UNDEF_RAW
            });
            core.h_event_inject(sponsor, target, message);
            core.h_release_stub(stdin_stub);
            stdin_stub = core.UNDEF_RAW;
            core.h_wakeup(core.IO_DEV_OFS);
        }
    }
}
const textEncoder = new TextEncoder();
const utf8 = new Uint8Array(256);
const $stdin = document.getElementById("stdin");
const $send_button = document.getElementById("send-btn");
$send_button.onclick = function () {
    let text = $stdin.value;
    if (text.length) {
        text += '\n';
        stdin_buffer += text;  // append text to buffer
    }
    const encodedResults = textEncoder.encodeInto(text, utf8);
    //console.log(text, encodedResults, utf8);
    //console.log("Send", hexdump(utf8, 0, encodedResults.written));
    $stdin.value = "";
    poll_stdin();
}
const $stdout = document.getElementById("stdout");
function write_stdout(char) {
    if ($stdout) {
        const text = $stdout.value;
        //console.log("$stdout.value =", text);
        if (typeof text === "string") {
            $stdout.value = text + char;
        }
    }
}

const origin = "http://localhost:7273";
const asm_url = new URL(
    "chat.asm",
    origin + "/examples/peer_chat/"
).href;
parseq.sequence([
    instantiate_core(
        origin + "/target/wasm32-unknown-unknown/debug/ufork_wasm.wasm",
        function on_wakeup() {
            ufork_idle(core.h_run_loop());
        },
        console.log
    ),
    lazy(function (the_core) {
        core = the_core;
        return core.h_import(asm_url);
    }),
    requestorize(function (asm_module) {
        debug_device(core);
        clock_device(core);
        io_device(core, read_stdin, write_stdout);
        blob_device(core);
        timer_device(core);
        core.h_boot(asm_module.boot);
        return ufork_idle(core.h_run_loop());
    })
])(console.log);
