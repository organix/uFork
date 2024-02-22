/*jslint browser */

import lang_asm from "./lang_asm.js";
import lang_scm from "./lang_scm.js";
import element from "./element.js";
import editor_ui from "./editor_ui.js";
import split_ui from "./split_ui.js";
import io_dev_ui from "./io_dev_ui.js";
import svg_dev_ui from "./svg_dev_ui.js";
import theme from "./theme.js";
import base64 from "https://ufork.org/lib/base64.js";
import gzip from "https://ufork.org/lib/gzip.js";
import unpercent from "https://ufork.org/lib/unpercent.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import scm from "https://ufork.org/lib/scheme.js";
import ufork from "https://ufork.org/js/ufork.js";
import clock_dev from "https://ufork.org/js/clock_dev.js";
import random_dev from "https://ufork.org/js/random_dev.js";
import blob_dev from "https://ufork.org/js/blob_dev.js";
import timer_dev from "https://ufork.org/js/timer_dev.js";
import io_dev from "https://ufork.org/js/io_dev.js";
import host_dev from "https://ufork.org/js/host_dev.js";
import svg_dev from "https://ufork.org/js/svg_dev.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");
const unqualified_dev_lib_url = import.meta.resolve("../../lib/");

const dev_lib_url = new URL(unqualified_dev_lib_url, location.href).href;
const tools_element = document.getElementById("tools");
const buttons_element = document.getElementById("buttons");
const run_button = document.getElementById("run");
const debug_button = document.getElementById("debug");
const test_button = document.getElementById("test");
const help_button = document.getElementById("help");
const device_select = document.getElementById("device");
const lang_select = document.getElementById("lang");
const lang_packs = {
    asm: lang_asm,
    scm: lang_scm
};
const min_tools_size = 200;
const default_tools_size = 300;

let on_stdin;
let lang;

function is_landscape() {
    return document.documentElement.clientWidth >= 720;
}

// The state of the playground is stored in the URL of the page, making it easy
// to share a configuration with others.

function read_state(name) {

// The URL constructor interprets "+" characters as spaces, corrupting
// Base64-encoded data. This quirk is avoided by first percent-encoding any
// pluses.

    const url = new URL(location.href.replaceAll("+", "%2B"));
    if (url.searchParams.has(name)) {
        return url.searchParams.get(name);
    }
}

function write_state(name, value) {
    const url = new URL(location.href);
    if (value !== undefined) {
        url.searchParams.set(name, value);
    } else {
        url.searchParams.delete(name);
    }

// Ensure the very long 'text' param appears at the end of the URL, making it
// easier to edit the other params manually.

    if (name !== "text" && url.searchParams.has("text")) {
        const text = url.searchParams.get("text");
        url.searchParams.delete("text");
        url.searchParams.set("text", text);
    }
    history.replaceState(undefined, "", unpercent(url));
}

// The user's settings are stored in localStorage.

function read_settings_object() {
    const json = localStorage.getItem("settings");
    if (typeof json === "string") {
        try {
            return JSON.parse(json);
        } catch (ignore) {}
    }
    return {};
}

function read_setting(name) {
    return read_settings_object()[name];
}

function write_setting(name, value) {
    let object = read_settings_object();
    object[name] = value;
    localStorage.setItem("settings", JSON.stringify(object));
}

function fetch_text() {
    const text = read_state("text");
    if (text !== undefined) {
        return base64.decode(text).then(gzip.decode).then(function (utf8) {
            return new TextDecoder().decode(utf8);
        });
    }
    const src = read_state("src");
    if (src !== undefined) {
        return fetch(src).then(function (response) {
            return (
                response.ok
                ? response.text()
                : Promise.reject(new Error(response.status))
            );
        });
    }
    return Promise.resolve("; Write some uFork assembly here...");
}

function update_page_url(text) {
    return gzip.encode(text).then(base64.encode).then(function (base64) {
        write_state("text", base64);
    });
}

const io_dev_element = io_dev_ui({
    on_input(character) {
        on_stdin(character);
    }
});
const svg_dev_element = svg_dev_ui({
    background_color: "#ffffff"
});

function choose_device(name) {
    if (name === "svg") {
        io_dev_element.remove();
        tools_element.insertBefore(svg_dev_element, buttons_element);
        device_select.value = "svg";
        write_state("dev", "svg");
    } else {
        svg_dev_element.remove();
        tools_element.insertBefore(io_dev_element, buttons_element);
        device_select.value = "io";
        write_state("dev", undefined);
    }
}

