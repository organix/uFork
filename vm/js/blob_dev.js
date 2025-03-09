// Installs the blob device. See also blob_dev.md.

// The returned object contains some functions:

//  h_alloc_blob(size_or_bytes)
//      Used to make blobs host-side. It is passed a size (or an existing
//      Uint8Array) and returns an object like {cap, bytes} where the 'cap' is
//      the blob capability and the 'bytes' is a mutable Uint8Array containing
//      the blob's bytes.

//      When providing an existing Uint8Array, be aware that it may be modified
//      in place. You can always make a copy and pass that Uint8Array instead.

//  h_read_chunks()
//      Returns a requestor that takes a blob capability and produces an array
//      of Uint8Arrays that, concatenated together, comprise the blob's bytes.
//      The caller is responsible for ensuring the blob capability is not
//      garbage collected during the request.

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

function encode_tag({blob_nr, read_nr, source_nr}) {
    return ufork.fixnum(
        blob_nr !== undefined
        ? blob_nr                   // non-negative
        : (
            read_nr !== undefined
            ? (-2 * read_nr) - 1    // negative odd
            : (-2 * source_nr) - 2  // negative even
        )
    );
}

function decode_tag(tag) {
    const integer = ufork.fix_to_i32(tag);
    return (
        integer >= 0
        ? {blob_nr: integer}
        : (
            integer % 2 === 0
            ? {source_nr: (-2 - integer) / 2}
            : {read_nr: (-1 - integer) / 2}
        )
    );
}

function test_tags() {
    const nrs = [0, 1, 2];
    const keys = ["blob_nr", "read_nr", "source_nr"];
    if (
        nrs.some(function (nr) {
            return keys.some(function (key) {
                const expected = {};
                expected[key] = nr;
                const actual = decode_tag(encode_tag(expected));
                return actual[key] !== nr;
            });
        })
    ) {
        throw new Error("FAIL test_tags");
    }
}

