// uFork debugger

/*jslint browser, bitwise, long, devel */

import ufork from "/www/ufork.js";
import debug_device from "/www/devices/debug_device.js";
import clock_device from "/www/devices/clock_device.js";
import io_device from "/www/devices/io_device.js";
import blob_device from "/www/devices/blob_device.js";
import timer_device from "/www/devices/timer_device.js";
//import OED from "/www/oed.js";
import parseq from "/www/parseq.js";
import lazy from "/www/requestors/lazy.js";
import requestorize from "/www/requestors/requestorize.js";

let core;  // uFork wasm processor core
let on_stdin;

function ufork_run() {
    core.h_run_loop();
    const spn = core.u_ramptr(ufork.SPONSOR_OFS);
    const sponsor = core.u_read_quad(spn);
    const sig = sponsor.z;
    if (core.u_is_fix(sig)) {
        const err = core.u_fix_to_i32(sig);
        const msg = core.u_fault_msg(err);
        console.log("IDLE", core.u_disasm(spn), "error:", err, "=", msg);
        if (err === ufork.E_OK) {
            // processor idle
            return ufork.E_OK;
        }
        if (err === ufork.E_MEM_LIM) {
            sponsor.t = core.u_fixnum(1024);
        }
        if (err === ufork.E_MSG_LIM) {
            sponsor.x = core.u_fixnum(256);
        }
        if (err === ufork.E_CPU_LIM) {
            sponsor.y = core.u_fixnum(4096);
        }
        core.u_write_quad(spn, sponsor);
        console.log("refreshed sponsor:", core.u_disasm(spn));
    }
    ufork_wake();
}
function ufork_wake() {
    setTimeout(function () {
        console.log("WAKEUP");
        ufork_run();
    }, 0);
}

//const $room = document.getElementById("room");
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
    ufork.instantiate_core(
        origin + "/target/wasm32-unknown-unknown/debug/ufork_wasm.wasm",
        ufork_wake,
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
        return ufork_run();
    })
])(console.log);
