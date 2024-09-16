// The uFork playground's entry point.

// This module is mostly responsible for configuring the split view, handling
// URL state, and persisting user settings.

/*jslint browser */

import dom from "./dom.js";
import theme from "./theme.js";
import lang_asm from "./lang_asm.js";
import lang_hum from "./lang_hum.js";
import lang_scm from "./lang_scm.js";
import tools_ui from "./tools_ui.js";
import editor_ui from "./editor_ui.js";
import split_ui from "./split_ui.js";
import base64 from "https://ufork.org/lib/base64.js";
import gzip from "https://ufork.org/lib/gzip.js";
import unpercent from "https://ufork.org/lib/unpercent.js";
const unqualified_dev_lib_url = import.meta.resolve("../../lib/");

const dev_lib_url = new URL(unqualified_dev_lib_url, location.href).href;
const min_tools_size = 200;
const default_tools_width = 400;
const default_tools_height = 200;
const lang_packs = Object.create(null);
lang_packs.asm = lang_asm;
lang_packs.hum = lang_hum;
lang_packs.scm = lang_scm;
Object.freeze(lang_packs);

let initial_text = "; Write some uFork assembly here...";
let text_override;

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
        } catch (_) {}
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
    return Promise.resolve(initial_text);
}

const editor = editor_ui({
    text: "; Loading...",
    lang_packs,
    on_text_input(text) {
        return (
            (
                text === initial_text
                && text_override === undefined
                && read_state("src") !== undefined
            )
            ? write_state("text", undefined)
            : gzip.encode(text).then(base64.encode).then(function (base64) {
                write_state("text", base64);
            })
        );
    }
});
const tools = tools_ui({
    get_text: editor.get_text,
    get_src() {
        const unqualified_src = read_state("src") ?? "untitled.asm";
        return new URL(unqualified_src, location.href).href;
    },
    lang_packs,
    import_map: (
        location.href.startsWith("https://ufork.org/")
        ? {}
        : {"https://ufork.org/lib/": dev_lib_url}
    ),
    on_lang_change(lang) {
        editor.set_lang(lang);
        write_state("lang", (
            lang !== "asm"
            ? lang
            : undefined // omit default
        ));
    },
    on_device_change(device) {
        write_state("dev", (
            device !== "io"
            ? device
            : undefined // omit default
        ));
    },
    on_debug() {
        window.open(location.href.replace("playground", "debugger"));
    },
    on_help() {
        window.open(lang_packs[editor.get_lang()].docs_url);
    }
});
const split = dom(
    split_ui({
        placement: (
            is_landscape()
            ? "right"
            : "bottom"
        ),
        size: (
            is_landscape()
            ? read_setting("tools_width") ?? default_tools_width
            : read_setting("tools_height") ?? default_tools_height
        ),
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
        dom(editor, {slot: "main"}),
        dom(tools, {slot: "peripheral"})
    ]
);
const src = read_state("src") || "";
const src_extension = src.split(".").pop();
const lang_override = read_state("lang");
text_override = read_state("text");
let lang = lang_override ?? src_extension;
if (lang_packs[lang] === undefined) {
    lang = "asm"; // default
}
editor.set_lang(lang);
tools.set_lang(lang);
tools.set_device(read_state("dev") || "io");
fetch_text().then(function (text) {
    editor.set_text(text);
    initial_text = text;
}).catch(function (error) {
    editor.set_text(initial_text);
    tools.warn("Failed to load source: " + error.message);
});
window.onresize = function () {
    if (is_landscape()) {
        split.set_placement("right");
        split.set_size(read_setting("tools_width") ?? default_tools_width);
    } else {
        split.set_placement("bottom");
        split.set_size(read_setting("tools_height") ?? default_tools_height);
    }
};
document.body.append(split);
