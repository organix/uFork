// The SVG device draws into an SVG element, based on the commands it receives.

/*jslint browser */

import ufork from "./ufork.js";
import svg_drawing from "https://ufork.org/lib/svg_drawing.js";

const svg_key = 101; // from dev.asm

// A write request looks like (to_cancel callback fixnum),
// where to_cancel is the optional customer for a cancel capability,
// and callback is the customer that will receive the result.
// The result looks like (#unit) on success, and (#? . error) on failure.

function svg_dev(core, make_ddev, svg_element) {
    function on_event_stub(event_stub_ptr) {
        const event_stub = core.u_read_quad(event_stub_ptr);
        const event = core.u_read_quad(event_stub.y);
        const sponsor = event.t;
        const msg = event.y;
        const callback = core.u_nth(msg, 2);
        if (!core.u_is_cap(callback)) {
            return ufork.E_NOT_CAP;
        }
        const code = core.u_nth(msg, 3);
        if (!core.u_is_fix(code)) {
            return ufork.E_NOT_FIX;
        }
        on_code(core.u_fix_to_i32(code));
        core.u_defer(function () {
            // send ack to callback
            core.h_release_stub(event_stub_ptr);
            core.h_event_enqueue(core.h_reserve_ram({
                t: sponsor,
                x: callback,
                y: core.h_reserve_ram({
                    t: ufork.PAIR_T,
                    x: ufork.UNIT_RAW,
                    y: ufork.NIL_RAW
                })
            }));
            core.h_wakeup(ufork.HOST_DEV_OFS);
        });
        return ufork.E_OK;
    }

    function svg_append(html) {
        svg_element.innerHTML += html;
    }

    const on_code = svg_drawing(svg_append);
    const ddev = make_ddev(on_event_stub);
    const svg_proxy = ddev.h_reserve_proxy();
    core.h_install([[core.u_fixnum(svg_key), svg_proxy]]);
}

export default Object.freeze(svg_dev);
