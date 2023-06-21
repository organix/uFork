// Installs the IO device.

/*jslint devel */

import OED from "../oed.js";

function io_device(core) {
    core.h_install(
        [[
            core.IO_DEV_OFS,
            core.u_ptr_to_cap(core.u_ramptr(core.IO_DEV_OFS))
        ]],
        {
            host_print(base, ofs) { // (i32, i32) -> nil
                console.log(OED.decode(
                    new Uint8Array(core.u_memory()),
                    undefined,
                    base + ofs - 5 // blobs have a 5-octet header
                ));
            },
            host_write(code) { // (i32) -> nil
                code &= 0x1FFFFF;  // interpret as a Unicode code point
                console.log(
                    "WRITE: " + code + " = " + String.fromCodePoint([code])
                );
            }
        }
    );
}

export default Object.freeze(io_device);
