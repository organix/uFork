// Installs the blob device. See also blob_dev.md.

// The returned function 'h_alloc_blob' can be used to make blobs host-side.
// It is passed a size (or an existing TypedArray) and returns an object like
// {cap, buffer} where the 'cap' is the blob capability and the 'buffer' is
// a mutable Uint8Array containing the blob's bytes.

/*jslint web, global */

import assemble from "https://ufork.org/lib/assemble.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import host_dev from "./host_dev.js";
import ufork from "./ufork.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");

function blob_dev(core, make_ddev) {
    const sponsor = core.u_ramptr(ufork.SPONSOR_OFS);
    let ddev;
    let buffers = [];

    function h_alloc_blob(size_or_bytes) {
        const next_blob_nr = buffers.length;
        const buffer = new Uint8Array(size_or_bytes);
        buffers.push(buffer);
        const tag = core.u_fixnum(next_blob_nr);
        const cap = ddev.h_reserve_proxy(tag);
        if (core.u_trace !== undefined) {
            core.u_trace(`alloc blob #${next_blob_nr} size ${buffer.length}`);
        }
        return {cap, buffer};
    }

    ddev = make_ddev(
        function on_event_stub(event_stub_ptr) {
            const event_stub = core.u_read_quad(event_stub_ptr);
            const target = core.u_read_quad(core.u_cap_to_ptr(event_stub.x));
            const tag = ddev.u_tag(target.y);
            const event = core.u_read_quad(event_stub.y);
            const message = event.y;
            const customer = core.u_nth(message, 1);
            if (!core.u_is_cap(customer)) {
                return ufork.E_NOT_CAP;
            }
            if (core.u_is_fix(tag)) {
                const blob_nr = core.u_fix_to_i32(tag);
                const buffer = buffers[blob_nr];
                if (buffer === undefined) {
                    return ufork.E_BOUNDS;
                }
                let reply;
                const request = core.u_nth(message, -1);
                if (request === ufork.UNDEF_RAW) {

// Size request.

                    reply = core.u_fixnum(buffer.length);
                } else if (core.u_is_fix(request)) {

// Read request.

                    const read_at = core.u_fix_to_i32(request);
                    const read_byte = buffer[read_at];
                    reply = (
                        read_byte !== undefined
                        ? core.u_fixnum(buffer[read_at])
                        : ufork.UNDEF_RAW
                    );
                } else {

// Write request.

                    const offset = core.u_nth(message, 2);
                    const value = core.u_nth(message, -2);
                    if (!core.u_is_fix(offset) || !core.u_is_fix(value)) {
                        return ufork.E_NOT_FIX;
                    }
                    const byte = core.u_fix_to_i32(value);
                    if (byte < 0 || byte > 255) {
                        return ufork.E_BOUNDS;
                    }
                    const write_at = core.u_fix_to_i32(offset);
                    buffer[write_at] = byte;
                    reply = (
                        buffer[write_at] !== undefined // in bounds?
                        ? ufork.TRUE_RAW
                        : ufork.FALSE_RAW
                    );
                }
                core.u_defer(function () {
                    core.h_release_stub(event_stub_ptr);
                    core.h_event_enqueue(core.h_reserve_ram({
                        t: sponsor,
                        x: customer,
                        y: reply
                    }));
                    core.h_wakeup(ufork.BLOB_DEV_OFS);
                });
                return ufork.E_OK;
            }

// Allocation request.

            const size_raw = core.u_nth(message, -1);
            if (!core.u_is_fix(size_raw)) {
                return ufork.E_NOT_FIX;
            }
            const size = core.u_fix_to_i32(size_raw);
            if (size < 0) {
                return ufork.E_BOUNDS;
            }

// Make a new blob capability and send it to the customer.

            core.u_defer(function () {
                core.h_release_stub(event_stub_ptr);
                core.h_event_enqueue(core.h_reserve_ram({
                    t: sponsor,
                    x: customer,
                    y: h_alloc_blob(size).cap
                }));
                core.h_wakeup(ufork.BLOB_DEV_OFS);
            });
            return ufork.E_OK;
        },
        function on_drop_proxy(proxy_raw) {
            const quad = core.u_read_quad(core.u_cap_to_ptr(proxy_raw));
            const tag = ddev.u_tag(quad.y);
            if (core.u_is_fix(tag)) {
                const blob_nr = core.u_fix_to_i32(tag);
                delete buffers[blob_nr];
                if (core.u_trace !== undefined) {
                    core.u_trace(`disposed blob #${blob_nr}`);
                }
            }
        }
    );
    const dev_cap = ddev.h_reserve_proxy();
    const dev_ptr = core.u_ramptr(ufork.BLOB_DEV_OFS);
    const dev_id = core.u_read_quad(dev_ptr).x;
    let stub = ddev.h_reserve_stub(dev_cap);
    core.h_install(dev_id, dev_cap, function on_dispose() {
        ddev.h_dispose();
        if (stub !== undefined) {
            if (core.u_trace !== undefined) {
                core.u_trace("disposing blobs");
            }
            core.h_release_stub(stub);
            stub = undefined;
        }
        buffers.length = 0;
    });
    return h_alloc_blob;
}

