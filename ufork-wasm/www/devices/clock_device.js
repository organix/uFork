// Installs the clock device.

/*jslint browser */

import ufork from "../ufork.js";

function clock_device(core) {
    const dev_ptr = core.u_ramptr(ufork.CLOCK_DEV_OFS);
    const dev_id = core.u_read_quad(dev_ptr).x;
    core.h_install(
        [[
            core.u_fix_to_i32(dev_id),
            core.u_ptr_to_cap(dev_ptr)
        ]],
        {
            host_clock() {
                return performance.now();
            }
        }
    );
}

export default Object.freeze(clock_device);
