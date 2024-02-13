// The SVG device draws into an SVG element, based on the commands it receives.

import svg_drawing from "https://ufork.org/lib/svg_drawing.js";

const svg_key = 101; // from dev.asm

function svg_dev(core, make_ddev, svg_element) {
    function svg_append(html) {
        svg_element.innerHTML += html;//`<text x=10 y=10>${html}</text>`;
    }

    const on_code = svg_drawing(svg_append);
    const ddev = make_ddev(function on_event_stub(ptr) {
        const event_stub = core.u_read_quad(ptr);
        const event = core.u_read_quad(event_stub.y);
        const code = core.u_fix_to_i32(event.y);
        on_code(code);
    });
    const svg_proxy = ddev.h_reserve_proxy();
    core.h_install([[core.u_fixnum(svg_key), svg_proxy]]);
}

export default Object.freeze(svg_dev);
