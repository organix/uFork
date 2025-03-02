// Installs the Filesystem device.

/*jslint deno, web, global */

import concat_bytes from "https://ufork.org/lib/concat_bytes.js";
import assemble from "https://ufork.org/lib/assemble.js";
import compile_humus from "https://ufork.org/lib/humus.js";
import parseq from "https://ufork.org/lib/parseq.js";
import bind from "https://ufork.org/lib/rq/bind.js";
import lazy from "https://ufork.org/lib/rq/lazy.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import blob_dev from "./blob_dev.js";
import host_dev from "./host_dev.js";
import ufork from "./ufork.js";
import fs_memory from "./fs_memory.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");
const hum_demo_url = import.meta.resolve("./fs_dev_demo.hum");

const fs_key = 103; // from dev.asm
const fs_file = 0; // from dev.asm
const fs_begin = 0; // from dev.asm
const fs_meta = 1; // from dev.asm
const fs_size = 0; // from dev.asm
const text_decoder = new TextDecoder("utf-8", {fatal: true});

function fs_dev(
    core,
    make_ddev,
    the_blob_dev,
    root_dir_url = "file:///",
    fs = fs_memory()
) {
    const sponsor = ufork.ramptr(ufork.SPONSOR_OFS);

// Ensure a trailing slash on the directory URL. This is necessary to detect
// escapees.

    const root_dir_href = new URL(root_dir_url).href.replace(/\/?$/, "/");
    let ddev;
    let cancels = [];
    let files = [];                 // file_nr -> handle/undefined
    let locked = new WeakMap();     // handle -> true/undefined
    let dropped = new WeakMap();    // handle -> true/undefined

    function u_trace(...values) {
        if (core.u_trace !== undefined) {
            core.u_trace("FS", ...values);
        }
    }

    function h_send(target, message) {
        core.h_event_enqueue(core.h_reserve_ram({
            t: sponsor,
            x: target,
            y: message
        }));
        core.h_wakeup(ufork.HOST_DEV_OFS);
    }

    function h_reply_ok(output_value) {
        return core.h_reserve_ram({
            t: ufork.PAIR_T,
            x: ufork.TRUE_RAW,
            y: output_value
        });
    }

    function h_reply_fail(error = ufork.fixnum(ufork.E_FAIL)) {
        return core.h_reserve_ram({
            t: ufork.PAIR_T,
            x: ufork.FALSE_RAW,
            y: error
        });
    }

    function u_close(file_nr) {
        const handle = files[file_nr];
        if (handle !== undefined) {
            u_trace(`#${file_nr} file closed`);
            handle.close();
        }
        files[file_nr] = undefined;
    }

    function h_read_path_blob() {
        return parseq.sequence([
            the_blob_dev.h_read_chunks(),
            requestorize(function decode_path(chunks) {
                const bytes = chunks.reduce(concat_bytes);
                const path = text_decoder.decode(bytes); // can throw
                u_trace("decoded path", path);
                return path;
            }),
            requestorize(function resolve_path_to_url(path) {
                const url = new URL(
                    path.slice(1), // remove leading slash
                    root_dir_href
                );
                if (!url.href.startsWith(root_dir_href)) {
                    throw new Error("path escaped: " + path);
                }
                return url;
            })
        ]);
    }

    function on_event_stub(event_stub_ptr) {
        const event_stub = core.u_read_quad(event_stub_ptr);
        const target = core.u_read_quad(ufork.cap_to_ptr(event_stub.x));
        const tag = ddev.u_tag(target.y);
        const event = core.u_read_quad(event_stub.y);
        const message = event.y;
        const callback = core.u_nth(message, 2);
        const request = core.u_nth(message, -2);
        if (!ufork.is_cap(callback)) {
            return ufork.E_NOT_CAP;
        }

        function u_request(file_nr, error_msg, make_requestor, get_output) {
            core.u_defer(function () {
                const handle = files[file_nr];
                if (handle === undefined || locked.has(handle)) {
                    u_trace(`#${file_nr} unavailable`);
                    core.h_release_stub(event_stub_ptr);
                    return h_send(callback, h_reply_fail());
                }
                const requestor = make_requestor(handle);
                locked.set(handle, true); // lock
                const cancel = requestor(function (value, reason) {
                    locked.delete(handle); // unlock
                    if (dropped.has(handle)) {
                        u_close(file_nr); // file cap was dropped during request
                    }
                    core.h_release_stub(event_stub_ptr);
                    if (value === undefined) {
                        u_trace(error_msg, reason);
                        return h_send(callback, h_reply_fail());
                    }
                    const output = get_output(value);
                    return h_send(callback, h_reply_ok(output));
                });
                cancels.push(cancel);
            });
            return ufork.E_OK;
        }

        function u_write_chunks(handle) {
            return lazy(function (chunk_array) {
                return parseq.sequence(chunk_array.map(function (chunk) {
                    return bind(handle.write(), chunk);
                }));
            });
        }

        if (ufork.is_fix(tag)) {
            const file_nr = ufork.fix_to_i32(tag);
            if (ufork.is_fix(request)) {

// Read request.

                const size = ufork.fix_to_i32(request);
                if (size < 0) {
                    return ufork.E_BOUNDS;
                }
                return u_request(
                    file_nr,
                    `#${file_nr} read failed`,
                    function make_requestor(handle) {
                        return handle.read(size);
                    },
                    function get_output(bytes) {
                        if (bytes === false) {
                            u_trace(`#${file_nr} read EOF`);
                            return ufork.NIL_RAW;
                        }
                        u_trace(`#${file_nr} read ${bytes.length}B`);
                        return the_blob_dev.h_alloc_blob(bytes).cap;
                    }
                );
            }
            if (ufork.is_cap(request)) {

// Write request.

                return u_request(
                    file_nr,
                    `#${file_nr} write failed`,
                    function make_requestor(handle) {
                        const blob_cap = request;
                        return parseq.sequence([
                            bind(the_blob_dev.h_read_chunks(), blob_cap),
                            u_write_chunks(handle)
                        ]);
                    },
                    function get_output(length) {
                        u_trace(`#${file_nr} write ${length}B`);
                        return ufork.UNDEF_RAW;
                    }
                );
            }

// Seek request.

            const origin = core.u_nth(request, 1);
            if (origin !== ufork.fixnum(fs_begin)) {
                u_trace(`#${file_nr} bad seek origin`);
                return ufork.E_BOUNDS;
            }
            const offset = core.u_nth(request, -1);
            if (!ufork.is_fix(offset)) {
                u_trace(`#${file_nr} bad seek offset`);
                return ufork.E_NOT_FIX;
            }
            const to = ufork.fix_to_i32(offset);
            return u_request(
                file_nr,
                `#${file_nr} seek failed`,
                function make_requestor(handle) {
                    return handle.seek(to);
                },
                function get_output(in_bounds) {
                    u_trace(`#${file_nr} seek ${to} ${in_bounds}`);
                    return (
                        in_bounds
                        ? ufork.TRUE_RAW
                        : ufork.FALSE_RAW
                    );
                }
            );
        }
        const kind = core.u_nth(request, 1);
        if (kind === ufork.fixnum(fs_file)) {

// File request.

            const file_path_cap = core.u_nth(request, 2);
            if (!ufork.is_cap(file_path_cap)) {
                return ufork.E_NOT_CAP;
            }
            const create = core.u_nth(request, -2);
            if (create !== ufork.TRUE_RAW && create !== ufork.FALSE_RAW) {
                return ufork.BOUNDS;
            }
            core.u_defer(function () {
                const cancel = parseq.sequence([
                    h_read_path_blob(),
                    fs.open(create === ufork.TRUE_RAW)
                ])(
                    function (file_handle, reason) {
                        core.h_release_stub(event_stub_ptr); // release blob
                        if (file_handle === undefined) {
                            u_trace("failed to open file", reason);
                            return h_send(callback, h_reply_fail());
                        }
                        const new_file_nr = files.length;
                        files.push(file_handle);
                        const file_tag = ufork.fixnum(new_file_nr);
                        const file_cap = ddev.h_reserve_proxy(file_tag);
                        u_trace(`#${new_file_nr} opened`);
                        return h_send(callback, h_reply_ok(file_cap));
                    },
                    file_path_cap
                );
                cancels.push(cancel);
            });
            return ufork.E_OK;
        }
        if (kind === ufork.fixnum(fs_meta)) {

// Metadata request.

            const meta_path_cap = core.u_nth(request, -1);
            if (!ufork.is_cap(meta_path_cap)) {
                return ufork.E_NOT_CAP;
            }
            core.u_defer(function () {
                const cancel = parseq.sequence([
                    h_read_path_blob(),
                    fs.stat()
                ])(
                    function (stats, reason) {
                        core.h_release_stub(event_stub_ptr); // release blob
                        if (stats === undefined) {
                            u_trace("failed to stat file", reason);
                            return h_send(callback, h_reply_fail());
                        }
                        if (stats === false) {
                            return h_send(
                                callback,
                                h_reply_ok(ufork.UNDEF_RAW)
                            );
                        }
                        const metadata_dict = core.h_reserve_ram({
                            t: ufork.DICT_T,
                            x: ufork.fixnum(fs_size),
                            y: ufork.fixnum(stats.size),
                            z: ufork.NIL_RAW
                        });
                        u_trace(`stat`, stats);
                        return h_send(callback, h_reply_ok(metadata_dict));
                    },
                    meta_path_cap
                );
                cancels.push(cancel);
            });
            return ufork.E_OK;
        }
        return ufork.E_BOUNDS;
    }

    function on_drop_proxy(proxy_raw) {
        const quad = core.u_read_quad(ufork.cap_to_ptr(proxy_raw));
        const tag = ddev.u_tag(quad.y);
        if (ufork.is_fix(tag)) {
            const file_nr = ufork.fix_to_i32(tag);
            const handle = files[file_nr];
            if (handle !== undefined) {

// If the file handle is not in use, close it immediately.
// Otherwise wait until the pending request completes.

                if (!locked.has(handle)) {
                    u_close(file_nr);
                } else {
                    u_trace(`#${file_nr} dropped`);
                    dropped.set(handle, true);
                }
            }
        }
    }

    ddev = make_ddev(on_event_stub, on_drop_proxy);
    const dev_cap = ddev.h_reserve_proxy();
    const dev_id = ufork.fixnum(fs_key);
    core.h_install(dev_id, dev_cap, function on_dispose() {
        cancels.forEach(function (cancel) {
            if (typeof cancel === "function") {
                cancel();
            }
        });
        cancels.length = 0;
        files.forEach(function (handle, file_nr) {
            if (handle !== undefined) {
                u_trace(`#${file_nr} closed`);
                handle.close();
            }
        });
        files.length = 0;
    });
    ddev.h_reserve_stub(dev_cap);
}

function demo(log) {
    let core;

    function run_core() {
        log("IDLE:", ufork.fault_msg(ufork.fix_to_i32(core.h_run_loop())));
    }

    core = ufork.make_core({
        wasm_url,
        on_wakeup: run_core,
        on_log: log,
        on_audit(code, evidence) {
            log(
                "AUDIT:",
                ufork.fault_msg(ufork.fix_to_i32(code)),
                core.u_pprint(evidence)
            );
        },
        log_level: ufork.LOG_TRACE,
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble, hum: compile_humus}
    });
    parseq.sequence([
        core.h_initialize(),
        core.h_import(hum_demo_url),
        requestorize(function () {
            const make_ddev = host_dev(core);
            fs_dev(
                core,
                make_ddev,
                blob_dev(core, make_ddev),
                "file:///tmp",
                fs_memory()
            );
            core.h_boot();
            core.h_refill({memory: 65536, events: 65536, cycles: 65536});
            run_core();
            return true;
        })
    ])(log);
    setTimeout(core.h_dispose, 1000);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(fs_dev);
