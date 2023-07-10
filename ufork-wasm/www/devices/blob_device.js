// Installs the BLOB device.

import ufork from "../ufork.js";

function blob_device(core) {
    core.h_install([[
        ufork.BLOB_DEV_OFS,
        core.u_ptr_to_cap(core.u_ramptr(ufork.BLOB_DEV_OFS))
    ]]);
}

export default Object.freeze(blob_device);
