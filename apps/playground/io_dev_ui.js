// Observe and interact with the IO device. Also capable of displaying generic
// textual output at a variety of log levels.

/*jslint browser */

import make_ui from "./ui.js";
import element from "./element.js";
import theme from "./theme.js";

const io_dev_ui = make_ui("io-dev-ui", function (host, {on_input}) {
    const shadow = host.attachShadow({mode: "closed"});
    const style = element("style", `
        :host {
            display: flex;
            flex-direction: column;
            color: white;
        }
        ${theme.monospace_font_css}
        io_output {
            font-family: ${theme.monospace_font_family}, monospace;
            line-height: 1.3;
            white-space: pre;
            min-height: 60px;
            overflow: auto;
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
            margin-top: 5px;
        }
        label {
            font-family: system-ui;
            font-size: 15px;
        }
    `);
    const text_element = element("io_output", {
        contentEditable: "true",
        spellcheck: false,
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
        text_element.append(element("span", {
            className: level,
            textContent: values.join(" ")
        }));
        scroll_to_bottom(true);
    }

    function clear_output() {
        text_element.innerHTML = "";
    }

    const controls_element = element("io_controls", [
        element("label", [
            element("input", {
                type: "checkbox",
                oninput() {
                    text_element.classList.toggle("show_info");
                    scroll_to_bottom(false);
                }
            }),
            " Show info"
        ]),
        element("button", {
            textContent: "⨉ Clear",
            onclick: clear_output
        })
    ]);

    shadow.append(style, text_element, controls_element);
    host.append_output = append_output;
    host.warn = function (...values) {
        append_output("warn", ...values, "\n");
    };
    host.debug = function (...values) {
        append_output("debug", ...values, "\n");
    };
    host.info = function (...values) {
        append_output("info", ...values, "\n");
    };
    host.output = function (...values) {
        append_output("io", ...values);
    };
    host.clear = clear_output;
});

//debug document.documentElement.innerHTML = "";
//debug const io_dev = element(
//debug     io_dev_ui({on_input: console.log}),
//debug     {style: {width: "400px", height: "400px", background: "black"}}
//debug );
//debug document.body.append(io_dev);
//debug io_dev.warn("A warning!");
//debug io_dev.debug("Debuggage...");
//debug io_dev.info("INFORMATION");
//debug io_dev.output("Some IO out");
//debug io_dev.output("put.");

export default Object.freeze(io_dev_ui);