const test_asm = `
.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"
boot:                   ; _ <- {caps}
    push 8              ; size=8
    msg 0               ; size {caps}
    push dev.debug_key  ; size {caps} debug_key
    dict get            ; size debug_dev
    push write_beh      ; size debug_dev write_beh
    actor create        ; size cust=write_beh.debug_dev
    pair 1              ; (cust . size)
    msg 0               ; (cust . size) {caps}
    push dev.blob_key   ; (cust . size) {caps} blob_key
    dict get            ; (cust . size) blob_dev
    ref std.send_msg
write_beh:              ; debug_dev <- blob
    push 42             ; value=42
    push 1              ; value offset=1
    state 0             ; value offset debug_dev
    msg 0               ; value offset debug_dev blob
    pair 1              ; value offset (blob . debug_dev)
    push read_beh       ; value offset (blob . debug_dev) read_beh
    actor create        ; value offset cust=read_beh.(blob . debug_dev)
    pair 2              ; (cust offset . value)
    msg 0               ; (cust offset . value) blob
    actor send          ; --
    push #?             ; #? // size request
    state 0             ; #? debug_dev
    pair 1              ; (debug_dev . #?)
    msg 0               ; (debug_dev . #?) blob
    ref std.send_msg
read_beh:               ; (blob . debug_dev) <- ok
    msg 0               ; ok
    assert #t           ; --
    push 1              ; offset=1
    state -1            ; offset debug_dev
    push check_beh      ; offset debug_dev check_beh
    actor create        ; offset cust=check_beh.debug_dev
    pair 1              ; (cust . offset)
    state 1             ; (cust . offset) blob
    ref std.send_msg
check_beh:              ; debug_dev <- value
    msg 0               ; value
    assert 42           ; --
    push 1729           ; 1729
    state 0             ; 1729 debug_dev
    ref std.send_msg
.export
    boot
`;

function demo(log) {
    let core;

    function run_core() {
        log("IDLE:", core.u_fault_msg(core.u_fix_to_i32(core.h_run_loop())));
    }

    core = ufork.make_core({
        wasm_url,
        on_wakeup: run_core,
        on_log: log,
        log_level: ufork.LOG_TRACE,
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble}
    });
    parseq.sequence([
        core.h_initialize(),
        core.h_import(undefined, assemble(test_asm)),
        requestorize(function (asm_module) {
            const h_alloc_blob = blob_dev(core, host_dev(core));
            core.h_boot(asm_module.boot);
            run_core();
            const blob = h_alloc_blob(2);
            blob.buffer[1] = 255;
            return blob;
        })
    ])(log);
    setTimeout(core.h_dispose, 200);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(blob_dev);
