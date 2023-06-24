// Installs the IO device.

/*jslint devel */

import OED from "../oed.js";

function io_device(core, read, write) {
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
            host_read(stub) { // (i32) -> bool
                console.log(
                    "READ: " + stub + " = " + core.u_print(stub)
                    + " -> " + core.u_pprint(stub)
                );
                if (typeof read === "function") {
                    setTimeout(function () {
                        read(stub);
                    }, 0);
                    return true;  // request scheduled
                }
                return false;  // request failed
            },
            host_write(code) { // (i32) -> nil
                code &= 0x1FFFFF;  // interpret as a Unicode code point
                const char = String.fromCodePoint(code);
                console.log(
                    "WRITE: " + code + " = " + char
                );
                if (typeof write === "function") {
                    write(char);
                }
            },
        }
    );
}

export default Object.freeze(io_device);
