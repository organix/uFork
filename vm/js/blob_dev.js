// Installs the BLOB device. See also blob_dev.md.

import ufork from "./ufork.js";

function blob_dev(core) {
    const dev_ptr = core.u_ramptr(ufork.BLOB_DEV_OFS);
    const dev_cap = core.u_ptr_to_cap(dev_ptr);
    const dev_id = core.u_read_quad(dev_ptr).x;
    core.h_install(dev_id, dev_cap);
}

export default Object.freeze(blob_dev);
