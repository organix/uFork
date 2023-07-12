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

const utf8encoder = new TextEncoder();
const $stdout = document.getElementById("stdout");
$stdout.onclick = function () {
    const text = $stdout.value;
    const utf8 = utf8encoder.encode(text);
    const hexd = hexdump(utf8, 0, utf8.length);
    console.log(hexd);
};
function on_stdout(char) {
    if ($stdout) {
        const text = $stdout.value;
        //console.log("$stdout.value =", text);
        if (typeof text === "string") {
            $stdout.value = text + char;
        }
    }
}

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
