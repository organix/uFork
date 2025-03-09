// Installs the IO device. See also io_dev.md.

/*jslint web, bitwise */

import OED from "https://ufork.org/lib/oed.js";
import ufork from "./ufork.js";

function io_dev(core, on_stdout) {
    let utf8_decoder = new TextDecoder("utf-8", {fatal: true}); // stateful
    let stdin_buffer = [];
    let stdin_stub;
    const dev_ptr = ufork.ramptr(ufork.IO_DEV_OFS);
    const dev_cap = ufork.ptr_to_cap(dev_ptr);
    const dev_id = core.u_read_quad(dev_ptr).x;

    function read_stdin() {

// Remove and return the next character from stdin.

        if (stdin_buffer.length === 0) {
            return core.UNDEF_RAW;
        }
        const first = stdin_buffer[0];
        stdin_buffer = stdin_buffer.slice(1);
        const code = first.codePointAt(0);
        const char = ufork.fixnum(code);  // character read
        return char;
    }

    function listen_stdin(stub) {

// Register a customer (capability) to receive a codepoint.

        if (core.u_trace !== undefined) {
            core.u_trace(
                "READ:",
                stub,
                "=",
                ufork.print(stub),
                "->",
                core.u_pprint(stub)
            );
        }
        if (stdin_stub !== undefined) {
            core.u_warn(
                "stdin_stub already set to " + core.u_pprint(stdin_stub)
            );
        }
        stdin_stub = stub;
    }

    function poll_stdin() {

// When the buffer state changes, check for stdin listener.

        if (stdin_stub !== undefined && stdin_buffer.length > 0) {
            const char = read_stdin();
            if (core.u_trace !== undefined) {
                core.u_trace("READ:", ufork.print(char));
            }
            const message = core.h_reserve_ram({  // #t,char
                t: ufork.PAIR_T,
                x: ufork.TRUE_RAW,
                y: char
            });
            const quad = core.u_read_quad(stdin_stub);
            const evt = quad.y;  // stub carries pre-allocated event
            const event = core.u_read_quad(evt);
            event.y = message;  // set message field in event
            core.u_write_quad(evt, event);
            core.h_release_stub(stdin_stub);
            stdin_stub = undefined;
            core.h_wakeup(dev_cap, [evt]);
        }
    }

    core.h_install(dev_id, dev_cap, undefined, {
        host_print(base, ofs) { // (i32, i32) -> nil
            if (core.u_info !== undefined) {
                core.u_info(OED.decode(
                    new Uint8Array(core.u_memory()),
                    undefined,
                    base + ofs - 5 // blobs have a 5-octet header
                ));
            }
        },
        host_read(stub) { // (i32) -> i32
            const char = read_stdin();
            if (char === core.UNDEF_RAW) {
                listen_stdin(stub);
            }
            return char;
        },
        host_write(code) { // (i32) -> i32
            code &= 0x1FFFFF;  // interpret as a Unicode code point
            const char = String.fromCodePoint(code);
            if (core.u_trace !== undefined) {
                core.u_trace("WRITE:", code, "=", char);
            }
            if (typeof on_stdout === "function") {
                on_stdout(char);
            }
            return ufork.fixnum(core.E_OK);
        }
    });
    return function h_on_stdin(string_or_utf8) {
        stdin_buffer = stdin_buffer.concat(Array.from(
            typeof string_or_utf8 === "string"
            ? string_or_utf8
            : utf8_decoder.decode(string_or_utf8, {stream: true})
        ));
        poll_stdin();
    };
}

export default Object.freeze(io_dev);
