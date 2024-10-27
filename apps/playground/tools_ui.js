// The playground's "devtools" panel.

/*jslint browser */

import make_ui from "./ui.js";
import dom from "./dom.js";
import io_dev_ui from "./io_dev_ui.js";
import rom_ui from "./rom_ui.js";
import svg_dev_ui from "./svg_dev_ui.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import ufork from "https://ufork.org/js/ufork.js";
import clock_dev from "https://ufork.org/js/clock_dev.js";
import random_dev from "https://ufork.org/js/random_dev.js";
import blob_dev from "https://ufork.org/js/blob_dev.js";
import timer_dev from "https://ufork.org/js/timer_dev.js";
import io_dev from "https://ufork.org/js/io_dev.js";
import host_dev from "https://ufork.org/js/host_dev.js";
import svg_dev from "https://ufork.org/js/svg_dev.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");

const tools_ui = make_ui("tools-ui", function (element, {
    get_text,
    get_src,
    device,
    lang = "asm",
    lang_packs = {},
    import_map,
    on_lang_change,
    on_device_change,
    on_debug,
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
            margin: 0 8px 8px;
        }
    `);
    let core;
    let run_loop_timer;
    let devices = Object.create(null);
    let device_element = document.createComment("placeholder");
    let device_select;
    let lang_select;
    let run_button;
    let debug_button;
    let test_button;
    let help_button;
    let on_stdin;

    devices.io = io_dev_ui({
        on_input(character) {
            if (on_stdin !== undefined) {
                on_stdin(character);
            }
        }
    });
    devices.rom = rom_ui({});
    devices.svg = svg_dev_ui({
        background_color: "#ffffff"
    });

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
    }

    function set_lang(new_lang) {
        lang_select.value = new_lang;
        test_button.disabled = new_lang !== "asm";
    }

    function stop() {
        clearTimeout(run_loop_timer);
        run_button.textContent = "▶ Run";
        run_button.onclick = function () {
            run(get_text(), "boot");
        };
        if (core !== undefined) {
            core.h_dispose();
        }
    }

    function refill_sponsor() {
        const spn = core.u_ramptr(ufork.SPONSOR_OFS);
        const sponsor = core.u_read_quad(spn);
        sponsor.t = core.u_fixnum(4096);  // memory
        sponsor.x = core.u_fixnum(256);  // events
        sponsor.y = core.u_fixnum(8192);  // cycles
        core.u_write_quad(spn, sponsor);
    }

    function run_loop() {
        const begin = Date.now();
        while (true) {

// Run a step.

            const status = core.h_run_loop(1);

// Are we done?

            if (
                status !== ufork.UNDEF_RAW  // step limit not reached
                && status !== core.u_fixnum(ufork.E_MEM_LIM)
                && status !== core.u_fixnum(ufork.E_CPU_LIM)
                && status !== core.u_fixnum(ufork.E_MSG_LIM)
            ) {
                const message = core.u_fault_msg(core.u_fix_to_i32(status));
                if (status === core.u_fixnum(ufork.E_OK)) {
                    devices.io.info("IDLE:", message);
                } else {
                    devices.io.warn("FAULT:", message);
                    stop();
                }
                return;
            }

// There is work left in the continuation queue. Refill and continue, deferring
// the next iteration if the browser's event loop is being blocked.

            refill_sponsor();
            const elapsed = Date.now() - begin;
            if (elapsed > 20) {
                run_loop_timer = setTimeout(run_loop, 0);
            }
        }
    }

    function warn(...args) {
        set_device("io");
        on_device_change("io");
        devices.io.warn(...args);
    }

    function run(text, entry) {
        stop();

// The module may import modules written in a different language, so provide
// the core with every compiler we have.

        let compilers = Object.create(null);
        Object.entries(lang_packs).forEach(function ([lang, lang_pack]) {
            compilers[lang] = lang_pack.compile;
        });
        core = ufork.make_core({
            wasm_url,
            on_wakeup(device_offset) {
                devices.io.info("WAKE:", device_offset);
                run_loop();
            },
            log_level: ufork.LOG_TRACE,
            on_log(log_level, value) {
                const logger = (
                    log_level === ufork.LOG_WARN
                    ? devices.io.warn
                    : (
                        log_level === ufork.LOG_DEBUG
                        ? devices.io.debug
                        : devices.io.info
                    )
                );
                logger(value);
            },
            import_map,
            compilers
        });
        const {compile, stringify_error} = lang_packs[lang_select.value];
        const ir = compile(text);
        if (ir.errors !== undefined && ir.errors.length > 0) {
            const error_messages = ir.errors.map(stringify_error);
            return warn(error_messages.join("\n"));
        }
        parseq.sequence([
            core.h_initialize(),
            core.h_import(get_src(), ir),
            requestorize(function (imported_module) {
                devices.rom.set_buffer(core.h_snapshot().rom, ir);
                clock_dev(core);
                random_dev(core);
                blob_dev(core);
                timer_dev(core);
                on_stdin = io_dev(core, devices.io.output);
                const make_ddev = host_dev(core);
                svg_dev(core, make_ddev, devices.svg.draw);
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
                run_button.textContent = "⏹ Stop";
                run_button.onclick = stop;
                run_loop();
                return true;
            })
        ])(function callback(value, reason) {
            if (value === undefined) {
                warn(reason.message ?? reason);
            }
        });
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
            dom("option", {value: "rom", textContent: "ROM"})
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
    run_button = dom("button");
    debug_button = dom("button", {
        textContent: "⛐ Debug",
        onclick: on_debug
    });
    test_button = dom("button", {
        textContent: "✔ Test",
        onclick() {
            run(get_text(), "test");
        }
    });
    help_button = dom("button", {
        textContent: "﹖ Help",
        onclick: on_help
    });
    const controls_element = dom("tools_controls", [
        run_button,
        debug_button,
        test_button,
        help_button,
        lang_select,
        device_select
    ]);
    set_device(device);
    set_lang(lang);
    stop();
    shadow.append(style, controls_element, device_element);
    element.set_device = set_device;
    element.set_lang = set_lang;
    element.warn = warn;
});

//debug import lang_asm from "./lang_asm.js";
//debug import lang_scm from "./lang_scm.js";
//debug document.documentElement.innerHTML = "";
//debug document.body.style.background = "black";
//debug const tools = dom(
//debug     tools_ui({
//debug         get_text() {
//debug             return "";
//debug         },
//debug         get_src() {
//debug             return new URL("example.asm", location.href).href;
//debug         },
//debug         lang_packs: {asm: lang_asm, scm: lang_scm},
//debug         on_lang_change: console.log,
//debug         on_device_change: console.log,
//debug         on_debug: () => console.log("on_debug"),
//debug         on_help: () => console.log("on_help")
//debug     }),
//debug     {style: {width: "400px", height: "400px"}}
//debug );
//debug document.body.append(tools);

export default Object.freeze(tools_ui);
