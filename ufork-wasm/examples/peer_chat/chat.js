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

let core = {UNDEF_RAW: 0};  // uFork wasm processor core
let on_stdin;

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
};
const $host_button = document.getElementById("host-btn");
$host_button.onclick = function () {
    $choice_tab.style.display = "none";
    $room_tab.style.display = "flex";
};

const $stdin = document.getElementById("stdin");
const $send_button = document.getElementById("send-btn");
$send_button.onclick = function () {
    let text = $stdin.value;
    if (text.length > 0) {
        text += "\n";
        on_stdin(text);
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

const origin = "http://localhost:7273";
const asm_url = new URL("/examples/peer_chat/chat.asm", origin).href;
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
        on_stdin = io_device(core, on_stdout);
        blob_device(core);
        timer_device(core);
        core.h_boot(asm_module.boot);
        return ufork_idle(core.h_run_loop());
    })
])(console.log);
