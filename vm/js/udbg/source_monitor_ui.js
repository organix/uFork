// A source code monitor. It centers and highlights the currently executing
// source code, if any.

/*jslint browser, global */

import dom from "https://ufork.org/lib/dom.js";
import make_ui from "https://ufork.org/lib/ui.js";
import theme from "https://ufork.org/lib/theme.js";
const asm_href = import.meta.resolve("https://ufork.org/lib/std.asm");

function keep_centered(child, parent) {
    const child_rect = child.getBoundingClientRect();
    const parent_rect = parent.getBoundingClientRect();
    const offset = parent.scrollTop + child_rect.top - parent_rect.top;
    parent.scrollTop = offset - parent_rect.height / 2 + child_rect.height / 2;
}

const source_monitor_ui = make_ui("source-monitor-ui", function (element, {
    sourcemap
}) {
    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            display: flex;
            contain: strict;
        }
        :host > source_text {
            flex: 1 1;
            font-family: ${theme.monospace_font_family};
            line-height: ${theme.monospace_line_height};
            white-space: pre;
            overflow: auto;
            scrollbar-color: ${theme.gray} transparent;
            padding: 12px;
            background: ${theme.black};
            color: ${theme.white};
        }
    `);
    const source_element = dom("source_text");

    function set_sourcemap(new_sourcemap) {
        sourcemap = new_sourcemap;
        if (sourcemap?.text !== undefined) {
            source_element.title = sourcemap.debug?.src ?? "";
            if (sourcemap.debug.start !== undefined) {
                const before = sourcemap.text.slice(0, sourcemap.debug.start);
                const marked = sourcemap.text.slice(
                    sourcemap.debug.start,
                    sourcemap.debug.end
                );
                const after = sourcemap.text.slice(sourcemap.debug.end);
                const mark = dom("mark", marked);
                source_element.innerHTML = "";
                source_element.append(before, mark, after);
                keep_centered(mark, source_element);
            } else {
                source_element.textContent = sourcemap.text;
            }
            return;
        }
        source_element.textContent = "No source available.";
    }

    shadow.append(style, source_element);
    set_sourcemap(sourcemap);
    element.set_sourcemap = set_sourcemap;
    return {
        connect() {
            const mark = source_element.querySelector("mark");
            if (mark) {
                keep_centered(mark, source_element);
            }
        }
    };
});

function demo() {
    document.documentElement.innerHTML = "";
    const element = source_monitor_ui({});
    element.style.position = "fixed";
    element.style.inset = "0";
    fetch(asm_href).then(function (response) {
        return response.text();
    }).then(function (text) {
        element.set_sourcemap({
            debug: {
                src: asm_href,
                start: 1321,
                end: 1331
            },
            text
        });
        document.body.append(element);
    });
}

if (import.meta.main) {
    demo();
}

export default Object.freeze(source_monitor_ui);
