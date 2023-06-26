// Installs the debug device.

/*jslint bitwise, devel */

function debug_device(core, log = console.log) {
    core.h_install(
        [[
            core.DEBUG_DEV_OFS,
            core.u_ptr_to_cap(core.u_ramptr(core.DEBUG_DEV_OFS))
        ]],
        {
            // FIXME: where should the trace handler be installed?
            host_trace(event) { // (i32) -> nil
                event = core.u_read_quad(event);
                const sponsor = event.t;
                const target = event.x;
                const message = event.y;
                log(
                    "TRACE: " + core.u_pprint(target)
                    + " <- " + core.u_pprint(message)
                );
            },
            host_log(x) { // (i32) -> nil
                const u = (x >>> 0);  // convert i32 -> u32
                log(
                    "LOG: " + u + " = " + core.u_print(u)
                    + " -> " + core.u_pprint(u)
                );
            }
        }
    );
}

export default Object.freeze(debug_device);
