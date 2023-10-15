// Installs the IO device.

/*jslint browser, bitwise, devel */

import OED from "../oed.js";
import ufork from "../ufork.js";

function io_device(core, on_stdout) {
    let utf8_decoder = new TextDecoder("utf-8", {fatal: true}); // stateful
    let stdin_buffer = [];
    let stdin_stub;

    function stdin_ready() {  // return `true` if stdin has characters waiting
        return (stdin_buffer.length > 0);
    }
    function read_stdin() {  // remove and return the next character from stdin
        if (!stdin_ready()) {
            return core.UNDEF_RAW;
        }
        const first = stdin_buffer[0];
        stdin_buffer = stdin_buffer.slice(1);
        const code = first.codePointAt(0);
        const char = core.u_fixnum(code);  // character read
        return char;
    }
    function listen_stdin(stub) {  // register a customer (capability) to receive a codepoint
        if (core.u_trace !== undefined) {
            core.u_trace(
                "READ:",
                stub,
                "=",
                core.u_print(stub),
                "->",
                core.u_pprint(stub)
            );
        }
        if (stdin_stub !== undefined) {
            throw new Error(
                "stdin_stub already set to " + core.u_pprint(stdin_stub)
            );
        }
        stdin_stub = stub;
    }
    function poll_stdin() {  // when the buffer state changes, check for stdin listener
        if (stdin_stub !== undefined && stdin_ready()) {
            const char = read_stdin();
            if (core.u_trace !== undefined) {
                core.u_trace("READ:", core.u_print(char));
            }
            const message = core.h_reserve_ram({  // (char)
                t: ufork.PAIR_T,
                x: char,
                y: ufork.NIL_RAW,
                z: ufork.UNDEF_RAW
            });
            const quad = core.u_read_quad(stdin_stub);
            const evt = quad.y;  // stub carries pre-allocated event
            const event = core.u_read_quad(evt);
            event.y = message;  // set message field in event
            core.u_write_quad(evt, event);
            core.h_event_enqueue(evt);
            core.h_release_stub(stdin_stub);
            stdin_stub = undefined;
            core.h_wakeup(ufork.IO_DEV_OFS);
        }
    }

    const dev_ptr = core.u_ramptr(ufork.IO_DEV_OFS);
    const dev_cap = core.u_ptr_to_cap(dev_ptr);
    const dev_id = core.u_read_quad(dev_ptr).x;
    core.h_install([[dev_id, dev_cap]], {
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
            return core.u_fixnum(core.E_OK);
        }
    });
    return function on_stdin(string_or_utf8) {
        stdin_buffer = stdin_buffer.concat(Array.from(
            typeof string_or_utf8 === "string"
            ? string_or_utf8
            : utf8_decoder.decode(string_or_utf8, {stream: true})
        ));
        poll_stdin();
    };
}

export default Object.freeze(io_device);
