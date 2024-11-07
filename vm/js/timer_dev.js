// Installs the timer device.

// The 'slowdown' parameter multiplies the specified delays, making it possible
// to slow down time during debugging.

/*jslint web */

import ufork from "./ufork.js";

function timer_dev(core, slowdown = 1) {
    const timer_map = Object.create(null);
    const dev_ptr = core.u_ramptr(ufork.TIMER_DEV_OFS);
    const dev_cap = core.u_ptr_to_cap(dev_ptr);
    const dev_id = core.u_read_quad(dev_ptr).x;
    core.h_install(
        dev_id,
        dev_cap,
        function on_dispose() {
            Object.values(timer_map).forEach(clearTimeout);
        },
        {
            host_start_timer(delay, stub) { // (i32, i32) -> nil
                if (core.u_is_fix(delay)) {
                    const quad = core.u_read_quad(stub);
                    const evt = quad.y;  // stub carries pre-allocated event
                    timer_map[stub] = setTimeout(
                        function () {
                            core.u_trace("timer_fired", timer_map[stub]);
                            delete timer_map[stub];
                            core.h_release_stub(stub);
                            core.h_event_enqueue(evt);
                            core.h_wakeup(ufork.TIMER_DEV_OFS);
                        },
                        slowdown * core.u_fix_to_i32(delay)
                    );
                    if (core.u_trace !== undefined) {
                        core.u_trace("timer_started", timer_map[stub]);
                    }
                }
            },
            host_stop_timer(stub) { // (i32) -> bool
                const id = timer_map[stub];
                if (id !== undefined) {
                    clearTimeout(id);
                    delete timer_map[stub];
                    if (core.u_trace !== undefined) {
                        core.u_trace("timer_stopped", id);
                    }
                    return true;
                }
                return false;
            }
        }
    );
}

export default Object.freeze(timer_dev);
