/*jslint browser */

import ed from "./ed.js";
import base64 from "https://ufork.org/lib/base64.js";
import gzip from "https://ufork.org/lib/gzip.js";
import unpercent from "https://ufork.org/lib/unpercent.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
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

let line_selection_anchor;

function alter_string(string, alterations) {

// Performs a series of alterations on a string and returns the new string.

// The 'alterations' array contains objects like {range, replacement} where
// 'replacement' is a string to insert at the 'range', an array like
// [start, end] where 'start' and 'end' are positions in the original string.

// The alterations may be provided in any order, but should not overlap.

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

function alter_cursor(cursor, alterations) {

// Adjusts the cursor to accomodate an array of alterations. The cursor expands
// to encompass any alterations that it overlaps.

    const cursor_start = Math.min(...cursor);
    const cursor_end = Math.max(...cursor);
    let start = cursor_start;
    let end = cursor_end;
    alterations.forEach(function ({range, replacement}) {
        const [range_start, range_end] = range;
        const difference = replacement.length - (range_end - range_start);
        if (cursor_end > range_start) {

// rrrr         rrrr        rrrr        rrrr
//      cccc      cccc       cc       cccc

            end += difference + Math.max(0, range_end - cursor_end);
        }
        if (cursor_start < range_end) {

//      rrrr      rrrr      rrrr         rr       rrrr
// cccc         cccc         cc         cccc        cccc

            start += Math.min(0, range_start - cursor_start);
        } else {

// rrrr
//      cccc

            start += difference;
        }
    });
    return (
        cursor[0] > cursor[1]
        ? [end, start]
        : [start, end]
    );
}

function highlight(element) {
    const text = element.textContent;
    element.innerHTML = "";
    const crlf = assemble(text);
    crlf.tokens.forEach(function (token) {
        if (token.kind === "newline") {
            return element.append("\n");
        }
        const errors = crlf.errors.filter(function (error) {
            return token.start >= error.start && token.end <= error.end;
        });
        const span = document.createElement("span");
        span.textContent = text.slice(token.start, token.end);
        span.classList.add(
            (token.context === undefined && token.kind.length === 1)
            ? "separator"
            : token.context ?? token.kind
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
    if (crlf.errors !== undefined && crlf.errors.length > 0) {
        const error_messages = crlf.errors.map(function (error) {
            return `[${error.line}:${error.column}] ${error.message}`;
        });
        return append_output(ufork.LOG_WARN, error_messages.join("\n"));
    }
    const unqualified_src = read_state("src") ?? "placeholder.asm";
    const src = new URL(unqualified_src, location.href).href;
    parseq.sequence([
        core.h_initialize(),
        core.h_import(src, crlf),
        requestorize(function (imported_module) {
            clock_device(core);
            random_device(core);
            blob_device(core);
            timer_device(core);
            on_stdin = io_device(core, function (text) {
                const span = document.createElement("span");
                span.classList.add("io");
                span.textContent = text;
                output_element.append(span);
                scroll_to_latest_output();
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

const indent = "    ";
const editor = ed({
    element: source_element,
    highlight,
    on_input(text) {
        update_page_url(text);
        update_line_numbers(editor);
    },
    on_keydown(event) {
        const text = editor.get_text();
        const cursor = editor.get_cursor();
        const cursor_start = Math.min(...cursor);
        const cursor_end = Math.max(...cursor);
        const is_collapsed = cursor_start === cursor_end;
        const pre = text.slice(0, cursor_start);
        const post = text.slice(cursor_end);
        const line_pre = pre.split("\n").pop();
        const line_post = post.split("\n").shift();

// Increase indentation.

        if (event.key === "Tab") {
            event.preventDefault();
            editor.insert_text(indent.slice(line_pre.length % indent.length));
        }

// Decrease indentation.

        if (event.key === "Backspace" && is_collapsed && line_pre.length > 0) {
            const excess = indent.slice(
                0,
                1 + (line_pre.length - 1) % indent.length
            );
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
            lines.forEach(function (line, line_nr) {
                if (uncomment) {
                    const matches = matches_array[line_nr];
                    if (matches) {

// Capturing groups:
//  [1] indentation
//  [2] semicolon(s) optionally followed by a space

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
                        alterations.push({
                            range: [line_start, line_start],
                            replacement: "; "
                        });
                    }
                }
                line_start += line.length + 1; // account for \n
            });
            editor.set_text(alter_string(text, alterations));
            editor.set_cursor(alter_cursor(cursor, alterations));
        }
    }
});

fetch_text().then(function (text) {
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
    scroll_to_latest_output();
};
document.body.onpointerup = end_line_selection;
document.body.onpointercancel = end_line_selection;
