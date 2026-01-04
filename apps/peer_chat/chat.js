// uFork Peer Chat demo.

/*jslint browser, global */

import hex from "https://ufork.org/lib/hex.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import assemble from "https://ufork.org/lib/assemble.js";
import ufork from "https://ufork.org/js/ufork.js";
import make_core from "https://ufork.org/js/core.js";
import io_dev from "https://ufork.org/js/io_dev.js";
import timer_dev from "https://ufork.org/js/timer_dev.js";
import awp_dev from "https://ufork.org/js/awp_dev.js";
import host_dev from "https://ufork.org/js/host_dev.js";
import websockets_signaller from "https://ufork.org/js/websockets_signaller.js";
import webrtc_transport from "https://ufork.org/js/webrtc_transport.js";
import make_core_driver from "https://ufork.org/js/udbg/core_driver.js";
import make_chat_db from "./chat_db.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");
const asm_url = import.meta.resolve("./chat.asm");

const room_key = 1000;
const default_signaller_origin = (
    location.protocol === "https:"
    ? "wss://"
    : "ws://"
) + location.host;
const debug = new URL(location.href).searchParams.get("debug");
const log = globalThis.console.log;
const udbg_style = {width: "100%", height: "600px", marginTop: "2ex"};

let core;
let driver;
let h_on_stdin;
let db = make_chat_db(default_signaller_origin);
let udbg_on_status;
let udbg_window;

const $stdin = document.getElementById("stdin");
const $input_form = document.getElementById("input-form");
$input_form.onsubmit = function (event) {
    event.preventDefault(); // prevent POST
    let text = $stdin.value;
    if (text.length > 0) {
        text += "\n";
        h_on_stdin(text);
        $stdin.value = "";
    }
};
const $stdout = document.getElementById("stdout");
$stdout.value = ""; // prevent Firefox retaining the text thru a page reload

function on_stdout(char) {
    const text = $stdout?.value;
    if (typeof text === "string") {
        $stdout.value = text + char;
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

function save_store(store) {
    db.set_store()(log, store);
}

const $importmap = document.querySelector("[type=importmap]");
const transport = webrtc_transport(websockets_signaller(), log);
core = make_core({
    wasm_url,
    on_txn(...args) {
        driver.txn(...args);
    },
    on_audit(...args) {
        driver.audit(...args);
    },
    on_log: log,
    log_level: (
        typeof debug === "string"
        ? ufork.LOG_TRACE
        : ufork.LOG_WARN
    ),
    import_map: (
        $importmap
        ? JSON.parse($importmap.textContent).imports
        : {}
    ),
    compilers: {asm: assemble}
});
driver = make_core_driver(core, function on_status(message) {
    udbg_on_status(message);
});
parseq.sequence([
    core.h_initialize(),
    parseq.parallel([
        db.get_store(),
        core.h_import(asm_url)
    ]),
    requestorize(function ([the_awp_store]) {
        h_on_stdin = io_dev(core, on_stdout);
        timer_dev(core);
        const make_ddev = host_dev(core);
        awp_dev({
            core,
            make_ddev,
            transport,
            stores: [the_awp_store],
            on_store_change: save_store
        });

// Get the integer petname of the acquaintance who is hosting the room, and
// provide it to the uFork program as a boot capability.

        const petname = room_petname(the_awp_store);
        core.h_install(ufork.fixnum(room_key), ufork.fixnum(petname));
        core.h_boot();
        if (typeof debug !== "string") {
            driver.command({kind: "auto_refill", enabled: true});
            driver.command({kind: "play"});
            return true;
        }

// Launch the debugger.

        if (debug === "element") {
            return import(
                "https://ufork.org/js/udbg/debugger_ui.js"
            ).then(function (module) {
                const debugger_ui = module.default;
                const udbg_element = debugger_ui({
                    send_command: driver.command
                });
                udbg_on_status = udbg_element.receive_status;
                Object.assign(udbg_element.style, udbg_style);
                document.body.append(udbg_element);
                udbg_element.set_connected(true);
            });
        }
        const session = "chat";
        let url = new URL("https://ufork.org/udbg/");
        // let url = new URL("http://localhost:3675/apps/udbg/index.html");
        let params = new URLSearchParams();
        params.set("origin", globalThis.origin);
        params.set("session", session);
        url.hash = params;
        return import(
            "https://ufork.org/js/udbg/window_bridge.js"
        ).then(function (module) {
            const make_window_bridge = module.default;
            if (debug === "popup") {
                udbg_window = globalThis.open(url, "udbg", "popup");
                if (udbg_window) {
                    const udbg_bridge = make_window_bridge(
                        udbg_window,
                        url.origin,
                        session,
                        driver.command
                    );
                    udbg_on_status = udbg_bridge.send;
                    udbg_bridge.send({kind: "reset"}); // reuse
                } else {
                    globalThis.alert("Debugger popup blocked.");
                }
            } else {
                const iframe = document.createElement("iframe");
                iframe.src = url;
                Object.assign(iframe.style, udbg_style);
                document.body.append(iframe);
                udbg_window = iframe.contentWindow;
                const udbg_bridge = make_window_bridge(
                    udbg_window,
                    url.origin,
                    session,
                    driver.command
                );
                udbg_on_status = udbg_bridge.send;
            }
        });
    })
])(function callback(value, reason) {
    if (value === undefined) {
        log(reason);
    }
});
