/*jslint browser */

import ed from "./ed.js";
import lang_asm from "./lang_asm.js";
import lang_scm from "./lang_scm.js";
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
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");
const unqualified_dev_lib_url = import.meta.resolve("../../lib/");

const dev_lib_url = new URL(unqualified_dev_lib_url, location.href).href;
const line_numbers_element = document.getElementById("line_numbers");
const output_element = document.getElementById("output");
const run_button = document.getElementById("run");
const debug_button = document.getElementById("debug");
const test_button = document.getElementById("test");
const clear_output_button = document.getElementById("clear_output");
const help_button = document.getElementById("help");
const source_element = document.getElementById("source");
const info_checkbox = document.getElementById("info");
const lang_select = document.getElementById("lang");
const lang_packs = {
    asm: lang_asm,
    scm: lang_scm
};

let editor;
let lang;
let line_selection_anchor;

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
    history.replaceState(undefined, "", unpercent(url));
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

function clear_output() {
    output_element.textContent = "";
}

function scroll_to_latest_output() {
    output_element.scrollTo({
        top: output_element.scrollHeight,
        left: 0,
        behavior: "smooth"
    });
}

function append_output(log_level, ...values) {
    const div = document.createElement("div");
    div.className = (
        log_level === ufork.LOG_WARN
        ? "warn"
        : (
            log_level === ufork.LOG_DEBUG
            ? "debug"
            : "info"
        )
    );
    div.textContent = values.join(" ");
    output_element.append(div);
    scroll_to_latest_output();
}

function update_page_url(text) {
    return gzip.encode(text).then(base64.encode).then(function (base64) {
        write_state("text", base64);
    });
}

function run(text, entry) {
    let core;
    let on_stdin;

    output_element.contentEditable = "true";
    output_element.spellcheck = false;
    output_element.onkeydown = function (event) {
        if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            const glyphs = Array.from(event.key);
            if (glyphs.length === 1) {
                return on_stdin(event.key);
            }
            if (event.key === "Enter") {
                return on_stdin("\n");
            }
            on_stdin(String.fromCodePoint(event.keyCode));
        }
    };

    function run_loop() {
        const status = core.h_run_loop(0);
        const status_message = core.u_fault_msg(core.u_fix_to_i32(status));
        append_output(ufork.LOG_TRACE, "IDLE:", status_message);
    }

    if (core !== undefined) {
        core.h_dispose();
    }
    core = ufork.make_core({
        wasm_url,
        on_wakeup(device_offset) {
            append_output(ufork.LOG_TRACE, "WAKE:", device_offset);
            run_loop();
        },
        on_log: append_output,
        log_level: ufork.LOG_DEBUG,
        import_map: (
            location.href.startsWith("https://ufork.org/")
            ? {}
            : {"https://ufork.org/lib/": dev_lib_url}
        ),
        compilers: {asm: lang_asm.compile, scm: scm.compile}
    });
    const crlf = lang.compile(text);
    if (crlf.errors !== undefined && crlf.errors.length > 0) {
        const error_messages = crlf.errors.map(lang.stringify_error);
        return append_output(ufork.LOG_WARN, error_messages.join("\n"));
    }
    const unqualified_src = read_state("src") ?? "placeholder.asm";
    const src = new URL(unqualified_src, location.href).href;
    parseq.sequence([
        core.h_initialize(),
        core.h_import(src, crlf),
        requestorize(function (imported_module) {
            clock_dev(core);
            random_dev(core);
            blob_dev(core);
            timer_dev(core);
            on_stdin = io_dev(core, function (text) {
                const span = document.createElement("span");
                span.classList.add("io");
                span.textContent = text;
                output_element.append(span);
                scroll_to_latest_output();
            });
            if (imported_module[entry] === undefined) {
                throw new Error("Missing '" + entry + "' export.");
            }
            if (entry === "test") {
                const make_ddev = host_dev(core);
                const ddev = make_ddev(function on_event_stub(ptr) {
                    const event_stub = core.u_read_quad(ptr);
                    const event = core.u_read_quad(event_stub.y);
                    const message = event.y;
                    if (message === ufork.TRUE_RAW) {
                        append_output(
                            ufork.LOG_DEBUG,
                            "Test passed. You are awesome!"
                        );
                    } else {
                        append_output(
                            ufork.LOG_WARN,
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
            append_output(ufork.LOG_WARN, reason.message ?? reason);
        }
    });
}

function end_line_selection() {
    if (line_selection_anchor !== undefined) {
        source_element.focus();
        line_selection_anchor = undefined;
    }
}

function update_line_numbers(editor) {
    const text = editor.get_text();
    const lines = text.split("\n");

    line_numbers_element.innerHTML = "";
    let position = 0;
    lines.forEach(function (line, line_nr) {
        const element = document.createElement("line_nr");
        element.textContent = line_nr + 1;
        line_numbers_element.append(element);

// Lines can be selected by dragging up and down the line numbers.

        const line_start = position;
        const line_end = position + line.length + 1;
        element.onpointerdown = function (event) {
            if (event.buttons === 1) {
                editor.set_cursor([line_start, line_end]);
                line_selection_anchor = line_start;
            }
        };
        element.onpointerenter = function () {
            if (line_selection_anchor !== undefined) {
                editor.set_cursor(
                    line_start >= line_selection_anchor
                    ? [line_selection_anchor, line_end]
                    : [line_start, line_selection_anchor]
                );
            }
        };
        position += line.length + 1; // account for \n
    });
}

function reset_editor() {
    if (editor !== undefined) {
        editor.destroy();
    }
    editor = ed({
        element: source_element,
        highlight: lang.highlight,
        on_input(text) {
            update_page_url(text);
            update_line_numbers(editor);
        },
        on_keydown(event) {
            lang.handle_keydown(editor, event);
        }
    });
}

function choose_lang(name) {
    if (typeof name !== "string" || !Object.hasOwn(lang_packs, name)) {
        name = "asm"; // default
    }
    lang = lang_packs[name];
    lang_select.value = name;
    reset_editor();
    test_button.disabled = name !== "asm";
}

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
fetch_text().then(function (text) {
    editor.set_text(text);
    update_line_numbers(editor);
}).catch(function (error) {
    editor.set_text("; Failed to load source: " + error.message);
    update_line_numbers(editor);
});
run_button.onclick = function () {
    run(editor.get_text(), "boot");
};
debug_button.onclick = function () {
    window.open(location.href.replace("playground", "debugger"));
};
test_button.onclick = function () {
    run(editor.get_text(), "test");
};
clear_output_button.onclick = clear_output;
help_button.onclick = function () {
    window.open(lang.docs_url);
};
info_checkbox.oninput = function () {
    output_element.classList.toggle("info");
    scroll_to_latest_output();
};
lang_select.oninput = function () {
    choose_lang(lang_select.value);
    write_state("lang", lang_select.value);
};
document.body.onpointerup = end_line_selection;
document.body.onpointercancel = end_line_selection;
