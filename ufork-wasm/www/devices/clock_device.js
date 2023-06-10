// Installs the clock device.

/*jslint browser */

function clock_device(core) {
    core.h_install(
        [[
            core.CLOCK_DEV_OFS,
            core.u_ptr_to_cap(core.u_ramptr(core.CLOCK_DEV_OFS))
        ]],
        {
            host_clock() {
                return performance.now();
            }
        }
    );
}

export default Object.freeze(clock_device);
