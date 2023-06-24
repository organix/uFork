// Installs the timer device.

/*jslint browser, devel */

function timer_device(core) {
    core.h_install(
        [[
            core.TIMER_DEV_OFS,
            core.u_ptr_to_cap(core.u_ramptr(core.TIMER_DEV_OFS))
        ]],
        {
            host_timer(delay, stub) { // (i32, i32) -> nil
                if (core.u_is_fix(delay)) {
                    setTimeout(function () {
                        const quad = core.u_read_quad(stub);
                        const event = core.u_read_quad(quad.y);
                        const sponsor = event.t;
                        const target = event.x;
                        const message = event.y;
                        core.h_release_stub(stub);
                        core.h_event_inject(sponsor, target, message);
                        core.h_wake_up(core.TIMER_DEV_OFS);
                    }, core.u_fix_to_i32(delay));
                }
            }
        }
    );
}

export default Object.freeze(timer_device);
