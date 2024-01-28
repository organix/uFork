/*jslint browser */

import webcode from "./webcode.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import tokenize from "https://ufork.org/lib/asm_tokenize.js";
import parse from "https://ufork.org/lib/asm_parse.js";
import assemble from "https://ufork.org/lib/assemble.js";
import ufork from "https://ufork.org/js/ufork.js";
import clock_device from "https://ufork.org/js/clock_device.js";
import random_device from "https://ufork.org/js/random_device.js";
import blob_device from "https://ufork.org/js/blob_device.js";
import timer_device from "https://ufork.org/js/timer_device.js";
import io_device from "https://ufork.org/js/io_device.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");
const dev_lib_url = import.meta.resolve("../../lib/");

const rx_comment = /^(\s*)(;+\u0020?)/;

const clear_output_button = document.getElementById("clear_output");
const line_numbers_element = document.getElementById("line_numbers");
const output_element = document.getElementById("output");
const run_button = document.getElementById("run");
const source_element = document.getElementById("source");
const info_checkbox = document.getElementById("info");

function alter_string(string, alterations) {

// Performs a series of alterations on a string and returns the new string.

// The 'alterations' array contains objects like {range, replacement} where
// 'replacement' is a string to insert at the 'range', an array like
// [start, end] where 'start' and 'end' are positions in the original string.

// The alterations should not overlap.

    alterations = alterations.slice().sort(function compare(a, b) {
        return a.range[0] - b.range[0] || a.range[1] - b.range[1];
    });
    let end = 0;
    return alterations.map(function ({range, replacement}) {
        const chunk = string.slice(end, range[0]) + replacement;
        end = range[1];
        return chunk;
    }).concat(
        string.slice(end)
    ).join(
        ""
    );
}

function encode_bytes_as_data_url(bytes, type) {

// The atob and btoa functions provided by the browser do not support Unicode,
// so the only alternative, apart from reimplementing Base64 ourselves, is to
// abuse the FileReader.

    return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () {
            return resolve(reader.result);
        };
        reader.onerror = function () {
            return reject(reader.error);
        };
        reader.readAsDataURL(new Blob([bytes], {type}));
    });
}

function highlight(element) {
    const source = element.textContent;
    element.innerHTML = "";
    const ast = parse(tokenize(source));
    ast.tokens.forEach(function (token) {
        if (token.kind === "newline") {
            return element.append("\n");
        }
        const text = source.slice(token.start, token.end);
        const errors = ast.errors.filter(function (error) {
            return token.start >= error.start && token.end <= error.end;
        });
        const span = document.createElement("span");
        span.textContent = text;
        span.classList.add(
            token.kind.length === 1
            ? "separator"
            : token.kind
        );
        if (errors.length > 0) {
            span.title = errors.map(function (error) {
                return error.message;
            }).join(
                "\n"
            );
            span.classList.add("warning");
        }
        element.append(span);
    });
}

// The state of the playground is stored in the URL of the page, making it easy
// to share a configuration with others.

function read_state(name) {
    const url = new URL(location.href);
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
    history.replaceState(undefined, "", url);
}

