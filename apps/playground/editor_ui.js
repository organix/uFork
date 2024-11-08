// The playground's text editor component, complete with line numbering.

/*jslint browser, global */

import dom from "./dom.js";
import ed from "./ed.js";
import ed_duplicate from "./ed_duplicate.js";
import ed_indent from "./ed_indent.js";
import ed_join_lines from "./ed_join_lines.js";
import ed_select_paragraph from "./ed_select_paragraph.js";
import ed_select_word from "./ed_select_word.js";
import ed_wrap_lines from "./ed_wrap_lines.js";
import make_ui from "./ui.js";

function render_css(theme, ruler = 80) {
    return `
        ${theme.monospace_font_css}
        :host {
            font-family: ${theme.monospace_font_family}, monospace;
            font-size: 17px;
            line-height: 1.17;
            display: flex;
            white-space: pre;
            align-items: flex-start;
            overflow-y: auto; /* scroll */
            color: white;
            scrollbar-color: ${theme.gray} transparent;
        }
        :host > :not(input) {
            min-height: 100%;
            box-sizing: border-box;
        }
        line_numbers {
            flex: 0 1 0%;
            border-right: 1px solid ${theme.gray};
            padding: 10px 0;
        }
        line_numbers > * {
            display: block;
            padding: 0 10px;
            text-align: right;
            color: gray;
            user-select: none;
        }
        line_numbers > *:hover {
            background: ${theme.gray};
        }
        div {
            flex: 1 1 100%;
            padding: 10px;
            outline: none;
            caret-color: white;
            position: relative; /* for ruler */
        }
        div::before { /* ruler */
            content: " ";
            display: block;
            background: rgba(255, 255, 255, 0.08);
            width: 1px;
            position: absolute;
            z-index: -1;
            left: calc(${ruler}ch + 10px);
            top: 0;
            bottom: 0;
            pointer-events: none;
        }

/* Increase the height of text outlines and backgrounds, allowing multiline
   richtexts to appear as a single block. Applying padding to inline elements
   does not affect computed line height of the text, and the line numbers
   magically adjust to match. */

        div span {
            padding: 2px 0;
        }
        ::selection {

/* The intended color for the selection is an opaque gray, but in Safari under a
   ShadowRoot opaque gray appears black. For now, we approximate theme.gray
   with a translucent white. */

            background-color: rgb(255, 255, 255, 0.2);
        }
    `;
}

const default_theme = {
    gray: "#484848",
    monospace_font_css: "",
    monospace_font_family: "monospace"
};
const editor_ui = make_ui("editor-ui", function (element, {
    text,
    lang,
    lang_packs = {},
    on_text_change,
    theme
}) {
    let editor;
    let line_selection_anchor;

    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style");
    const line_numbers_element = dom("line_numbers");
    const text_element = dom("div"); // Firefox v122

    function end_line_selection() {
        if (line_selection_anchor !== undefined) {
            text_element.focus();
            line_selection_anchor = undefined;
        }
    }

    function update_line_numbers() {
        const lines = editor.get_text().split("\n");
        line_numbers_element.innerHTML = "";
        let position = 0;
        lines.forEach(function (line, line_nr) {
            const nr_element = document.createElement("line_nr");
            nr_element.textContent = line_nr + 1;
            line_numbers_element.append(nr_element);

// Lines can be selected by dragging up and down the line numbers.

            const line_start = position;
            const line_end = position + line.length + (
                line_nr === lines.length - 1
                ? 0 // The last line is not followed by a newline...
                : 1 // ...but every other line is.
            );
            nr_element.onpointerdown = function (event) {
                if (event.buttons === 1) {
                    editor.edit([], [line_start, line_end]);
                    line_selection_anchor = line_start;
                }
            };
            nr_element.onpointerenter = function () {
                if (line_selection_anchor !== undefined) {
                    const cursor = (
                        line_start >= line_selection_anchor
                        ? [line_selection_anchor, line_end]
                        : [line_start, line_selection_anchor]
                    );
                    editor.edit([], cursor);
                }
            };
            position += line.length + 1; // account for \n
        });
    }

    function reset_editor() {
        if (editor !== undefined) {
            editor.destroy();
        }
        style.textContent = render_css(theme, lang_packs[lang]?.ruler);
        text_element.textContent = text;
        editor = ed({
            element: text_element,
            highlight: lang_packs[lang]?.highlight,
            sticky_br: lang_packs[lang]?.sticky_br,
            scrollport: element,
            on_revision(revision) {
                if (revision.patch.length > 0) {
                    update_line_numbers();
                    text = editor.get_text();
                    on_text_change(text);
                }
            },
            on_travel() {
                update_line_numbers();
                text = editor.get_text();
                on_text_change(text);
            },
            on_keydown(event) {
                ed_duplicate(editor, event);
                ed_indent(editor, event, lang_packs[lang]?.indent);
                ed_join_lines(editor, event);
                ed_select_paragraph(editor, event);
                ed_select_word(editor, event);
                ed_wrap_lines(editor, event, lang_packs[lang]?.ruler);
                if (lang_packs[lang]?.handle_keydown !== undefined) {
                    lang_packs[lang].handle_keydown(editor, event);
                }
            }
        });
        update_line_numbers();
    }

    function get_text() {
        return (
            editor !== undefined
            ? editor.get_text()
            : text
        );
    }

    function set_text(new_text) {
        text = new_text;
        if (editor !== undefined) {
            reset_editor();
        }
    }

    function get_lang() {
        return lang;
    }

    function set_lang(the_lang) {
        lang = the_lang;
        if (editor !== undefined) {
            reset_editor();
        }
    }

    function show_cursor() {
        if (editor !== undefined) {
            if (editor.get_cursor() === undefined) {
                editor.edit([], [0, 0]);
            }
            editor.show_cursor();
        }
    }

    function show_warning() {
        if (
            editor !== undefined
            && typeof lang_packs[lang]?.get_warning_ranges === "function"
        ) {
            const ranges = lang_packs[lang].get_warning_ranges();
            if (ranges.length > 0) {
                editor.edit([], ranges[0]);
                editor.show_cursor();
            }
        }
    }

    function focus() {
        text_element.focus();
        show_cursor();
    }

    theme = Object.assign({}, default_theme, theme);
    shadow.append(style, line_numbers_element, text_element);
    element.get_text = get_text;
    element.set_text = set_text;
    element.get_lang = get_lang;
    element.set_lang = set_lang;
    element.show_warning = show_warning;
    element.focus = focus;
    return {
        connect() {
            reset_editor();
            editor.show_cursor();
            addEventListener("pointerup", end_line_selection);
            addEventListener("pointercancel", end_line_selection);
        },
        disconnect() {
            editor.destroy();
            removeEventListener("pointerup", end_line_selection);
            removeEventListener("pointercancel", end_line_selection);
        }
    };
});

if (import.meta.main) {
    document.documentElement.innerHTML = "";
    const editor = editor_ui({
        text: "My little editor\n    With a line break.",
        on_text_change(text) {
            globalThis.console.log("on_text_change", text);
        },
        theme: {monospace_font_family: "Courier New"}
    });
    document.documentElement.style.height = "100%";
    document.body.style.background = "black";
    document.body.style.height = "100%";
    document.body.style.margin = "0";
    editor.style.width = "100%";
    editor.style.height = "100%";
    document.body.append(editor);
    editor.focus();
    editor.show_warning();
}

export default Object.freeze(editor_ui);
