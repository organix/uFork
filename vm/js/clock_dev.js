// Installs the clock device.

/*jslint web */

import ufork from "./ufork.js";

function clock_dev(core) {
    const dev_ptr = core.u_ramptr(ufork.CLOCK_DEV_OFS);
    const dev_cap = core.u_ptr_to_cap(dev_ptr);
    const dev_id = core.u_read_quad(dev_ptr).x;
    core.h_install(dev_id, dev_cap, undefined, {
        host_clock() {
            return performance.now();
        }
    });
}

export default Object.freeze(clock_dev);
