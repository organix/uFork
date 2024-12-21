// Installs the blob device. See also blob_dev.md.

// The returned object contains some functions:

//  h_alloc_blob(size_or_bytes)
//      Used to make blobs host-side. It is passed a size (or an existing
//      TypedArray) and returns an object like {cap, bytes} where the 'cap' is
//      the blob capability and the 'bytes' is a mutable Uint8Array containing
//      the blob's bytes.

//  h_read_bytes()
//      Returns a requestor that takes a blob capability and reads a blob's
//      bytes, one by one, producing a Uint8Array. The caller is responsible for
//      ensuring the blob capability is not garbage collected during the
//      request.

//  u_get_bytes(blob_cap)
//      Returns the mutable Uint8Array associated with the blob capability, or
//      undefined if there isn't one.

/*jslint web, global */

import assemble from "https://ufork.org/lib/assemble.js";
import parseq from "https://ufork.org/lib/parseq.js";
import bind from "https://ufork.org/lib/rq/bind.js";
import lazy from "https://ufork.org/lib/rq/lazy.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import host_dev from "./host_dev.js";
import ufork from "./ufork.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");
const demo_url = import.meta.resolve("./blob_dev_demo.asm");

function blob_dev(core, make_ddev) {
    const dev_ptr = ufork.ramptr(ufork.BLOB_DEV_OFS);
    const dev_id = core.u_read_quad(dev_ptr).x;
    if (make_ddev === undefined) {

// We are unable to install a dynamic device, so install the more limited native
// blob device instead.

        const static_dev_cap = ufork.ptr_to_cap(dev_ptr);
        core.h_install(dev_id, static_dev_cap);
        return;
    }
    const sponsor = ufork.ramptr(ufork.SPONSOR_OFS);
    let ddev;
    let blobs = [];
    let reads = [];

    function encode_tag({blob_nr, read_nr}) {
        return ufork.fixnum(
            read_nr !== undefined
            ? -read_nr - 1
            : blob_nr
        );
    }

    function decode_tag(tag) {
        const integer = ufork.fix_to_i32(tag);
        return (
            integer < 0
            ? {read_nr: -1 - integer}
            : {blob_nr: integer}
        );
    }

    function h_alloc_blob(size_or_bytes) {
        const blob_nr = blobs.length;
        const bytes = new Uint8Array(size_or_bytes); // TODO unnecessary copy
        const cap = ddev.h_reserve_proxy(encode_tag({blob_nr}));
        if (core.u_trace !== undefined) {
            core.u_trace(`alloc blob #${blob_nr} size ${bytes.length}`);
        }
        const blob = {cap, bytes};
        blobs.push(blob);
        return blob;
    }

    function h_read_bytes() {
        const read_nr = reads.length;
        reads.push(undefined); // placeholder
        let byte_array = [];
        return function h_read_bytes_requestor(callback, blob_cap) {
            try {
                const cust_cap = ddev.h_reserve_proxy(encode_tag({read_nr}));
                const cust_stub = ddev.h_reserve_stub(cust_cap);
                reads[read_nr] = function h_reply(message) {
                    core.h_release_stub(cust_stub);
                    if (ufork.is_fix(message)) {
                        byte_array.push(ufork.fix_to_i32(message));
                        return h_read_bytes_requestor(callback, blob_cap);
                    }
                    return callback(new Uint8Array(byte_array));
                };
                const offset = byte_array.length;
                core.h_event_enqueue(core.h_reserve_ram({
                    t: sponsor,
                    x: blob_cap,
                    y: core.h_reserve_ram({
                        t: ufork.PAIR_T,
                        x: cust_cap,
                        y: ufork.fixnum(offset)
                    })
                }));
                core.h_wakeup(ufork.HOST_DEV_OFS);
            } catch (exception) {
                return callback(undefined, exception);
            }
        };
    }

    function u_get_bytes(blob_cap) {
        return blobs.find(function (blob) {
            return blob?.cap === blob_cap;
        })?.bytes;
    }

    ddev = make_ddev(
        function on_event_stub(event_stub_ptr) {
            const event_stub = core.u_read_quad(event_stub_ptr);
            const target = core.u_read_quad(ufork.cap_to_ptr(event_stub.x));
            const tag = ddev.u_tag(target.y);
            const event = core.u_read_quad(event_stub.y);
            const blob_cap = event.x;
            const message = event.y;
            if (!ufork.is_fix(tag)) {

// Allocation request.

                const alloc_cust = core.u_nth(message, 1);
                if (!ufork.is_cap(alloc_cust)) {
                    return ufork.E_NOT_CAP;
                }
                const size_raw = core.u_nth(message, -1);
                if (!ufork.is_fix(size_raw)) {
                    return ufork.E_NOT_FIX;
                }
                const size = ufork.fix_to_i32(size_raw);
                if (size < 0) {
                    return ufork.E_BOUNDS;
                }
                core.u_defer(function () {
                    core.h_release_stub(event_stub_ptr);
                    core.h_event_enqueue(core.h_reserve_ram({
                        t: sponsor,
                        x: alloc_cust,
                        y: h_alloc_blob(size).cap
                    }));
                    core.h_wakeup(ufork.HOST_DEV_OFS);
                });
                return ufork.E_OK;
            }
            const {blob_nr, read_nr} = decode_tag(tag);
            if (read_nr !== undefined) {

// Read response.

                core.u_defer(function () {
                    const h_reply = reads[read_nr];
                    if (h_reply !== undefined) {
                        h_reply(message);
                    }
                });
                return ufork.E_OK;
            }
            const bytes = blobs[blob_nr]?.bytes;
            if (bytes === undefined) {
                return ufork.E_BOUNDS;
            }
            let reply;
            if (ufork.is_cap(message)) {

// Size request.

                const size_cust = message;
                const size_reply = ufork.fixnum(bytes.length);
                core.u_defer(function () {
                    core.h_release_stub(event_stub_ptr);
                    core.h_event_enqueue(core.h_reserve_ram({
                        t: sponsor,
                        x: size_cust,
                        y: size_reply
                    }));
                    core.h_wakeup(ufork.HOST_DEV_OFS);
                });
                return ufork.E_OK;

            }
            const tail = core.u_nth(message, -2);
            if (ufork.is_cap(tail)) {

// Source request.

                const base = core.u_nth(message, 1);
                const length = core.u_nth(message, 2);
                const source_cust = tail;
                if (!ufork.is_fix(base) || !ufork.is_fix(length)) {
                    return ufork.E_NOT_FIX;
                }
                const base_num = ufork.fix_to_i32(base);
                const length_num = ufork.fix_to_i32(length);
                if (
                    base_num < 0
                    || base_num >= bytes.length
                    || length_num < 0
                ) {
                    return ufork.E_BOUNDS;
                }
                const available = bytes.length - base_num;
                const take = Math.min(available, length_num);
                core.u_defer(function () {
                    core.h_release_stub(event_stub_ptr);
                    core.h_event_enqueue(core.h_reserve_ram({
                        t: sponsor,
                        x: source_cust,
                        y: core.h_reserve_ram({
                            t: ufork.PAIR_T,
                            x: base,
                            y: core.h_reserve_ram({
                                t: ufork.PAIR_T,
                                x: ufork.fixnum(take),
                                y: blob_cap // blob capability
                            })
                        })
                    }));
                    core.h_wakeup(ufork.HOST_DEV_OFS);
                });
                return ufork.E_OK;
            }
            const customer = core.u_nth(message, 1);
            if (!ufork.is_cap(customer)) {
                return ufork.E_NOT_CAP;
            }
            const request = core.u_nth(message, -1);
            if (ufork.is_fix(request)) {

// Read request.

                const read_at = ufork.fix_to_i32(request);
                const read_byte = bytes[read_at];
                const read_reply = (
                    read_byte !== undefined
                    ? ufork.fixnum(bytes[read_at])
                    : ufork.UNDEF_RAW
                );
                core.u_defer(function () {
                    core.h_release_stub(event_stub_ptr);
                    core.h_event_enqueue(core.h_reserve_ram({
                        t: sponsor,
                        x: customer,
                        y: read_reply
                    }));
                    core.h_wakeup(ufork.HOST_DEV_OFS);
                });
                return ufork.E_OK;
            }

// Write request.

            const offset = core.u_nth(request, 1);
            const value = core.u_nth(request, -1);
            if (!ufork.is_fix(offset) || !ufork.is_fix(value)) {
                return ufork.E_NOT_FIX;
            }
            const byte = ufork.fix_to_i32(value);
            if (byte < 0 || byte > 255) {
                return ufork.E_BOUNDS;
            }
            const write_at = ufork.fix_to_i32(offset);
            bytes[write_at] = byte;
            const write_reply = (
                bytes[write_at] !== undefined // in bounds?
                ? ufork.TRUE_RAW
                : ufork.FALSE_RAW
            );
            core.u_defer(function () {
                core.h_release_stub(event_stub_ptr);
                core.h_event_enqueue(core.h_reserve_ram({
                    t: sponsor,
                    x: customer,
                    y: write_reply
                }));
                core.h_wakeup(ufork.HOST_DEV_OFS);
            });
            return ufork.E_OK;
        },
        function on_drop_proxy(proxy_raw) {
            const quad = core.u_read_quad(ufork.cap_to_ptr(proxy_raw));
            const tag = ddev.u_tag(quad.y);
            if (ufork.is_fix(tag)) {
                const {blob_nr} = decode_tag(tag);
                if (blob_nr !== undefined) {
                    delete blobs[blob_nr];
                    if (core.u_trace !== undefined) {
                        core.u_trace(`disposed blob #${blob_nr}`);
                    }
                }
            }
        }
    );
    const dev_cap = ddev.h_reserve_proxy();
    core.h_install(dev_id, dev_cap, function on_dispose() {
        ddev.h_dispose();
        if (core.u_trace !== undefined) {
            core.u_trace("disposing blobs");
        }
        blobs.length = 0;
    });
    ddev.h_reserve_stub(dev_cap);
    return Object.freeze({h_alloc_blob, h_read_bytes, u_get_bytes});
}

function demo(log, use_static) {
    let core;

    function run_core() {
        log("IDLE:", ufork.fault_msg(ufork.fix_to_i32(core.h_run_loop())));
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
        (
            use_static
            ? requestorize(function use_static_blob_dev(asm_module) {
                blob_dev(core);
                core.h_boot(asm_module.boot);
                run_core();
                return true;
            })
            : lazy(function use_dynamic_blob_dev(asm_module) {
                const {
                    h_alloc_blob,
                    h_read_bytes
                } = blob_dev(core, host_dev(core));
                core.h_boot(asm_module.boot);
                run_core();
                const blob = h_alloc_blob([5, 6, 7, 8]);
                core.h_reserve_stub(blob.cap, blob.cap); // TODO pass #? as device
                // return u_get_bytes(blob.cap);
                return bind(h_read_bytes(), blob.cap);
            })
        )
    ])(log);
    setTimeout(core.h_dispose, 500);
}

if (import.meta.main) {
    demo(globalThis.console.log, true);
    demo(globalThis.console.log, false);
}

export default Object.freeze(blob_dev);
