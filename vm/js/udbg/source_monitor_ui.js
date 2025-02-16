// A source code monitor. It centers and highlights the currently executing
// source code, if any.

/*jslint browser, global */

import dom from "https://ufork.org/lib/dom.js";
const asm_href = import.meta.resolve("https://ufork.org/lib/std.asm");

function keep_centered(child, parent) {
    const child_rect = child.getBoundingClientRect();
    const parent_rect = parent.getBoundingClientRect();
    const offset = parent.scrollTop + child_rect.top - parent_rect.top;
    parent.scrollTop = offset - parent_rect.height / 2 + child_rect.height / 2;
}

function source_monitor_ui({sourcemap}) {
    const element = dom("source_monitor-ui", {
        style: {
            display: "block",
            color: "#F6F",
            fontFamily: "monospace",
            whiteSpace: "pre",
            flex: "1 1",
            overflow: "auto"
        }
    });

    function set_sourcemap(new_sourcemap) {
        sourcemap = new_sourcemap;
        if (sourcemap?.text !== undefined) {
            element.textContent = sourcemap.text;
            element.title = sourcemap.debug?.src ?? "";
            if (sourcemap.debug.start !== undefined) {
                const before = sourcemap.text.slice(0, sourcemap.debug.start);
                const marked = sourcemap.text.slice(
                    sourcemap.debug.start,
                    sourcemap.debug.end
                );
                const after = sourcemap.text.slice(sourcemap.debug.end);
                const mark = dom("mark", {textContent: marked});
                element.innerHTML = "";
                element.append(before, mark, after);
                keep_centered(mark, element);
            }
            return;
        }
        element.textContent = "No source available.";
    }

    set_sourcemap(sourcemap);
    element.set_sourcemap = set_sourcemap;
    return element;
}

function demo() {
    document.documentElement.innerHTML = "";
    const element = source_monitor_ui({});
    element.style.position = "fixed";
    element.style.inset = "0";
    document.body.append(element);
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
    });
}

if (import.meta.main) {
    demo();
}

export default Object.freeze(source_monitor_ui);
