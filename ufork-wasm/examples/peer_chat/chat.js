// uFork debugger

/*jslint browser, bitwise, long, devel */

import ufork from "../../www/ufork.js";
import hex from "../../www/hex.js";
import hexdump from "../../www/hexdump.js";
import clock_device from "../../www/devices/clock_device.js";
import io_device from "../../www/devices/io_device.js";
import blob_device from "../../www/devices/blob_device.js";
import timer_device from "../../www/devices/timer_device.js";
import awp_device from "../../www/devices/awp_device.js";
import dummy_signaller from "../../www/transports/dummy_signaller.js";
import webrtc_transport from "../../www/transports/webrtc_transport.js";
import parseq from "../../www/parseq.js";
import lazy from "../../www/requestors/lazy.js";
import requestorize from "../../www/requestors/requestorize.js";
import chat_db from "./chat_db.js";

const room_key = 1000;

let core;  // uFork wasm processor core
let awp_store; // mutable AWP store object
let on_stdin;

function refill_all(spn) {
    const sponsor = core.u_read_quad(spn);
    sponsor.t = core.u_fixnum(4096);  // memory
    sponsor.x = core.u_fixnum(256);  // events
    sponsor.y = core.u_fixnum(4096);  // cycles
    core.u_write_quad(spn, sponsor);
    console.log("filled:", core.u_disasm(spn));
}
function ufork_run() {
    const spn = core.u_ramptr(ufork.SPONSOR_OFS);
    refill_all(spn);  // pre-load root-sponsor with resources
    const sig = core.h_run_loop(0);  // run until there is no more work, or an error occurs
    if (core.u_is_fix(sig)) {
        const err = core.u_fix_to_i32(sig);
        const msg = core.u_fault_msg(err);
        const spn = core.u_ramptr(ufork.SPONSOR_OFS);
        console.log("IDLE", core.u_disasm(spn), "error:", err, "=", msg);
        const sponsor = core.u_read_quad(spn);
        if (err === ufork.E_OK) {
            // processor idle
            return ufork.E_OK;
        } else if (err === ufork.E_MEM_LIM) {
            sponsor.t = core.u_fixnum(256);
        } else if (err === ufork.E_MSG_LIM) {
            sponsor.x = core.u_fixnum(16);
        } else if (err === ufork.E_CPU_LIM) {
            sponsor.y = core.u_fixnum(64);
        } else {
            // processor error
            return err;
        }
        core.u_write_quad(spn, sponsor);
        console.log("refilled:", core.u_disasm(spn));
    }
    setTimeout(function wakeup() {  // run again on a subsequent turn
        console.log("RUN:", core.u_print(sig));
        ufork_run();
    }, 0);
}

function ufork_wake(dev_ofs) {
    console.log("WAKE:", dev_ofs);
    ufork_run();
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

function encode_acquaintance(acquaintance) {
    return hex.encode(acquaintance.name) + "@" + acquaintance.address;
}

function decode_acquaintance(string) {
    const [name, address] = string.split("@");
    return {
        name: hex.decode(name),
        address
    };
}

function get_url_acquaintance() {
    const string = location.hash.slice(1);
    if (string !== "") {
        return decode_acquaintance(string);
    }
}

function set_url_acquaintance(acquaintance) {
    location.hash = "#" + encode_acquaintance(acquaintance);
}

function room_petname() {
    const acquaintance = get_url_acquaintance();
    if (acquaintance === undefined) {

// No acquaintance was specified in the URL, so we are hosting our own room.

        set_url_acquaintance(awp_store.acquaintances[0]);
        return 0;
    }

// Look up the acquaintance in the store. If it is missing, add it.

    const petname = awp_store.acquaintances.findIndex(function ({name}) {
        return hex.encode(acquaintance.name) === hex.encode(name);
    });
    if (petname === -1) {
        awp_store.acquaintances.push(acquaintance);
        return awp_store.acquaintances.length - 1;
    }
    return petname;
}

function boot(entrypoint) {

// Get the integer petname of the acquaintance who is hosting the room, and
// provide it to the uFork program as a boot capability.

    const petname = room_petname();
    core.h_install([[room_key, core.u_fixnum(petname)]]);
    core.h_boot(entrypoint);
    return ufork_run();
}

const transport = webrtc_transport(dummy_signaller(), console.log);
const wasm_url = import.meta.resolve(
    "../../target/wasm32-unknown-unknown/debug/ufork_wasm.wasm"
);
const asm_url = import.meta.resolve("./chat.asm");
parseq.sequence([
    parseq.parallel([
        chat_db.get_store(),
        parseq.sequence([
            ufork.instantiate_core(
                wasm_url,
                ufork_wake,
                console.log,
                ufork.LOG_DEBUG
            ),
            lazy(function (the_core) {
                core = the_core;
                return core.h_import(asm_url);
            })
        ])
    ]),
    requestorize(function ([the_awp_store, asm_module]) {
        clock_device(core);
        on_stdin = io_device(core, on_stdout);
        blob_device(core);
        timer_device(core);
        awp_store = the_awp_store;
        awp_device(core, transport, the_awp_store);
        return boot(asm_module.boot);
    })
])(console.log);
