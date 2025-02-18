// An interactive remote debugger for remote uFork cores. It is simply a DOM
// element that can be embedded in existing web applications.

/*jslint browser, global */

import assemble from "https://ufork.org/lib/assemble.js";
import dom from "https://ufork.org/lib/dom.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import ufork from "../ufork.js";
import timer_dev from "../timer_dev.js";
import make_core_driver from "./core_driver.js";
import memory_dump from "./memory_dump.js";
import source_monitor_ui from "./source_monitor_ui.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");
const lib_url = import.meta.resolve("../../../lib/");

const blue = "#3CF";
const green = "#3F0";
const red = "#F30";

function debugger_ui({
    send_command,
    connected = false
}) {
    const element = dom("debugger-ui", {
        style: {
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "10px",
            background: "#333" // dark gray
        }
    });
    const source = source_monitor_ui({});
    const ram = dom("ram_monitor", {
        style: {
            display: "block",
            color: blue,
            fontFamily: "monospace",
            whiteSpace: "pre",
            flex: "1 1",
            overflow: "auto"
        }
    });
    const monitors = dom(
        "monitor_container",
        {style: {display: "flex", flex: "1 1", gap: "10px", minHeight: "0"}},
        [source, ram]
    );
    const play_button = dom("button", {
        type: "button",
        onclick() {
            if (play_button.textContent === "Play") {
                send_command({kind: "play", debug: true});
            } else {
                send_command({kind: "pause"});
            }
        },
        textContent: "Play"
    });
    const play_slider = dom("input", {
        type: "range",
        min: 0,
        max: 1000,
        oninput() {
            send_command({
                kind: "interval",
                milliseconds: Number(play_slider.value)
            });
        }
    });
    const step_button = dom("button", {
        type: "button",
        onclick() {
            send_command({kind: "step"});
        },
        textContent: "Step"
    });
    const fault_message = dom("fault_message", {
        style: {fontFamily: "monospace"}
    });
    const controls = dom(
        "controls_container",
        {style: {display: "flex", gap: "6px", alignItems: "center"}},
        [step_button, play_button, play_slider, fault_message]
    );
    const statuses = {
        interval(message) {
            const is_sliding = (
                document.activeElement === play_slider && document.hasFocus()
            );
            if (!is_sliding) {
                play_slider.value = message.milliseconds;
            }
        },
        playing(message) {
            play_button.textContent = (
                message.value
                ? "Pause"
                : "Play"
            );
        },
        ram(message) {
            ram.textContent = memory_dump(message.bytes, ufork.ramptr(0));
        },
        signal(message) {
            fault_message.textContent = (
                ufork.is_fix(message.signal)
                ? ufork.fault_msg(ufork.fix_to_i32(message.signal))
                : ""
            );
            fault_message.style.color = (
                message.signal === ufork.fixnum(ufork.E_OK)
                ? green
                : red
            );
        },
        source(message) {
            source.set_sourcemap(message.sourcemap);
        }
    };

    function receive_status(message) {
        if (Object.hasOwn(statuses, message.kind)) {
            statuses[message.kind](message);
        }
    }

    function set_connected(new_connected) {
        const was_connected = connected;
        connected = new_connected;
        step_button.disabled = !connected;
        if (!was_connected && connected) {
            send_command({kind: "subscribe", topic: "interval"});
            send_command({kind: "subscribe", topic: "playing"});
            send_command({kind: "subscribe", topic: "ram"});
            send_command({kind: "subscribe", topic: "signal"});
            send_command({kind: "subscribe", topic: "source"});
            send_command({kind: "subscribe", topic: "wakeup"});
        }
    }

    element.append(monitors, controls);
    set_connected(connected);
    element.receive_status = receive_status;
    element.set_connected = set_connected;
    return element;
}

function demo(log) {
    document.documentElement.innerHTML = "";
    let driver;
    let element;
    const core = ufork.make_core({
        wasm_url,
        on_wakeup(device_offset) {
            driver.wakeup(device_offset);
        },
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble}
    });
    driver = make_core_driver(core, function on_status(message) {
        element.receive_status(message);
    });
    parseq.sequence([
        core.h_initialize(),
        core.h_import("https://ufork.org/lib/rq/delay.asm"),
        requestorize(function (module) {
            timer_dev(core);
            core.h_boot(module.boot);
            element.set_connected(true);
            return true;
        })
    ])(log);
    element = debugger_ui({
        send_command: driver.command,
        connected: false
    });
    element.style.position = "fixed";
    element.style.inset = "0";
    document.body.append(element);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(debugger_ui);
