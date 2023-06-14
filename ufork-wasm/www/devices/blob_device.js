// Installs the BLOB device.

function blob_device(core) {
    core.h_install([[
        core.BLOB_DEV_OFS,
        core.u_ptr_to_cap(core.u_ramptr(core.BLOB_DEV_OFS))
    ]]);
}

export default Object.freeze(blob_device);