function blob_dev(core, make_ddev) {
    const static_dev_ptr = ufork.ramptr(ufork.BLOB_DEV_OFS);
    const dev_id = core.u_read_quad(static_dev_ptr).x;
    if (make_ddev === undefined) {

// We are unable to install a dynamic device, so install the more limited native
// blob device instead.

        const static_dev_cap = ufork.ptr_to_cap(static_dev_ptr);
        core.h_install(dev_id, static_dev_cap);
        return;
    }
    const sponsor = ufork.ramptr(ufork.SPONSOR_OFS);
    let ddev;
    let dev_cap;
    let blobs = [];
    let reads = [];
    let sources = [];

    function u_trace(...values) {
        if (core.u_trace !== undefined) {
            core.u_trace("BLOB", ...values);
        }
    }

    function h_send(sender, target, message) {
        const event_ptr = core.h_reserve_ram({
            t: sponsor,
            x: target,
            y: message
        });
        core.h_wakeup(sender, [event_ptr]);
    }

    function h_alloc_blob(size_or_bytes) {
        const blob_nr = blobs.length;
        const bytes = (
            size_or_bytes.constructor === Uint8Array
            ? size_or_bytes
            : new Uint8Array(size_or_bytes)
        );
        const cap = ddev.h_reserve_proxy(dev_cap, encode_tag({blob_nr}));
        const blob = {cap, bytes};
        u_trace(`#${blob_nr} alloc ${bytes.length}B`);
        blobs.push(blob);
        return blob;
    }

    function h_read_bytes() {

// Read a blob's bytes one by one. Should only be used for unrecognized blobs,
// because it is much slower than direct memory access.

        const read_nr = reads.length;
        reads.push(undefined); // placeholder
        let byte_array = [];
        return function h_read_bytes_requestor(callback, blob_cap) {
            try {
                const cust_tag = encode_tag({read_nr});
                const cust_cap = ddev.h_reserve_proxy(dev_cap, cust_tag);
                const cust_stub = core.h_reserve_stub(dev_cap, cust_cap);
                reads[read_nr] = function h_reply(message) {
                    core.h_release_stub(cust_stub);
                    if (ufork.is_fix(message)) {
                        byte_array.push(ufork.fix_to_i32(message));
                        return h_read_bytes_requestor(callback, blob_cap);
                    }
                    return callback(new Uint8Array(byte_array));
                };
                const offset = byte_array.length;
                const message = core.h_reserve_ram({
                    t: ufork.PAIR_T,
                    x: cust_cap,
                    y: ufork.fixnum(offset)
                });
                h_send(dev_cap, blob_cap, message);
            } catch (exception) {
                return callback(undefined, exception);
            }
        };
    }

    function h_get_bytes(blob_cap) {

// Returns the mutable Uint8Array associated with the blob capability, or
// undefined if there isn't one.

        const target = core.u_read_quad(ufork.cap_to_ptr(blob_cap));
        const tag = ddev.u_tag(target.y);
        const {blob_nr} = decode_tag(tag);
        return blobs[blob_nr]?.bytes;
    }

    function h_source_chunks() {

// Read the chunks of a blob by iteratively issuing source requests.
// For each source blob, ascertain if it is known to the blob device.
// If so, its bytes can be read directly.
// Otherwise its bytes must be read one by one, via a sequence of read requests.

// Some of this code could be removed if we made use of the new 'strsource'
// behavior in blob_io.asm.

        const source_nr = sources.length;
        sources.push(undefined); // placeholder
        let chunk_array = [];
        return function advance(callback, blob_cap) {
            try {
                const cust_tag = encode_tag({source_nr});
                const cust_cap = ddev.h_reserve_proxy(dev_cap, cust_tag);
                const cust_stub = core.h_reserve_stub(dev_cap, cust_cap);
                sources[source_nr] = function h_reply(message) {
                    core.h_release_stub(cust_stub);
                    const base_raw = core.u_nth(message, 1);
                    const base = ufork.fix_to_i32(base_raw);
                    const length_raw = core.u_nth(message, 2);
                    const length = ufork.fix_to_i32(length_raw);
                    const source_blob_cap = core.u_nth(message, -2);
                    if (
                        !ufork.is_fix(base_raw)
                        || base < 0
                        || !ufork.is_fix(length_raw)
                        || length < 0
                        || !ufork.is_cap(source_blob_cap)
                    ) {

// Bad source reply. Fallback to reading the entire blob byte-by-byte instead.

                        u_trace("bad source");
                        return parseq.sequence([
                            h_read_bytes(),
                            requestorize(function (bytes) {
                                return [bytes];
                            })
                        ])(
                            callback,
                            blob_cap
                        );
                    }
                    if (length === 0) {

// There are no more bytes to be read. We are done.

                        return callback(chunk_array);
                    }
                    const bytes = h_get_bytes(source_blob_cap);
                    if (bytes !== undefined) {

// The source blob was issued by the blob device. Without copying, extract the
// chunk from it and advance.

                        const chunk = new Uint8Array(
                            bytes.buffer,
                            base,
                            length
                        );
                        chunk_array.push(chunk);
                        return advance(callback, blob_cap);
                    }

// The source blob was not issued by the blob device. Read its bytes one by one,
// then advance.

                    return h_read_bytes()(
                        function (bytes, reason) {
                            if (bytes === undefined) {
                                return callback(undefined, reason);
                            }
                            chunk_array.push(bytes);
                            return advance(callback, blob_cap);
                        },
                        source_blob_cap
                    );
                };
                const base = chunk_array.reduce(function (total, chunk) {
                    return total + chunk.length;
                }, 0);
                const length = 2 ** 26; // 64MB
                const source_req = core.h_reserve_ram({
                    t: ufork.PAIR_T,
                    x: ufork.fixnum(base),
                    y: core.h_reserve_ram({
                        t: ufork.PAIR_T,
                        x: ufork.fixnum(length),
                        y: cust_cap
                    })
                });
                h_send(dev_cap, blob_cap, source_req);
            } catch (exception) {
                return callback(undefined, exception);
            }
        };
    }

    function h_read_chunks() {
        return function h_read_chunks_requestor(callback, blob_cap) {

// If the blob was issued by the blob device, we don't need to make any source
// requests.

            const bytes = h_get_bytes(blob_cap);
            return (
                bytes !== undefined
                ? callback([bytes])
                : h_source_chunks()(callback, blob_cap)
            );
        };
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
                    h_send(dev_cap, alloc_cust, h_alloc_blob(size).cap);
                });
                return ufork.E_OK;
            }
            const {blob_nr, read_nr, source_nr} = decode_tag(tag);
            if (read_nr !== undefined) {

// Read response.

                core.u_defer(function () {
                    core.h_release_stub(event_stub_ptr);
                    const h_reply = reads[read_nr];
                    if (h_reply !== undefined) {
                        h_reply(message);
                    }
                });
                return ufork.E_OK;
            }
            if (source_nr !== undefined) {

// Source response.

                core.u_defer(function () {
                    core.h_release_stub(event_stub_ptr);
                    const h_reply = sources[source_nr];
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
            if (ufork.is_cap(message)) {

// Size request.

                const size_cust = message;
                const size_reply = ufork.fixnum(bytes.length);
                core.u_defer(function () {
                    core.h_release_stub(event_stub_ptr);
                    h_send(blob_cap, size_cust, size_reply);
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
                if (base_num < 0 || length_num < 0) {
                    return ufork.E_BOUNDS;
                }
                const available = Math.max(0, bytes.length - base_num);
                const take = Math.min(available, length_num);
                core.u_defer(function () {
                    core.h_release_stub(event_stub_ptr);
                    const source_reply = core.h_reserve_ram({
                        t: ufork.PAIR_T,
                        x: base,
                        y: core.h_reserve_ram({
                            t: ufork.PAIR_T,
                            x: ufork.fixnum(take),
                            y: blob_cap // blob capability
                        })
                    });
                    h_send(blob_cap, source_cust, source_reply);
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
                    h_send(blob_cap, customer, read_reply);
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
                h_send(blob_cap, customer, write_reply);
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
                    u_trace(`#${blob_nr} disposed`);
                }
            }
        }
    );
    dev_cap = ddev.h_reserve_proxy();
    core.h_install(dev_id, dev_cap, function on_dispose() {
        ddev.h_dispose();
        if (blobs.length > 0) {
            u_trace(`disposing ${blobs.length} blobs`);
        }
        blobs.length = 0;
    });
    core.h_reserve_stub(ddev.u_dev_cap(), dev_cap);
    return Object.freeze({h_alloc_blob, h_read_chunks});
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
        on_audit(code, evidence) {
            log(
                "AUDIT:",
                ufork.fault_msg(ufork.fix_to_i32(code)),
                core.u_pprint(evidence)
            );
        },
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble}
    });
    parseq.sequence([
        core.h_initialize(),
        core.h_import(demo_url),
        (
            use_static
            ? requestorize(function use_static_blob_dev() {
                blob_dev(core);
                core.h_boot();
                run_core();
                return true;
            })
            : lazy(function use_dynamic_blob_dev() {
                const the_blob_dev = blob_dev(core, host_dev(core));
                core.h_boot();
                run_core();
                const blob = the_blob_dev.h_alloc_blob([5, 6, 7, 8]);
                core.h_reserve_stub(blob.cap, blob.cap);
                return bind(the_blob_dev.h_read_chunks(), blob.cap);
            })
        )
    ])(log);
    setTimeout(core.h_dispose, 500);
}

if (import.meta.main) {
    test_tags();
    demo(globalThis.console.log, true);
    demo(globalThis.console.log, false);
}

export default Object.freeze(blob_dev);
