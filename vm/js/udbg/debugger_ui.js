// An interactive debugger for remote uFork cores.

/*jslint browser, global */

import assemble from "https://ufork.org/lib/assemble.js";
import dom from "https://ufork.org/lib/dom.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import make_ui from "https://ufork.org/lib/ui.js";
import ufork from "../ufork.js";
import timer_dev from "../timer_dev.js";
import make_core_driver from "./core_driver.js";
import actor_graph_ui from "./actor_graph_ui.js";
import ram_explorer_ui from "./ram_explorer_ui.js";
import source_monitor_ui from "./source_monitor_ui.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");
const lib_url = import.meta.resolve("../../../lib/");

const throttle = 1000 / 24; // limit status-triggered rerenders to 24 FPS
const max_play_interval = 1000;
const default_view = "actor_graph";
const theme = {
    red: "#F92672",
    orange: "#FD971F",
    silver: "#BFBFBF",
    gray: "#484848",
    black: "#222222",
    blue: "#60B8EF",
    green: "#28C846",
    purple: "#CE80FF",
    yellow: "#E6DB74"
};
const debugger_ui = make_ui("debugger-ui", function (element, {
    send_command,
    connected = false,
    view = default_view
}) {
    let menu;

    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            display: flex;
            flex-direction: column;
            background: ${theme.black};
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
    const step_button = dom("button", {
        type: "button",
        onclick() {
            send_command({kind: "step"});
        },
        textContent: "Step"
    });
    const fault_message = dom("fault_message");
    const views = {
        actor_graph: actor_graph_ui({
            background_color: theme.black,
            foreground_color: theme.yellow,
            device_color: theme.green,
            proxy_color: theme.orange
        }),
        ram: ram_explorer_ui({text_color: theme.blue}),
        sources: source_monitor_ui({})
    };

    function set_view(new_view) {
        if (typeof views[new_view] !== "object") {
            new_view = default_view;
        }
        view = new_view;
        menu.value = view;
        shadow.lastChild.replaceWith(views[view]);
    }

    function on_keydown(event) {

// Previous view: alt+up
// Next view: alt+down

        if (event.altKey && !event.metaKey && !event.ctrlKey) {
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

    function on_signal(signal) {
        fault_message.textContent = (
            ufork.is_fix(signal)
            ? ufork.fault_msg(ufork.fix_to_i32(signal))
            : "?"
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

    menu = dom(
        "select",
        {
            value: view,
            oninput() {
                set_view(menu.value);
            }
        },
        [
            dom("option", {value: "actor_graph"}, "Actor Graph"),
            dom("option", {value: "ram"}, "RAM Explorer"),
            dom("option", {value: "sources"}, "Sources")
        ]
    );
    const spacer = dom("flex_spacer");
    const controls = dom(
        "controls_container",
        [menu, step_button, play_button, speed_slider, spacer, fault_message]
    );
    const statuses = {
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
        },
        ram(message) {
            views.ram.set_bytes(message.bytes);
            views.actor_graph.set_ram(message.bytes);
        },
        signal(message) {
            on_signal(message.signal);
        },
        source(message) {
            views.sources.set_sourcemap(message.sourcemap);
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
        if (connected) {
            if (!was_connected) {
                on_signal(ufork.UNDEF_RAW);
                send_command({kind: "subscribe", topic: "interval", throttle});
                send_command({kind: "subscribe", topic: "playing", throttle});
                send_command({kind: "subscribe", topic: "ram", throttle});
                send_command({kind: "subscribe", topic: "signal", throttle});
                send_command({kind: "subscribe", topic: "source", throttle});
                send_command({kind: "subscribe", topic: "wakeup", throttle});
            }
        } else {
            fault_message.textContent = "connecting";
            fault_message.style.color = theme.yellow;
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
    document.head.append(
        dom("meta", {name: "color-scheme", content: "dark"})
    );
    document.body.append(element);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(debugger_ui);
