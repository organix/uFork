// Observe and interact with the IO device. Also displays generic textual output
// at a variety of log levels.

/*jslint browser, global */

import dom from "https://ufork.org/lib/dom.js";
import theme from "https://ufork.org/lib/theme.js";
import make_ui from "https://ufork.org/lib/ui.js";

const io_dev_ui = make_ui("io-dev-ui", function (element, {on_input}) {
    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            display: flex;
            flex-direction: column;
            color: white;
            padding: 0 8px 8px;
        }
        io_output {
            font-family: ${theme.monospace_font_family};
            line-height: ${theme.monospace_line_height};
            white-space: pre;
            min-height: 60px;
            overflow: auto;
            scrollbar-color: ${theme.gray} transparent;
            caret-color: white;
            flex: 1 1;
        }
        io_output > .io {
            color: ${theme.yellow};
        }
        io_output > .warn {
            color: ${theme.red};
        }
        io_output > .debug {
            color: white;
        }
        io_output > .info {
            color: gray;
        }
        io_output:not(.show_info) > .info {
            display: none;
        }
        io_controls {
            display: flex;
            justify-content: space-between;
            margin-top: 6px;
        }
        label {
            display: flex;
            align-items: center;
            font-family: ${theme.proportional_font_family};
            font-size: 13px;
        }
    `);
    const text_element = dom("io_output", {
        contentEditable: "true",
        spellcheck: false,
        title: "Input and output",
        className: "show_info",
        onkeydown(event) {
            if (!event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                const glyphs = Array.from(event.key);
                if (glyphs.length === 1) {
                    on_input(event.key);
                } else if (event.key === "Enter") {
                    on_input("\n");
                } else if (event.key !== "Shift") {
                    on_input(String.fromCodePoint(event.keyCode));
                }
            }
        }
    });

    function scroll_to_bottom(animate) {
        text_element.scrollTo({
            top: text_element.scrollHeight,
            left: 0,
            behavior: (
                animate
                ? "smooth"
                : "instant"
            )
        });
    }

    function append_output(level, ...values) {
        text_element.append(dom("span", {
            className: level,
            textContent: values.join(" ")
        }));
        scroll_to_bottom(true);
    }

    function clear_output() {
        text_element.innerHTML = "";
    }

    const controls_element = dom("io_controls", [
        dom("label", {title: "Show extended trace information"}, [
            dom("input", {
                type: "checkbox",
                checked: true,
                oninput() {
                    text_element.classList.toggle("show_info");
                    scroll_to_bottom(false);
                }
            }),
            " Show trace info"
        ]),
        dom("button", {
            textContent: "⨉ Clear",
            onclick: clear_output,
            title: "Clear I/O output"
        })
    ]);

    shadow.append(style, text_element, controls_element);
    element.append_output = append_output;
    element.warn = function (...values) {
        append_output("warn", ...values, "\n");
    };
    element.debug = function (...values) {
        append_output("debug", ...values, "\n");
    };
    element.info = function (...values) {
        append_output("info", ...values, "\n");
    };
    element.output = function (...values) {
        append_output("io", ...values);
    };
    element.clear = clear_output;
});

if (import.meta.main) {
    document.documentElement.innerHTML = "";
    const io_dev = dom(
        io_dev_ui({on_input: globalThis.console.log}),
        {style: {position: "fixed", inset: "0", background: "black"}}
    );
    document.body.append(io_dev);
    io_dev.warn("A warning!");
    io_dev.debug("Debuggage...");
    io_dev.info("INFORMATION");
    io_dev.output("Some IO out");
    io_dev.output("put.");
}

export default Object.freeze(io_dev_ui);
