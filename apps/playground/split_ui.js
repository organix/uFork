// A split view with draggable divider.

// It renders two slots, "main" and "peripheral", on either side of the divider.
// Each slot should receive exactly one element before the <split-ui> element is
// connected to the document.

// The peripheral is given a 'placement': "right", "bottom", "left", or "top".

// The 'size' is the width or height of the peripheral element, depending on the
// placement.

// The 'on_drag' function is called continually as the divider is dragged. If it
// returns true, the gesture will have a visible effect. If it returns false,
// the gesture will do nothing.

/*jslint browser */

import make_ui from "./ui.js";
import dom from "./dom.js";

const split_ui = make_ui("split-ui", function (element, {
    placement = "right",
    size = 100,
    divider_color = "black",
    divider_width = "1px",
    on_drag = function () {
        return true;
    }
}) {
    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            display: flex;
        }
        ::slotted([slot=main]) {
            flex: 1 1;
        }
        div {
            background: ${divider_color};
            touch-action: none; /* suppress pointercancel events on Chrome */
        }
        div:hover {
            filter: brightness(1.5);
        }
    `);
    const main_slot = dom("slot", {name: "main"});
    const peripheral_slot = dom("slot", {name: "peripheral"});
    let drag_origin;

    function set_size(the_size) {
        size = the_size;
        const peripheral = peripheral_slot.assignedElements()[0];
        if (peripheral !== undefined) {
            if (placement === "top" || placement === "bottom") {
                peripheral.style.width = "auto";
                peripheral.style.height = size + "px";
            } else {
                peripheral.style.width = size + "px";
                peripheral.style.height = "auto";
            }
        }
    }

    function end_divider_drag() {
        drag_origin = undefined;
    }

    const divider = dom("div", {
        onpointerdown(event) {
            const peripheral = peripheral_slot.assignedElements()[0];
            if (peripheral !== undefined && event.buttons === 1) {
                event.preventDefault();
                event.target.setPointerCapture(event.pointerId);
                drag_origin = (
                    placement === "bottom"
                    ? peripheral.clientHeight + event.pageY
                    : (
                        placement === "top"
                        ? peripheral.clientHeight - event.pageY
                        : (
                            placement === "left"
                            ? peripheral.clientWidth - event.pageX
                            : peripheral.clientWidth + event.pageX
                        )
                    )
                );
            }
        },
        onpointermove(event) {
            if (Number.isFinite(drag_origin)) {
                event.preventDefault();
                const the_size = drag_origin + (
                    placement === "bottom"
                    ? -event.pageY
                    : (
                        placement === "top"
                        ? event.pageY
                        : (
                            placement === "left"
                            ? event.pageX
                            : -event.pageX
                        )
                    )
                );
                if (on_drag(the_size)) {
                    set_size(the_size);
                }
            }
        },
        onpointerup: end_divider_drag,
        onpointercancel: end_divider_drag
    });

    function set_placement(the_placement) {
        placement = the_placement;
        if (placement === "top" || placement === "bottom") {
            element.style.flexDirection = (
                placement === "top"
                ? "column-reverse"
                : "column"
            );
            divider.style.width = "auto";
            divider.style.height = divider_width;
            divider.style.cursor = "ns-resize";
        } else {
            element.style.flexDirection = (
                placement === "left"
                ? "row-reverse"
                : "row"
            );
            divider.style.width = divider_width;
            divider.style.height = "auto";
            divider.style.cursor = "ew-resize";
        }
    }

    shadow.append(style, main_slot, divider, peripheral_slot);
    element.set_placement = set_placement;
    element.set_size = set_size;
    return {
        connect() {
            set_placement(placement);
            set_size(size);
        }
    };
});

//debug document.documentElement.innerHTML = "";
//debug const placements = ["right", "bottom", "left", "top"];
//debug let placement_nr = 0;
//debug const split = dom(
//debug     split_ui({
//debug         placement: placements[placement_nr],
//debug         size: 50,
//debug         on_drag(divider_width) {
//debug             console.log("on_drag", divider_width);
//debug             return true;
//debug         },
//debug         divider_color: "green",
//debug         divider_width: "5px"
//debug     }),
//debug     {style: {width: "400px", height: "400px"}},
//debug     [
//debug         dom("div", {
//debug             style: {backgroundColor: "red"},
//debug             slot: "main"
//debug         }),
//debug         dom("div", {
//debug             style: {backgroundColor: "blue"},
//debug             slot: "peripheral"
//debug         })
//debug     ]
//debug );
//debug const button = dom("button", {
//debug     textContent: "Toggle placement",
//debug     onclick() {
//debug         placement_nr = (placement_nr + 1) % placements.length;
//debug         split.set_placement(placements[placement_nr]);
//debug         split.set_size(100);
//debug     }
//debug });
//debug document.body.append(split, button);

export default Object.freeze(split_ui);
