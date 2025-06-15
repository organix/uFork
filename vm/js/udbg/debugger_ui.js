// An interactive debugger for remote uFork cores.

/*jslint browser, global */

import assemble from "https://ufork.org/lib/assemble.js";
import dom from "https://ufork.org/lib/dom.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import theme from "https://ufork.org/lib/theme.js";
import make_ui from "https://ufork.org/lib/ui.js";
import ufork from "../ufork.js";
import make_core from "../core.js";
import blob_dev from "../blob_dev.js";
import timer_dev from "../timer_dev.js";
import make_core_driver from "./core_driver.js";
import actors_ui from "./actors_ui.js";
import continuation_ui from "./continuation_ui.js";
import ram_ui from "./ram_ui.js";
import rom_ui from "./rom_ui.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");

const throttle = 1000 / 24; // limit status-triggered rerenders to 24 FPS
const max_play_interval = 1000;
const default_view = "actors";
const debugger_ui = make_ui("debugger-ui", function (element, {
    send_command,
    connected = false,
    view = default_view
}) {
    let play_button;
    let step_button;
    let view_select;
    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            display: flex;
            flex-direction: column;
            background: ${theme.black};
            contain: strict;
        }
        :host > :last-child { /* view */
            flex: 1 1;
            min-height: 0;
        }
        controls_container {
            display: flex;
            gap: 7px;
            padding: 7px;
            align-items: stretch;
            border-bottom: 1px solid ${theme.gray};
        }
        fault_message {
            font-family: monospace;
            border: 1px solid currentcolor;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 6px;
        }
        flex_spacer {
            flex: 1 1;
        }
    `);

    function toggle_play() {
        if (play_button.textContent === "Play") {
            send_command({kind: "play"});
        } else {
            send_command({kind: "pause"});
        }
    }

    function step() {
        if (!step_button.disabled) {
            send_command({kind: "play", steps: 1});
        }
    }

    step_button = dom("button", {
        type: "button",
        onclick: step,
        title: "Single step (s)",
        textContent: "Step"
    });
    play_button = dom("button", {
        type: "button",
        onclick: toggle_play,
        title: "Toggle playback (c)",
        textContent: "Play"
    });
    const speed_slider = dom("input", {
        title: "Playback Speed",
        type: "range",
        min: 0,
        max: 1,
        step: 0.01,
        oninput() {
            const slowness = 1 - Number(speed_slider.value);
            send_command({
                kind: "interval",
                milliseconds: Math.round(
                    (max_play_interval + 1) ** slowness
                ) - 1
            });
        }
    });
    const fault_message = dom("fault_message");
    const views = {
        actors: {
            name: "Actors",
            element: actors_ui({
                background_color: theme.black,
                foreground_color: theme.yellow,
                device_color: theme.green,
                proxy_color: theme.orange
            })
        },
        source: {
            name: "Source",
            element: continuation_ui({})
        },
        ram: {
            name: "RAM",
            element: ram_ui({})
        },
        rom: {
            name: "ROM",
            element: rom_ui({})
        }
    };

    function set_step_size(step_size) {
        send_command({kind: "step_size", value: step_size});
    }

    function auto_step_size() {
        if (connected && play_button.textContent === "Play") {
            if (view === "actors") {
                set_step_size("txn");
            } else if (view === "source") {
                set_step_size("instr");
            }
        }
    }

    function set_view(new_view) {
        if (typeof views[new_view] !== "object") {
            new_view = default_view;
        }
        view = new_view;
        view_select.value = view;
        shadow.lastChild.replaceWith(views[view].element);
        auto_step_size();
    }

    function on_keydown(event) {
        if (!event.altKey && !event.metaKey && !event.ctrlKey) {
            if (event.key === "s") {
                step();
            } else if (event.key === "c") {
                toggle_play();
            } else {
                const view_names = Object.keys(views);
                const view_nr = view_names.indexOf(view);
                let new_view;
                if (event.key === "ArrowUp") {
                    new_view = view_names[view_nr - 1];
                } else if (event.key === "ArrowDown") {
                    new_view = view_names[view_nr + 1];
                }
                if (new_view !== undefined) {
                    set_view(new_view);
                    event.preventDefault();
                }
            }
        }
    }

    function on_signal(signal) {
        fault_message.textContent = (
            ufork.is_fix(signal)
            ? ufork.fault_msg(ufork.fix_to_i32(signal))
            : "..."
        );
        fault_message.style.color = (
            ufork.is_fix(signal)
            ? (
                ufork.fix_to_i32(signal) === ufork.E_OK
                ? theme.green
                : theme.red
            )
            : "inherit"
        );
    }

    const step_select = dom(
        "select",
        {
            title: "Step size",
            oninput() {
                set_step_size(step_select.value);
            }
        },
        [
            dom("option", {value: "instr"}, "Instruction"),
            dom("option", {value: "txn"}, "Transaction")
        ]
    );
    view_select = dom(
        "select",
        {
            title: "View (up/down arrow)",
            value: view,
            oninput() {
                set_view(view_select.value);
            }
        },
        Object.entries(views).map(function ([value, info]) {
            return dom("option", {value}, info.name);
        })
    );
    const spacer = dom("flex_spacer");
    const controls = dom("controls_container", [
        view_select,
        step_select,
        speed_slider,
        step_button,
        play_button,
        spacer,
        fault_message
    ]);
    const statuses = {
        audit(message) {
            views.actors.element.set_audit(
                message.code,
                message.evidence,
                message.ep,
                message.kp
            );
            if (message.code !== undefined) {
                fault_message.textContent = "audit";
                fault_message.style.color = theme.red;
            }
        },
        device_txn(message) {
            views.actors.element.set_device_txn(
                message.sender,
                message.events,
                message.wake
            );
            if (message.wake) {
                fault_message.textContent = "wakeup";
                fault_message.style.color = "inherit";
            }
        },
        interval(message) {
            const is_sliding = (
                document.activeElement === element
                && shadow.activeElement === speed_slider
                && document.hasFocus()
            );
            if (!is_sliding) {
                const slowness = (
                    Math.log(message.milliseconds + 1)
                    / Math.log(max_play_interval)
                );
                speed_slider.value = 1 - slowness;
            }
        },
        playing(message) {
            play_button.textContent = (
                message.value
                ? "Pause"
                : "Play"
            );
            step_button.disabled = message.value;
        },
        ram(message) {
            views.ram.element.set_ram(message.bytes);
            views.actors.element.set_ram(message.bytes);
            views.source.element.set_ram(message.bytes);
        },
        rom(message) {
            const {bytes, debugs, module_texts} = message;
            views.ram.element.set_rom(bytes, debugs);
            views.rom.element.set_rom(bytes, debugs);
            views.actors.element.set_rom(bytes, debugs);
            views.source.element.set_rom(bytes, debugs, module_texts);
        },
        signal(message) {
            on_signal(message.signal);
        },
        step_size(message) {
            step_select.value = message.value;
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
        if (!connected) {
            fault_message.textContent = "connecting";
            fault_message.style.color = theme.yellow;
            return;
        }
        if (!was_connected) {
            on_signal(ufork.UNDEF_RAW);
            send_command({kind: "debugging", enabled: true});
            send_command({kind: "subscribe", topic: "interval", throttle});
            send_command({kind: "subscribe", topic: "playing"});
            send_command({kind: "subscribe", topic: "ram", throttle});
            send_command({kind: "subscribe", topic: "rom", throttle});
            send_command({kind: "subscribe", topic: "signal", throttle});
            send_command({kind: "subscribe", topic: "step_size", throttle});
            send_command({kind: "subscribe", topic: "device_txn", throttle});
            send_command({kind: "subscribe", topic: "audit", throttle});
            auto_step_size();
        }
    }

    shadow.append(style, controls, dom("view_placeholder"));
    on_signal(ufork.UNDEF_RAW);
    set_connected(connected);
    set_view(view);
    element.receive_status = receive_status;
    element.set_connected = set_connected;
    return {
        connect() {
            document.addEventListener("keydown", on_keydown);
        },
        disconnect() {
            document.removeEventListener("keydown", on_keydown);
        }
    };
});

function demo(log) {
    document.documentElement.innerHTML = "";
    let driver;
    let element;
    const core = make_core({
        wasm_url,
        on_txn(...args) {
            driver.txn(...args);
        },
        on_audit(...args) {
            driver.audit(...args);
        },
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble}
    });
    driver = make_core_driver(core, function on_status(message) {
        element.receive_status(message);
    });
    parseq.sequence([
        core.h_initialize(),
        core.h_import("https://ufork.org/lib/cell.asm"),
        // core.h_import("https://ufork.org/lib/blob.asm"),
        requestorize(function () {
            blob_dev(core);
            timer_dev(core);
            core.h_boot();
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
    document.head.append(dom("meta", {name: "color-scheme", content: "dark"}));
    document.body.append(element);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(debugger_ui);
