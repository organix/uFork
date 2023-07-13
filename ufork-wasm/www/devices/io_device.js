// Installs the IO device.

/*jslint bitwise, browser, devel */

import OED from "../oed.js";
import ufork from "../ufork.js";

function io_device(core, on_stdout) {
    let stdin_buffer = [];
    let stdin_stub;

    function poll_stdin() {
        if (stdin_stub !== undefined && stdin_buffer.length > 0) {
            const first = stdin_buffer[0];
            stdin_buffer = stdin_buffer.slice(1);
            const code = first.codePointAt(0);
            const char = core.u_fixnum(code);  // character read
            const quad = core.u_read_quad(stdin_stub);
            const event = core.u_read_quad(quad.y);
            const sponsor = event.t;
            const target = event.x;
            //const message = event.y;
            /*
            console.log("READ: " + code + " = " + first);
            */
            const message = core.h_reserve_ram({  // (char)
                t: ufork.PAIR_T,
                x: char,
                y: ufork.NIL_RAW,
                z: ufork.UNDEF_RAW
            });
            core.h_event_inject(sponsor, target, message);
            core.h_release_stub(stdin_stub);
            stdin_stub = undefined;
            core.h_wakeup(ufork.IO_DEV_OFS);
        }
    }

    core.h_install(
        [[
            ufork.IO_DEV_OFS,
            core.u_ptr_to_cap(core.u_ramptr(ufork.IO_DEV_OFS))
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
                /*
                console.log(
                    "READ: " + stub + " = " + core.u_print(stub)
                    + " -> " + core.u_pprint(stub)
                );
                */
                if (stdin_stub !== undefined) {
                    throw new Error(
                        "stdin_stub already set to " + core.u_pprint(stdin_stub)
                    );
                }
                stdin_stub = stub;
                setTimeout(poll_stdin, 0);
                return true;  // request scheduled
            },
            host_write(code) { // (i32) -> nil
                code &= 0x1FFFFF;  // interpret as a Unicode code point
                const char = String.fromCodePoint(code);
                /*
                console.log(
                    "WRITE: " + code + " = " + char
                );
                */
                if (typeof on_stdout === "function") {
                    on_stdout(char);
                }
            }
        }
    );
    return function on_stdin(string) {
        const glyphs = Array.from(string);
        stdin_buffer = stdin_buffer.concat(glyphs);
        poll_stdin();
    };
}

export default Object.freeze(io_device);
