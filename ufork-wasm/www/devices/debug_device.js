// Installs the debug device.

/*jslint bitwise, devel */

function debug_device(core) {
    core.h_install(
        [[
            core.DEBUG_DEV_OFS,
            core.u_ptr_to_cap(core.u_ramptr(core.DEBUG_DEV_OFS))
        ]],
        {
            host_log(x) { // (i32) -> nil
                const u = (x >>> 0);  // convert i32 -> u32
                console.log(
                    "LOG: " + u + " = " + core.u_print(u)
                    + " -> " + core.u_pprint(u)
                );
            }
        }
    );
}

export default Object.freeze(debug_device);
