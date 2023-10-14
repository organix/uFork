// Installs the BLOB device.

import ufork from "../ufork.js";

function blob_device(core) {
    const dev_ptr = core.u_ramptr(ufork.BLOB_DEV_OFS);
    const dev_id = core.u_read_quad(dev_ptr).x;
    core.h_install(
        [[
            core.u_fix_to_i32(dev_id),
            core.u_ptr_to_cap(dev_ptr)
        ]]);
}

export default Object.freeze(blob_device);