function run(text, entry) {
    let core;

    function run_loop() {
        const status = core.h_run_loop(0);
        const status_message = core.u_fault_msg(core.u_fix_to_i32(status));
        io_dev_element.info("IDLE:", status_message);
    }

    if (core !== undefined) {
        core.h_dispose();
    }
    core = ufork.make_core({
        wasm_url,
        on_wakeup(device_offset) {
            io_dev_element.info("WAKE:", device_offset);
            run_loop();
        },
        log_level: ufork.LOG_DEBUG,
        on_log(log_level, value) {
            const logger = (
                log_level === ufork.LOG_WARN
                ? io_dev_element.warn
                : (
                    log_level === ufork.LOG_DEBUG
                    ? io_dev_element.debug
                    : io_dev_element.info
                )
            );
            logger(value);
        },
        import_map: (
            location.href.startsWith("https://ufork.org/")
            ? {}
            : {"https://ufork.org/lib/": dev_lib_url}
        ),
        compilers: {asm: lang_asm.compile, scm: scm.compile}
    });
    const ir = lang.compile(text);
    if (ir.errors !== undefined && ir.errors.length > 0) {
        const error_messages = ir.errors.map(lang.stringify_error);
        choose_device("io");
        return io_dev_element.warn(error_messages.join("\n"));
    }
    const unqualified_src = read_state("src") ?? "untitled.asm";
    const src = new URL(unqualified_src, location.href).href;
    parseq.sequence([
        core.h_initialize(),
        core.h_import(src, ir),
        requestorize(function (imported_module) {
            clock_dev(core);
            random_dev(core);
            blob_dev(core);
            timer_dev(core);
            on_stdin = io_dev(core, io_dev_element.output);
            const make_ddev = host_dev(core);
            svg_dev(core, make_ddev, svg_dev_element.draw);
            if (imported_module[entry] === undefined) {
                throw new Error("Missing '" + entry + "' export.");
            }
            if (entry === "test") {
                const ddev = make_ddev(function on_event_stub(ptr) {
                    const event_stub = core.u_read_quad(ptr);
                    const event = core.u_read_quad(event_stub.y);
                    const message = event.y;
                    choose_device("io");
                    if (message === ufork.TRUE_RAW) {
                        io_dev_element.debug("Test passed. You are awesome!");
                    } else {
                        io_dev_element.warn(
                            "Test failed:",
                            core.u_pprint(message)
                        );
                    }
                    core.h_dispose();
                });
                const verdict = ddev.h_reserve_proxy();
                const state = core.h_reserve_ram({
                    t: ufork.PAIR_T,
                    x: verdict,
                    y: ufork.NIL_RAW
                });
                core.h_boot(imported_module[entry], state);
            } else {
                core.h_boot(imported_module[entry]);
            }
            run_loop();
            return true;
        })
    ])(function callback(value, reason) {
        if (value === undefined) {
            choose_device("io");
            io_dev_element.warn(reason.message ?? reason);
        }
    });
}

const editor = editor_ui({
    text: "; Loading...",
    on_text_input: update_page_url
});

function choose_lang(name) {
    if (typeof name !== "string" || !Object.hasOwn(lang_packs, name)) {
        name = "asm"; // default
    }
    lang = lang_packs[name];
    lang_select.value = name;
    test_button.disabled = name !== "asm";
    editor.set_lang(lang);
    write_state("lang", (
        name !== "asm"
        ? name
        : undefined
    ));
}

const split = element(
    split_ui({
        placement: (
            is_landscape()
            ? "right"
            : "bottom"
        ),
        size: read_setting(
            is_landscape()
            ? "tools_width"
            : "tools_height"
        ) ?? default_tools_size,
        divider_color: theme.gray,
        divider_width: "3px",
        on_drag(size) {
            write_setting(
                (
                    is_landscape()
                    ? "tools_width"
                    : "tools_height"
                ),
                Math.floor(size)
            );
            return size >= min_tools_size;
        }
    }),
    {style: {width: "100%", height: "100%"}},
    [
        element(editor, {slot: "main"}),
        element(tools_element, {slot: "peripheral"})
    ]
);
Object.keys(lang_packs).forEach(function (name) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    lang_select.append(option);
});
const src = read_state("src") || "";
const src_extension = src.split(".").pop();
const lang_override = read_state("lang");
choose_lang(lang_override ?? src_extension);
choose_device(read_state("dev") || "io");
fetch_text().then(function (text) {
    editor.set_text(text);
}).catch(function (error) {
    editor.set_text("; Failed to load source: " + error.message);
});
run_button.onclick = function () {
    run(editor.get_text(), "boot");
    // run_button.textContent = "⏹ Stop";
};
debug_button.onclick = function () {
    window.open(location.href.replace("playground", "debugger"));
};
test_button.onclick = function () {
    run(editor.get_text(), "test");
};
help_button.onclick = function () {
    window.open(lang.docs_url);
};
device_select.oninput = function () {
    choose_device(device_select.value);
};
lang_select.oninput = function () {
    choose_lang(lang_select.value);
};
window.onresize = function () {
    if (is_landscape()) {
        split.set_placement("right");
        split.set_size(read_setting("tools_width") ?? default_tools_size);
    } else {
        split.set_placement("bottom");
        split.set_size(read_setting("tools_height") ?? default_tools_size);
    }
};
document.body.append(split);
