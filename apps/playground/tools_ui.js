// The playground's "devtools" panel.

/*jslint browser, global */

import dom from "https://ufork.org/lib/dom.js";
import make_ui from "https://ufork.org/lib/ui.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import ufork from "https://ufork.org/js/ufork.js";
import clock_dev from "https://ufork.org/js/clock_dev.js";
import random_dev from "https://ufork.org/js/random_dev.js";
import blob_dev from "https://ufork.org/js/blob_dev.js";
import fs_dev from "https://ufork.org/js/fs_dev.js";
import tcp_dev from "https://ufork.org/js/tcp_dev.js";
import timer_dev from "https://ufork.org/js/timer_dev.js";
import io_dev from "https://ufork.org/js/io_dev.js";
import host_dev from "https://ufork.org/js/host_dev.js";
import svg_dev from "https://ufork.org/js/svg_dev.js";
import make_core_driver from "https://ufork.org/js/udbg/core_driver.js";
import lang_asm from "./lang_asm.js";
import lang_scm from "./lang_scm.js";
import io_dev_ui from "./io_dev_ui.js";
import svg_dev_ui from "./svg_dev_ui.js";
import disasm_ui from "./disasm_ui.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");

const tools_ui = make_ui("tools-ui", function (element, {
    text = "",
    src,
    device,
    lang = "asm",
    lang_packs = {},
    import_map,
    on_lang_change,
    on_device_change,
    on_attach,
    on_detach,
    on_debug,
    on_status,
    on_help
}) {
    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            display: flex;
            flex-direction: column;
        }
        tools_controls { /* controls */
            display: flex;
            justify-content: stretch;
            margin: 6px;
            overflow-x: auto;
        }
        tools_controls > * {
            flex: 1 1;
            margin: 2px;
            white-space: nowrap;
        }
        :host > :last-child { /* device */
            flex: 1 1;
            min-height: 0;
        }
    `);
    let core;
    let driver;
    let devices = Object.create(null);
    let device_element = document.createComment("placeholder");
    let device_select;
    let lang_select;
    let boot_button;
    let debug_button;
    let test_button;
    let help_button;
    let h_on_stdin;
    let h_on_svgin;

    devices.io = io_dev_ui({
        on_input(character) {
            if (h_on_stdin !== undefined) {
                h_on_stdin(character);
            }
        }
    });
    devices.svg = svg_dev_ui({
        background_color: "#ffffff",
        on_pointer_input(x, y, button_mask) {
            if (h_on_svgin !== undefined) {
                h_on_svgin(x, y, button_mask);
            }
        }
    });
    devices.disasm = disasm_ui({});

    function refresh_disasm() {
        if (device_select.value === "disasm") {
            const lang_pack = lang_packs[lang_select.value];
            devices.disasm.set_ir(lang_pack.compile(text));
        }
    }

    function set_device(device) {
        if (devices[device] === undefined) {
            device = "io"; // default
        }
        const replacement = devices[device];

// Replacing an element with itself seems to reset any scroll positions within,
// so we avoid that.

        if (device_element !== replacement) {
            device_element.replaceWith(replacement);
            device_element = replacement;
        }
        device_select.value = device;
        refresh_disasm();
    }

    function set_lang(new_lang) {
        lang_select.value = new_lang;
        test_button.disabled = new_lang !== "asm";
        refresh_disasm();
    }

    function set_text(new_text) {
        text = new_text;
        refresh_disasm();
    }

    function set_src(new_src) {
        src = new_src;
    }

    function stop() {
        boot_button.textContent = "▶ Boot";
        boot_button.onclick = function (event) {
            run(text, "boot", event.shiftKey);
        };
        on_detach();
        h_on_svgin = undefined;
        if (driver !== undefined) {
            driver.dispose();
        }
        if (core !== undefined) {
            core.h_dispose();
        }
    }

    function warn(...args) {
        set_device("io");
        on_device_change("io");
        devices.io.warn(...args);
    }

    function run(text, entry, debug) {
        stop();

// The module may import modules written in a different language, so provide
// the core with every compiler we have.

        let compilers = Object.create(null);
        Object.entries(lang_packs).forEach(function ([lang, lang_pack]) {
            compilers[lang] = lang_pack.compile;
        });
        core = ufork.make_core({
            wasm_url,
            on_wakeup(sender, events) {
                devices.io.info("WAKE:", ufork.print(sender));
                driver.wakeup(sender, events);
            },
            on_txn(...args) {
                driver.txn(...args);
            },
            log_level: ufork.LOG_TRACE,
            on_log(log_level, ...values) {
                const logger = (
                    log_level === ufork.LOG_WARN
                    ? devices.io.warn
                    : (
                        log_level === ufork.LOG_DEBUG
                        ? devices.io.debug
                        : devices.io.info
                    )
                );
                logger(...values);
            },
            on_audit(code, evidence) {
                devices.io.warn(
                    "AUDIT:",
                    ufork.fault_msg(ufork.fix_to_i32(code)),
                    core.u_pprint(evidence)
                );
            },
            import_map,
            compilers
        });
        driver = make_core_driver(core, function (message) {
            if (message.kind === "signal") {
                const error_code = ufork.fix_to_i32(message.signal);
                const error_text = ufork.fault_msg(error_code);
                if (error_code === ufork.E_OK) {
                    devices.io.info("IDLE:", error_text);
                } else {
                    devices.io.warn("FAULT:", error_text);
                    stop();
                }
            }
            on_status(message);
        });
        const {compile, stringify_error} = lang_packs[lang_select.value];
        const ir = compile(text);
        if (ir.errors !== undefined && ir.errors.length > 0) {
            const error_messages = ir.errors.map(stringify_error);
            return warn(error_messages.join("\n"));
        }
        parseq.sequence([
            core.h_initialize(),
            core.h_import(src, text),
            requestorize(function (imported_module) {
                const make_ddev = host_dev(core);
                clock_dev(core);
                random_dev(core);
                const the_blob_dev = blob_dev(core, make_ddev);
                tcp_dev(core, make_ddev, the_blob_dev, ["127.0.0.1:8370"]);
                fs_dev(core, make_ddev, the_blob_dev);
                timer_dev(core);
                h_on_stdin = io_dev(core, devices.io.output);
                h_on_svgin = svg_dev(core, make_ddev, devices.svg.draw);
                if (imported_module[entry] === undefined) {
                    throw new Error("Missing '" + entry + "' export.");
                }
                if (entry === "test") {
                    const ddev = make_ddev(function on_event_stub(ptr) {
                        const event_stub = core.u_read_quad(ptr);
                        const event = core.u_read_quad(event_stub.y);
                        const msg = event.y;
                        if (msg === ufork.TRUE_RAW) {
                            devices.io.debug("Test passed. You are awesome!");
                        } else {
                            warn("Test failed:", core.u_pprint(msg));
                        }
                        stop();
                    });
                    const judge = ddev.h_reserve_proxy();
                    core.h_boot(imported_module[entry], judge);
                } else {
                    core.h_boot(imported_module[entry]);
                }
                boot_button.textContent = "⏹ Stop";
                boot_button.onclick = stop;
                driver.command({kind: "subscribe", topic: "signal"});
                if (debug) {
                    on_attach();
                } else {
                    driver.command({kind: "play"});
                }
                return true;
            })
        ])(function callback(value, reason) {
            if (value === undefined) {
                warn(reason.message ?? reason);
            }
        });
    }

    function command(message) {
        driver.command(message);
    }

    device_select = dom(
        "select",
        {
            title: "Choose device",
            oninput() {
                set_device(device_select.value);
                on_device_change(device_select.value);
            }
        },
        [
            dom("option", {value: "io", textContent: "I/O"}),
            dom("option", {value: "svg", textContent: "SVG"}),
            dom("option", {value: "disasm", textContent: "Disasm"})
        ]
    );
    lang_select = dom(
        "select",
        {
            title: "Choose language",
            oninput() {
                set_lang(lang_select.value);
                on_lang_change(lang_select.value);
            }
        },
        Object.keys(lang_packs).map(function (name) {
            return dom("option", {value: name, textContent: name});
        })
    );
    boot_button = dom("button", {
        title: "shift+click to debug"
    });
    test_button = dom("button", {
        textContent: "✔ Test",
        title: "shift+click to debug",
        onclick(event) {
            run(text, "test", event.shiftKey);
        }
    });
    debug_button = dom("button", {
        textContent: "⛐ Debug",
        onclick: on_debug
    });
    help_button = dom("button", {
        textContent: "﹖ Help",
        onclick: on_help
    });
    const controls_element = dom("tools_controls", [
        boot_button,
        test_button,
        debug_button,
        help_button,
        lang_select,
        device_select
    ]);
    set_device(device);
    set_lang(lang);
    set_text(text);
    set_src(src);
    stop();
    shadow.append(style, controls_element, device_element);
    element.command = command;
    element.set_device = set_device;
    element.set_lang = set_lang;
    element.set_text = set_text;
    element.set_src = set_src;
    element.warn = warn;
});

if (import.meta.main) {
    document.documentElement.innerHTML = "";
    const tools = dom(
        tools_ui({
            src: new URL("example.asm", location.href).href,
            lang_packs: {asm: lang_asm, scm: lang_scm},
            on_lang_change: globalThis.console.log,
            on_device_change: globalThis.console.log,
            on_attach: () => globalThis.console.log("on_attach"),
            on_detach: () => globalThis.console.log("on_detach"),
            on_debug: () => globalThis.console.log("on_debug"),
            on_status: () => globalThis.console.log("on_status"),
            on_help: () => globalThis.console.log("on_help")
        }),
        {style: {position: "fixed", inset: "0"}}
    );
    document.head.append(
        dom("meta", {name: "color-scheme", content: "dark"})
    );
    document.body.append(tools);
}

export default Object.freeze(tools_ui);