function fetch_source() {
    const text = read_state("text");
    if (text !== undefined) {

// Use 'fetch' to Base64 decode the UTF-8 encoded text.

        const data_url = "data:text/plain;base64," + text;
        return fetch(data_url).then(function (response) {
            return response.text();
        });
    }
    const file = read_state("file");
    if (file !== undefined) {
        return fetch(file).then(function (response) {
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

function append(node) {
    output_element.append(node);
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
    append(div);
}

function update_page_url(text) {
    return encode_bytes_as_data_url(
        new TextEncoder().encode(text),
        "text/plain"
    ).then(function (data_url) {
        write_state("text", data_url.split("base64,")[1]);
    });
}

function run(text) {
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
        )
    });
    const crlf = assemble(text);
    if (crlf.lang !== "uFork") {
        const error_messages = crlf.errors.map(function (error) {
            return `[${error.line}:${error.column}] ${error.message}`;
        });
        return append_output(ufork.LOG_WARN, error_messages.join("\n"));
    }
    const file = read_state("file") ?? "placeholder.asm";
    const specifier = new URL(file, location.href).href;
    parseq.sequence([
        core.h_initialize(),
        core.h_import(specifier, crlf),
        requestorize(function (imported_module) {
            clock_device(core);
            random_device(core);
            blob_device(core);
            timer_device(core);
            on_stdin = io_device(core, function (text) {
                const span = document.createElement("span");
                span.classList.add("io");
                span.textContent = text;
                append(span);
            });
            if (imported_module.boot === undefined) {
                throw new Error("Missing 'boot' export.");
            }
            core.h_boot(imported_module.boot);
            run_loop();
            return true;
        })
    ])(function callback(value, reason) {
        if (value === undefined) {
            append_output(ufork.LOG_WARN, reason.message ?? reason);
        }
    });
}

function update_line_numbers(editor) {
    const text = editor.get_text();
    const lines = text.split("\n");
    let anchor;

    function end_selection() {
        source_element.focus();
        anchor = undefined;
    }

    line_numbers_element.innerHTML = "";
    let position = 0;
    lines.forEach(function (line, line_nr) {
        const element = document.createElement("line_nr");
        element.textContent = line_nr + 1;
        line_numbers_element.append(element);

// Lines can be selected by dragging up and down the line numbers.

        const line_start = position;
        const line_end = position + line.length + 1;
        element.onpointerdown = function () {
            editor.set_cursor([line_start, line_end]);
            anchor = line_start;
        };
        element.onpointerenter = function () {
            if (anchor !== undefined) {
                editor.set_cursor(
                    line_start >= anchor
                    ? [anchor, line_end]
                    : [line_start, anchor]
                );
            }
        };
        element.onpointerup = end_selection;
        element.onpointercancel = end_selection;
        position += line.length + 1; // account for \n
    });
}

const indent = "    ";
const editor = webcode({
    element: source_element,
    highlight,
    on_input(text) {
        update_page_url(text);
        update_line_numbers(editor);
    },
    on_keydown(event) {
        let text = editor.get_text();
        let cursor = editor.get_cursor();
        let cursor_start = Math.min(...cursor);
        let cursor_end = Math.max(...cursor);
        let is_collapsed = cursor_start === cursor_end;
        let pre = text.slice(0, cursor_start);
        let post = text.slice(cursor_end);
        let line_pre = pre.split("\n").pop();
        let line_post = post.split("\n").shift();

// Increase indentation.

        if (event.key === "Tab") {
            event.preventDefault();
            editor.insert_text(indent.slice(line_pre.length % indent.length));
        }

// Decrease indentation.

        if (event.key === "Backspace" && is_collapsed && line_pre.length > 0) {
            const excess = indent.slice(0, 1 + (line_pre.length - 1) % indent.length);
            if (line_pre.endsWith(excess)) {
                event.preventDefault();
                editor.set_cursor([
                    cursor_start - excess.length,
                    cursor_start
                ]);
                editor.insert_text("");
            }
        }

// Increase or maintain indentation following a linebreak.

        if (
            event.key === "Enter"
            && is_collapsed
            && (
                line_pre.endsWith(":")
                || line_pre === ".import"
                || line_pre === ".export"
                || (line_pre.startsWith(indent) && line_pre !== indent)
            )
            && line_post === ""
        ) {
            event.preventDefault();
            editor.insert_text("\n" + indent);
        }

// Comment or uncomment.

        if (event.key === "/" && editor.is_command(event)) {
            event.preventDefault();
            let line_start = cursor_start - line_pre.length;
            let line_end = cursor_end + line_post.length;
            const lines = text.slice(line_start, line_end).split("\n");
            const matches_array = lines.map(function (line) {
                return line.match(rx_comment);
            });
            const uncomment = matches_array.some(Array.isArray);
            let alterations = [];
            let cursor_adjustment = 0;
            lines.forEach(function (line, line_nr) {
                if (uncomment) {
                    const matches = matches_array[line_nr];
                    if (matches) {

// Capturing groups:
//  [1] indentation
//  [2] ";" or "; "

                        if (line_nr === 0 && (
                            cursor_start >= line_start + matches[0].length
                        )) {
                            cursor_start -= matches[2].length;
                        }
                        cursor_end = Math.max(
                            cursor_start,
                            cursor_end - matches[2].length
                        );
                        alterations.push({
                            range: [
                                line_start + matches[1].length,
                                line_start + matches[0].length
                            ],
                            replacement: ""
                        });
                    }
                } else {
                    if (line !== "") {
                        if (line_nr === 0) {
                            cursor_start += 2;
                        }
                        cursor_end += 2;
                        alterations.push({
                            range: [line_start, line_start],
                            replacement: "; "
                        });
                    }
                }
                line_start += line.length + 1; // account for \n
            });
            editor.set_text(alter_string(text, alterations));
            editor.set_cursor(
                cursor[0] <= cursor[1]
                ? [cursor_start, cursor_end]
                : [cursor_end, cursor_start]
            );
        }
    }
});

fetch_source().then(function (text) {
    editor.set_text(text);
    update_line_numbers(editor);
}).catch(function (error) {
    editor.set_text("; Failed to load source: " + error.message);
    update_line_numbers(editor);
});
run_button.onclick = function () {
    run(editor.get_text());
};
clear_output_button.onclick = clear_output;
info_checkbox.oninput = function () {
    output_element.classList.toggle("info");
};
