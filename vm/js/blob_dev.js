// Installs the blob device. See also blob_dev.md.

// The returned object contains several functions:

//  h_alloc_blob(size_or_bytes)
//      Used to make blobs host-side. It is passed a size (or an existing
//      TypedArray) and returns an object like {cap, bytes} where the 'cap' is
//      the blob capability and the 'bytes' is a mutable Uint8Array containing
//      the blob's bytes.

//  u_get_bytes(cap)
//      Returns the mutable Uint8Array associated with a blob capability, or
//      undefined if there isn't one.

/*jslint web, global */

import assemble from "https://ufork.org/lib/assemble.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import host_dev from "./host_dev.js";
import ufork from "./ufork.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");
const demo_url = import.meta.resolve("./blob_dev_demo.asm");

function blob_dev(core, make_ddev) {
    const sponsor = core.u_ramptr(ufork.SPONSOR_OFS);
    let ddev;
    let blobs = [];

    function h_alloc_blob(size_or_bytes) {
        const next_blob_nr = blobs.length;
        const bytes = new Uint8Array(size_or_bytes);
        const tag = core.u_fixnum(next_blob_nr);
        const cap = ddev.h_reserve_proxy(tag);
        if (core.u_trace !== undefined) {
            core.u_trace(`alloc blob #${next_blob_nr} size ${bytes.length}`);
        }
        const blob = {cap, bytes};
        blobs.push(blob);
        return blob;
    }

    function u_get_bytes(cap) {
        return blobs.find(function (blob) {
            return blob?.cap === cap;
        })?.bytes;
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
                const bytes = blobs[blob_nr]?.bytes;
                if (bytes === undefined) {
                    return ufork.E_BOUNDS;
                }
                let reply;
                const request = core.u_nth(message, -1);
                if (request === ufork.UNDEF_RAW) {

// Size request.

                    reply = core.u_fixnum(bytes.length);
                } else if (core.u_is_fix(request)) {

// Read request.

                    const read_at = core.u_fix_to_i32(request);
                    const read_byte = bytes[read_at];
                    reply = (
                        read_byte !== undefined
                        ? core.u_fixnum(bytes[read_at])
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
                    bytes[write_at] = byte;
                    reply = (
                        bytes[write_at] !== undefined // in bounds?
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
                    core.h_wakeup(ufork.HOST_DEV_OFS);
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
                delete blobs[blob_nr];
                if (core.u_trace !== undefined) {
                    core.u_trace(`disposed blob #${blob_nr}`);
                }
            }
        }
    );
    const dev_cap = ddev.h_reserve_proxy();
    const dev_ptr = core.u_ramptr(ufork.BLOB_DEV_OFS);
    const dev_id = core.u_read_quad(dev_ptr).x;
    core.h_install(dev_id, dev_cap, function on_dispose() {
        ddev.h_dispose();
        if (core.u_trace !== undefined) {
            core.u_trace("disposing blobs");
        }
        blobs.length = 0;
    });
    ddev.h_reserve_stub(dev_cap);
    return Object.freeze({h_alloc_blob, u_get_bytes});
}

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
        core.h_import(demo_url),
        requestorize(function (asm_module) {
            const {h_alloc_blob, u_get_bytes} = blob_dev(core, host_dev(core));
            core.h_boot(asm_module.boot);
            run_core();
            const blob = h_alloc_blob(2);
            blob.bytes[1] = 255;
            return u_get_bytes(blob.cap);
        })
    ])(log);
    setTimeout(core.h_dispose, 200);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(blob_dev);
