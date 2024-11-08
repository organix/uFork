// Observe the output of the SVG device.

// Planned feature: accept input from the mouse.

/*jslint browser */

import make_ui from "./ui.js";
import dom from "./dom.js";
import theme from "./theme.js";

const svg_dev_ui = make_ui("svg-dev-ui", function (element, {
    viewbox_size = 32, // defaults to slider's halfway position
    max_viewbox_size = 1024,
    background_color = "#ffffff"
}) {
    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            display: flex;
            flex-direction: column;
        }
        svg {
            border-radius: 2px;
            flex: 1 1;
        }
        svg_controls {
            font-family: system-ui;
            font-size: 15px;
            color: white;
            display: flex;
            align-items: flex-start;
        }
        svg_pickers {
            flex: 1 1;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }
        label,
        button {
            margin-top: 8px;
        }
        label {
            display: flex;
            align-items: center;
            font-weight: bold;
        }
        input {
            margin: 0 10px;
        }
        svg_dimensions {
            color: ${theme.silver};
            font-weight: normal;
        }
    `);
    const svg_element = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
    );
    svg_element.setAttribute("fill", "transparent");
    svg_element.setAttribute("stroke", "transparent");
    const dimensions_element = dom("svg_dimensions");
    let scale_input;
    let background_input;

    function set_viewbox_size(new_viewbox_size) {
        viewbox_size = new_viewbox_size;
        svg_element.setAttribute(
            "viewBox",
            "0 0 " + viewbox_size + " " + viewbox_size
        );
        dimensions_element.textContent = (
            Math.round(viewbox_size) + "x" + Math.round(viewbox_size)
        );
        scale_input.value = Math.log(viewbox_size) / Math.log(max_viewbox_size);
    }

    function set_background_color(new_background_color) {
        background_color = new_background_color;
        svg_element.style.background = background_color;
        background_input.value = background_color;
    }

    background_input = dom("input", {
        type: "color",
        oninput() {
            set_background_color(background_input.value);
        }
    });
    scale_input = dom("input", {
        type: "range",
        min: 0,
        max: 1,
        step: 0.01,
        oninput() {
            const scale = parseFloat(scale_input.value);
            set_viewbox_size(Math.round(max_viewbox_size ** scale));
        }
    });
    const controls_element = dom("svg_controls", [
        dom("svg_pickers", [
            dom(
                "label",
                {title: "Adjust the drawing's viewbox"},
                ["Scale", scale_input, dimensions_element]
            ),
            dom(
                "label",
                {title: "Change the drawing's background color"},
                ["Background", background_input]
            )
        ]),
        dom("button", {
            textContent: "⨉ Clear",
            title: "Clear the drawing",
            onclick() {
                svg_element.innerHTML = "";
            }
        })
    ]);

    function draw(html) {
        svg_element.innerHTML += html;
    }

    set_background_color(background_color);
    set_viewbox_size(viewbox_size);
    shadow.append(style, svg_element, controls_element);
    element.title = "SVG drawing";
    element.draw = draw;
    element.set_viewbox_size = set_viewbox_size;
    element.set_background_color = set_background_color;
});

if (import.meta.main) {
    document.documentElement.innerHTML = "";
    document.body.style.background = "black";
    const svg_dev = dom(
        svg_dev_ui({viewbox_size: 24, background_color: "#FF99FF"}),
        {style: {width: "400px", height: "400px"}}
    );
    document.body.append(svg_dev);
    svg_dev.draw(`
        <circle cx="12" cy="12" r="12" stroke="red" />
    `);
    //svg_dev.set_background_color("#99FF99");
    //svg_dev.set_viewbox_size(100);
}

export default Object.freeze(svg_dev_ui);
