// uFork Peer Chat demo.

/*jslint browser, devel */

import hex from "https://ufork.org/lib/hex.js";
import hexdump from "https://ufork.org/lib/hexdump.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import assemble from "https://ufork.org/lib/assemble.js";
import ufork from "https://ufork.org/js/ufork.js";
import io_dev from "https://ufork.org/js/io_dev.js";
import timer_dev from "https://ufork.org/js/timer_dev.js";
import awp_dev from "https://ufork.org/js/awp_dev.js";
import host_dev from "https://ufork.org/js/host_dev.js";
import websockets_signaller from "https://ufork.org/js/websockets_signaller.js";
import webrtc_transport from "https://ufork.org/js/webrtc_transport.js";
import make_chat_db from "./chat_db.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");
const asm_url = import.meta.resolve("./chat.asm");

const room_key = 1000;
const default_signaller_origin = (
    location.protocol === "https:"
    ? "wss://"
    : "ws://"
) + location.host;

let core;  // uFork wasm processor core
let on_stdin;
let db = make_chat_db(default_signaller_origin);

function refill_all(spn) {
    const sponsor = core.u_read_quad(spn);
    sponsor.t = core.u_fixnum(4096);  // memory
    sponsor.x = core.u_fixnum(256);  // events
    sponsor.y = core.u_fixnum(8192);  // cycles
    core.u_write_quad(spn, sponsor);
    //console.log("filled:", core.u_disasm(spn));
}

function ufork_run() {
    const spn = core.u_ramptr(ufork.SPONSOR_OFS);
    refill_all(spn);  // pre-load root-sponsor with resources
    // run until there is no more work, or an error occurs
    const sig = core.h_run_loop(0);
    if (core.u_is_fix(sig)) {
        const err = core.u_fix_to_i32(sig);
        const msg = core.u_fault_msg(err);
        console.log("IDLE", core.u_disasm(spn), "error:", err, "=", msg);
        const sponsor = core.u_read_quad(spn);
        if (err === ufork.E_OK) {
            // processor idle
            return ufork.E_OK;
        }
        if (err === ufork.E_MEM_LIM) {
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
const $input_form = document.getElementById("input-form");
$input_form.onsubmit = function (event) {
    event.preventDefault(); // prevent POST
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
$stdout.value = ""; // prevent Firefox retaining the text thru a page reload
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
    return hex.encode(acquaintance.name) + (
        acquaintance.address === default_signaller_origin
        ? ""
        : "@" + acquaintance.address
    );
}

function decode_acquaintance(string) {
    const [name, address] = string.split("@");
    return {
        name: hex.decode(name),
        address: address ?? default_signaller_origin
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

function room_petname(awp_store) {
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

function boot(entrypoint, awp_store) {

// Get the integer petname of the acquaintance who is hosting the room, and
// provide it to the uFork program as a boot capability.

    const petname = room_petname(awp_store);
    core.h_install(core.u_fixnum(room_key), core.u_fixnum(petname));
    core.h_boot(entrypoint);
    return ufork_run();
}

function save_store(store) {
    db.set_store()(
        function callback(value, reason) {
            if (value === undefined) {
                console.error(reason);
            }
        },
        store
    );
}

const $importmap = document.querySelector("[type=importmap]");
const transport = webrtc_transport(websockets_signaller(), console.log);
core = ufork.make_core({
    wasm_url,
    on_wakeup: ufork_wake,
    on_log: console.log,
    log_level: ufork.LOG_DEBUG,
    import_map: (
        $importmap
        ? JSON.parse($importmap.textContent).imports
        : {}
    ),
    compilers: {asm: assemble}
});
parseq.sequence([
    core.h_initialize(),
    parseq.parallel([
        db.get_store(),
        core.h_import(asm_url)
    ]),
    requestorize(function ([the_awp_store, asm_module]) {
        on_stdin = io_dev(core, on_stdout);
        timer_dev(core);
//        timer_dev(core, 5);  // slow-down factor 5x
        const make_ddev = host_dev(core);
        awp_dev({
            core,
            make_ddev,
            transport,
            stores: [the_awp_store],
            on_store_change: save_store
        });
        return boot(asm_module.boot, the_awp_store);
    })
])(function callback(value, reason) {
    if (value === undefined) {
        console.error(reason);
    }
});
