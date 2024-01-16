/*jslint browser, devel */

import {CodeJar} from "./codejar_4.2.0.js"; // https://esm.sh/codejar@4.2.0
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import tokenize from "https://ufork.org/lib/asm_tokenize.js";
import parse from "https://ufork.org/lib/asm_parse.js";
import assemble from "https://ufork.org/lib/assemble.js";
import ufork from "https://ufork.org/js/ufork.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");
const dev_lib_url = import.meta.resolve("../../lib/");

const clear_output_button = document.getElementById("clear_output");
const output_element = document.getElementById("output");
const run_button = document.getElementById("run");

function entityify(string) {

// The 'entityify' function escapes any potentially dangerous characters in a
// string that is to be interpreted as HTML.

    return string.replace(
        /&/g,
        "&amp;"
    ).replace(
        /</g,
        "&lt;"
    ).replace(
        />/g,
        "&gt;"
    ).replace(
        /\\/g,
        "&bsol;"
    ).replace(
        /"/g,
        "&quot;"
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

function alter_string(string, alterations) {

// The 'alter_string' function applies an array of substitutions to a string.
// The ranges of the alterations must be disjoint. The 'alterations' parameter
// is an array of arrays like [range, replacement] where the range is an object
// like {start, end}.

    alterations = alterations.slice().sort(function compare(a, b) {
        return a[0].start - b[0].start || a[0].end - b[0].end;
    });
    let end = 0;
    return alterations.map(function ([range, replacement]) {
        const chunk = string.slice(end, range.start) + replacement;
        end = range.end;
        return chunk;
    }).concat(
        string.slice(end)
    ).join(
        ""
    );
}

function highlight(element) {
    const source = element.textContent;
    const ast = parse(tokenize(source));
    let alterations = [];
    ast.tokens.forEach(function (token) {
        const errors = ast.errors.filter(function (error) {
            return token.start >= error.start && token.end <= error.end;
        });
        const title = errors.map(function (error) {
            return error.message;
        }).join(
            "\n"
        );
        const classes = (
            token.kind.length === 1
            ? "separator"
            : token.kind
        ) + (
            errors.length > 0
            ? " warning"
            : ""
        );
        const text = source.slice(token.start, token.end);
        alterations.push([
            token,
            (
                "<span class=\""
                + classes
                + "\" title=\""
                + entityify(title)
                + "\">"
                + entityify(text)
                + "</span>"
            )
        ]);
    });
    element.innerHTML = alter_string(source, alterations);
}

const jar = new CodeJar(
    document.getElementById("editor"),
    highlight,
    {tab: "    "}
);

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

function update_page_url() {
    return encode_bytes_as_data_url(
        new TextEncoder().encode(jar.toString()),
        "text/plain"
    ).then(function (data_url) {
        write_state("text", data_url.split("base64,")[1]);
    });
}

function clear_output() {
    output_element.textContent = "";
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
}

function run() {
    let core;

    function run_loop() {
        const status = core.h_run_loop(0);
        const status_message = core.u_fault_msg(core.u_fix_to_i32(status));
        append_output(ufork.LOG_TRACE, "IDLE:", status_message);
    }

    core = ufork.make_core({
        wasm_url,
        on_wakeup(device_offset) {
            append_output(ufork.LOG_TRACE, "WAKE:", device_offset);
            console.log("WAKE:", device_offset);
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
    const crlf = assemble(jar.toString());
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

fetch_source().then(function (source) {
    jar.updateCode(source);
    jar.onUpdate(update_page_url);
}).catch(function (error) {
    jar.updateCode("; Failed to load source: " + error.message);
});
run_button.onclick = run;
clear_output_button.onclick = clear_output;
