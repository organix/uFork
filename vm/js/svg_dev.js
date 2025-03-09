// The SVG device draws into an SVG element, based on the commands it receives.
// It can also receive pointer events from the mouse or similar.

import ufork from "./ufork.js";
import svg_drawing from "https://ufork.org/lib/svg_drawing.js";

const svg_key = 101; // from dev.asm

function svg_dev(core, make_ddev, on_draw) {
    const on_code = svg_drawing(on_draw);
    let dev_cap;
    let pending_event;
    let pending_read;

    function h_send(target, message, sponsor) {
        const event_ptr = core.h_reserve_ram({
            t: sponsor,
            x: target,
            y: message
        });
        core.h_wakeup(dev_cap, [event_ptr]);
    }

    function h_reply_ok(output_value) {
        return core.h_reserve_ram({
            t: ufork.PAIR_T,
            x: ufork.TRUE_RAW,
            y: output_value
        });
    }

    function h_reply_fail(error = ufork.fixnum(ufork.E_FAIL)) {
        return core.h_reserve_ram({
            t: ufork.PAIR_T,
            x: ufork.FALSE_RAW,
            y: error
        });
    }

    function h_poll_input() {
        if (pending_read !== undefined && pending_event !== undefined) {
            const event_stub_ptr = pending_read;
            const event_stub = core.u_read_quad(event_stub_ptr);
            const event = core.u_read_quad(event_stub.y);
            const sponsor = event.t;
            const msg = event.y;
            const callback = core.u_nth(msg, 2);
            const event_data = core.h_reserve_ram({
                t: ufork.PAIR_T,
                x: ufork.fixnum(Math.round(pending_event.x)),
                y: core.h_reserve_ram({
                    t: ufork.PAIR_T,
                    x: ufork.fixnum(Math.round(pending_event.y)),
                    y: ufork.fixnum(pending_event.button_mask)
                })
            });
            pending_event = undefined;
            pending_read = undefined;
            core.h_release_stub(event_stub_ptr);
            h_send(callback, h_reply_ok(event_data), sponsor);
        }
    }

    function on_event_stub(event_stub_ptr) {
        const event_stub = core.u_read_quad(event_stub_ptr);
        const event = core.u_read_quad(event_stub.y);
        const sponsor = event.t;
        const msg = event.y;
        const callback = core.u_nth(msg, 2);
        if (!ufork.is_cap(callback)) {
            return ufork.E_NOT_CAP;
        }
        const code = core.u_nth(msg, -2);
        if (code === ufork.UNDEF_RAW) {

// Read request.

            if (pending_read !== undefined) {
                core.u_defer(function () {
                    core.h_release_stub(event_stub_ptr);
                    h_send(callback, h_reply_fail(), sponsor); // busy
                });
                return ufork.E_OK;
            }
            pending_read = event_stub_ptr;
            core.u_defer(h_poll_input);
            return ufork.E_OK;
        }

// Write request.

        if (ufork.is_fix(code)) {
            on_code(ufork.fix_to_i32(code));
        } else {
            let list = code;
            while (list !== ufork.NIL_RAW) {
                const first = core.u_nth(list, 1);
                if (!ufork.is_fix(first)) {
                    break;
                }
                on_code(ufork.fix_to_i32(first));
                list = core.u_nth(list, -1);
            }
        }
        core.u_defer(function () {
            core.h_release_stub(event_stub_ptr);
            h_send(callback, h_reply_ok(ufork.UNDEF_RAW), sponsor);
        });
        return ufork.E_OK;
    }

    const ddev = make_ddev(on_event_stub);
    dev_cap = ddev.h_reserve_proxy();
    core.h_install(ufork.fixnum(svg_key), dev_cap);
    return function h_on_pointer_input(x, y, button_mask) {
        pending_event = {x, y, button_mask}; // overwrite stale
        h_poll_input();
    };
}

export default Object.freeze(svg_dev);
