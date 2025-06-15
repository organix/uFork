// The playground's "devtools" panel.

/*jslint browser, global */

import dom from "https://ufork.org/lib/dom.js";
import make_ui from "https://ufork.org/lib/ui.js";
import parseq from "https://ufork.org/lib/parseq.js";
import lazy from "https://ufork.org/lib/rq/lazy.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import unpromise from "https://ufork.org/lib/rq/unpromise.js";
import ufork from "https://ufork.org/js/ufork.js";
import make_core from "https://ufork.org/js/core.js";
import loader from "https://ufork.org/js/loader.js";
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
import fomu from "./fomu.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");

const rx_extension = /\.\w+$/;

function request_and_open_serial_port() {
    return navigator.serial.requestPort().then(function (port) {
        return (
            port.readable
            ? port
            : port.open({baudRate: 115200}).then(function () {
                return port;
            })
        );
    });
}

function generate_rom32(src, content, import_map, compilers, on_trace) {
    let rom_words = new Uint32Array(ufork.QUAD_ROM_MAX * 4);
    rom_words.set(ufork.reserved_rom);
    let rom_top = ufork.reserved_rom.length / 4;

    function alloc_quad() {
        const ptr = ufork.romptr(rom_top);
        rom_top += 1;
        return ptr;
    }

    function read_quad(ptr) {
        return ufork.read_quad(rom_words, ufork.rawofs(ptr));
    }

    function write_quad(ptr, quad) {
        ufork.write_quad(rom_words, ufork.rawofs(ptr), quad);
    }

    function load(ir, imports) {
        return loader.load({ir, imports, alloc_quad, read_quad, write_quad});
    }

    let entry_ptr = alloc_quad();
    return parseq.sequence([
        loader.import({src, content, import_map, compilers, load, on_trace}),
        requestorize(function (module) {

// Jump from the entry point to the boot behavior.

            if (module.boot === undefined) {
                throw new Error("Missing 'boot' export.");
            }
            write_quad(entry_ptr, {
                t: ufork.INSTR_T,
                x: ufork.VM_DUP,
                y: ufork.fixnum(0),
                z: module.boot
            });

// Discard unused ROM.

            rom_words = rom_words.slice(0, rom_top * 4);
            return new Uint8Array(rom_words.buffer);
        })
    ]);
}

function downsize(rom32) {

// Convert a 32-bit ROM to a 16-bit ROM.

    let rom16 = new Uint8Array(rom32.byteLength / 2);
    let data_view = new DataView(rom16.buffer);
    new Uint32Array(rom32.buffer).forEach(function (word, addr) {
        data_view.setUint16(2 * addr, ufork.to_word16(word), false);
    });
    return rom16;
}

const tools_ui = make_ui("tools-ui", function (element, {
    text = "",
    src,
    device,
    viewbox_size,
    lang = "asm",
    lang_packs = {},
    import_map,
    on_lang_change,
    on_device_change,
    on_viewbox_size_change,
    on_attach,
    on_detach,
    on_simulate,
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
    let upload_button;
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
        viewbox_size,
        on_pointer_input(x, y, button_mask) {
            if (h_on_svgin !== undefined) {
                h_on_svgin(x, y, button_mask);
            }
        },
        on_viewbox_size_change
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

    function get_lang() {
        return lang_select.value;
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

    function warn(...args) {
        set_device("io");
        on_device_change("io");
        devices.io.warn(...args);
    }

    function get_compilers() {
        let compilers = Object.create(null);
        Object.entries(lang_packs).forEach(function ([lang, lang_pack]) {
            compilers[lang] = lang_pack.compile;
        });
        return compilers;
    }

    function run_ucode() {
        generate_rom32(
            src,
            text,
            import_map,
            get_compilers(),
            devices.io.info
        )(function (rom32, reason) {
            if (rom32 === undefined) {
                warn(reason);
            } else {
                const rom16 = downsize(rom32);
                on_simulate(rom16);
            }
        });
    }

    function run_fomu() {
        parseq.sequence([
            parseq.parallel([
                unpromise(request_and_open_serial_port),
                generate_rom32(
                    src,
                    text,
                    import_map,
                    get_compilers(),
                    devices.io.info
                )
            ]),
            lazy(function ([port, rom32]) {
                const rom16 = downsize(rom32);
                devices.io.info(`Uploading ${rom16.length} bytes...`);
                return parseq.sequence([
                    fomu.monitor(port),
                    fomu.upload(port, rom16),
                    requestorize(function (nr_packets) {
                        devices.io.info(nr_packets + " packets transferred.");
                        return true;
                    }),
                    fomu.boot(port)
                ]);
            })
        ])(function (raws, reason) {
            if (raws === undefined) {
                warn(reason);
            } else {
                raws.forEach(function (raw) {
                    devices.io.debug(ufork.print(ufork.from_word16(raw)));
                });
                devices.io.info("Fomu idle.");
            }
        });
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

    function run(text, entry, debug) {
        stop();
        core = make_core({
            wasm_url,
            on_wakeup(sender, events) {
                devices.io.info("WAKE:", ufork.print(sender));
                driver.wakeup(sender, events);
            },
            on_txn(...args) {
                driver.txn(...args);
            },
            on_audit(code, evidence, ep, kp) {
                devices.io.warn(
                    "AUDIT:",
                    ufork.fault_msg(code),
                    core.u_pprint(evidence)
                );
                driver.audit(code, evidence, ep, kp);
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
            import_map,
            compilers: get_compilers()
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
        parseq.sequence([
            core.h_initialize(),

// Tweak the src extension to ensure h_import uses the correct compiler for the
// text.

            core.h_import(
                src.replace(rx_extension, "." + get_lang()),
                text
            ),
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
    upload_button = dom(
        "button",
        {
            title: "Upload and run on Fomu FPGA",
            onclick(event) {
                return (
                    event.shiftKey
                    ? run_ucode()
                    : run_fomu()
                );
            }
        },
        [
            dom("img", {
                src: "https://tomu.im/img/logos/fomu.png",
                style: {width: "16px", height: "15px", margin: "0 4px 0 0"}
            }),
            "Fomu"
        ]
    );
    help_button = dom("button", {
        textContent: "﹖ Help",
        onclick: on_help
    });
    const controls_element = dom("tools_controls", [
        boot_button,
        test_button,
        upload_button,
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
    element.set_viewbox_size = devices.svg.set_viewbox_size;
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
            on_viewbox_size_change: globalThis.console.log,
            on_attach: () => globalThis.console.log("on_attach"),
            on_detach: () => globalThis.console.log("on_detach"),
            on_upload: () => globalThis.console.log("on_upload"),
            on_status: () => globalThis.console.log("on_status"),
            on_help: () => globalThis.console.log("on_help")
        }),
        {style: {position: "fixed", inset: "0"}}
    );
    document.head.append(
        dom("meta", {name: "color-scheme", content: "dark"})
    );
    document.body.append(tools);
    tools.set_viewbox_size(64);
}

export default Object.freeze(tools_ui);
