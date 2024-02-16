// The playground's text editor component, complete with line numbers and
// syntax highlighting.

/*jslint browser */

import make_ui from "./ui.js";
import element from "./element.js";
import theme from "./theme.js";
import ed from "./ed.js";

const editor_ui = make_ui("editor-ui", function (host, {
    text = "",
    lang,
    on_text_input
}) {
    const shadow = host.attachShadow({mode: "closed"});
    const style = element("style", `
        ${theme.monospace_font_css}
        :host {
            font-family: ${theme.monospace_font_family}, monospace;
            display: flex;
            white-space: pre;
            align-items: flex-start;
            overflow-y: auto; /* scroll */
            color: white;
        }
        :host > * {
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
        source_code {
            flex: 1 1 100%;
            padding: 10px;
            outline: none;
            caret-color: white;
            position: relative; /* for ruler */
        }
        source_code::before { /* ruler */
            content: " ";
            display: block;
            background: ${theme.gray};
            width: 1px;
            position: absolute;
            z-index: -1;
            left: calc(80ch + 10px);
            top: 0;
            bottom: 0;
            pointer-events: none;
        }
        ::selection {
            background-color: ${theme.gray};
        }
    `);
    const line_numbers_element = element("line_numbers");
    const text_element = element("source_code");

    let line_selection_anchor;
    let editor;

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
            const line_end = position + line.length + 1;
            nr_element.onpointerdown = function (event) {
                if (event.buttons === 1) {
                    editor.set_cursor([line_start, line_end]);
                    line_selection_anchor = line_start;
                }
            };
            nr_element.onpointerenter = function () {
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
            element: text_element,
            highlight: lang?.highlight,
            on_input(text) {
                update_line_numbers();
                on_text_input(text);
            },
            on_keydown(event) {
                if (lang?.handle_keydown !== undefined) {
                    lang.handle_keydown(editor, event);
                }
            }
        });
    }

    function get_text() {
        return text;
    }

    function set_text(the_text) {
        text = the_text;
        if (editor !== undefined) {
            editor.set_text(text);
            update_line_numbers();
        }
    }

    function set_lang(the_lang) {
        lang = the_lang;
        if (editor !== undefined) {
            reset_editor();
        }
    }

    shadow.append(style, line_numbers_element, text_element);
    host.get_text = get_text;
    host.set_text = set_text;
    host.set_lang = set_lang;
    return {
        connect() {
            reset_editor();
            set_text(text);
            window.addEventListener("pointerup", end_line_selection);
            window.addEventListener("pointercancel", end_line_selection);
        },
        disconnect() {
            editor.destroy();
            window.removeEventListener("pointerup", end_line_selection);
            window.removeEventListener("pointercancel", end_line_selection);
        }
    };
});

//debug document.documentElement.innerHTML = "";
//debug const editor = editor_ui({
//debug     text: "hello there",
//debug     on_text_input: console.log
//debug });
//debug document.documentElement.style.height = "100%";
//debug document.body.style.background = "black";
//debug document.body.style.height = "100%";
//debug document.body.style.margin = "0";
//debug editor.style.width = "100%";
//debug editor.style.height = "100%";
//debug document.body.append(editor);

export default Object.freeze(editor_ui);
