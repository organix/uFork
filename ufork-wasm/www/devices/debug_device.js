// Installs the debug device.

/*jslint bitwise, devel */

import ufork from "../ufork.js";

function debug_device(core, log = console.log) {
    core.h_install(
        [[
            ufork.DEBUG_DEV_OFS,
            core.u_ptr_to_cap(core.u_ramptr(ufork.DEBUG_DEV_OFS))
        ]],
        {
            // FIXME: where should the trace handler be installed?
            host_trace(event) { // (i32) -> nil
                return;  // FIXME: until we have a better mechanism, comment out this line to enable tracing...
                event = core.u_read_quad(event);
                const sponsor = event.t;
                const target = event.x;
                const message = event.y;
                const prev = core.u_read_quad(core.u_cap_to_ptr(target));
                if (core.u_is_ram(prev.z)) {
                    // actor effect
                    const next = core.u_read_quad(prev.z);
                    let messages = [];
                    let sent = next.z;
                    while (core.u_is_ram(sent)) {
                        let pending = core.u_read_quad(sent);
                        messages.push(core.u_pprint(pending.y) + "->" + core.u_print(pending.x));
                        sent = pending.z;
                    }
                    log(
                        "TRACE: " + core.u_pprint(message) + "->" + core.u_print(target)
                        + " " + core.u_print(prev.x) + "." + core.u_pprint(prev.y)
                        + " => " + core.u_print(next.x) + "." + core.u_pprint(next.y)
                        + " " + messages.join(" ")
                    );
                } else {
                    // device effect
                    log(
                        "TRACE: " + core.u_pprint(message) + "->" + core.u_print(target)
                        + " " + core.u_print(prev.x) + "." + core.u_pprint(prev.y)
                    );
                }
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
