// Installs the clock device.

/*jslint browser */

import ufork from "../ufork.js";

function clock_device(core) {
    core.h_install(
        [[
            ufork.CLOCK_DEV_OFS,
            core.u_ptr_to_cap(core.u_ramptr(ufork.CLOCK_DEV_OFS))
        ]],
        {
            host_clock() {
                return performance.now();
            }
        }
    );
}

export default Object.freeze(clock_device);
