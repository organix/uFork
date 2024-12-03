// Installs the TCP network device.

/*jslint web, global, long */

import assemble from "https://ufork.org/lib/assemble.js";
import compile_humus from "https://ufork.org/lib/humus.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import blob_dev from "./blob_dev.js";
import host_dev from "./host_dev.js";
import ufork from "./ufork.js";
import mock_transport from "./mock_tcp_transport.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");
const hum_demo_url = import.meta.resolve("./tcp_dev_demo.hum");

const tcp_key = 102; // from dev.asm

function concat_bytes(a, b) {
    let array = new Uint8Array(a.byteLength + b.byteLength);
    array.set(a, 0);
    array.set(b, a.byteLength);
    return array;
}

function tcp_dev(
    core,
    make_ddev,
    the_blob_dev,
    addresses,
    transport = mock_transport()
) {
    const sponsor = core.u_ramptr(ufork.SPONSOR_OFS);
    let ddev;

// Each element in the 'connections' array is either:
//  - a connection object (the connection is open)
//  - true (the connection closed gracefully)
//  - false (the connection failed)

    let connections = [];                   // conn_nr -> connection/boolean
    let conn_stubs = [];                    // conn_nr -> conn_stub
    let read_chunks = [];                   // conn_nr -> Uint8Array
    let read_stubs = [];                    // conn_nr -> callback_stub
    let listeners = [];                     // listener_nr -> {stop, h_release}

    function encode_tag({listener_nr, conn_nr}) {
        return (
            listener_nr !== undefined
            ? core.u_fixnum(-listener_nr - 1)
            : core.u_fixnum(conn_nr)
        );
    }

    function decode_tag(tag) {
        const integer = core.u_fix_to_i32(tag);
        return (
            integer < 0
            ? {listener_nr: -1 - integer}
            : {conn_nr: integer}
        );
    }

    // console.log(decode_tag(encode_tag({listener_nr: 6})));
    // console.log(decode_tag(encode_tag({conn_nr: 7})));

    function stub_to_cap(stub) {
        const stub_quad = core.u_read_quad(stub);
        const target = stub_quad.y;
        return target;
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

    function h_reply_fail(error = core.u_fixnum(ufork.E_FAIL)) {
        return core.h_reserve_ram({
            t: ufork.PAIR_T,
            x: ufork.FALSE_RAW,
            y: error
        });
    }

    function h_register(connection) {
        const conn_nr = connections.length;
        connections.push(connection);
        if (core.u_trace !== undefined) {
            core.u_trace(`TCP #${conn_nr} opened`);
        }
        const tag = encode_tag({conn_nr});
        const conn_cap = ddev.h_reserve_proxy(tag);
        const conn_stub = ddev.h_reserve_stub(conn_cap);
        conn_stubs[conn_nr] = conn_stub;
        return conn_cap;
    }

    function h_flush_read(conn_nr) {
        const read_stub = read_stubs[conn_nr];
        const connection = connections[conn_nr];
        const chunk = read_chunks[conn_nr];
        if (read_stub === undefined || (
            typeof connection === "object"
            && chunk === undefined
        )) {
            return; // nothing requested or nothing queued
        }
        const read_callback_cap = stub_to_cap(read_stub);
        core.h_release_stub(read_stub);
        read_stubs[conn_nr] = undefined;
        read_chunks[conn_nr] = undefined;
        h_send(read_callback_cap, (
            connection === true
            ? h_reply_ok(ufork.NIL_RAW) // end of stream
            : (
                connection === false
                ? h_reply_fail()
                : h_reply_ok(the_blob_dev.h_alloc_blob(chunk).cap)
            )
        ));
    }

    function h_unregister(connection, reason) {
        const conn_nr = connections.indexOf(connection);
        connections[conn_nr] = (reason === undefined);
        if (core.u_trace !== undefined) {
            core.u_trace(`TCP #${conn_nr} closed`, reason);
        }
        h_flush_read(conn_nr);
        const conn_stub = conn_stubs[conn_nr];
        if (conn_stub !== undefined) {
            core.h_release_stub(conn_stub);
        }
        conn_stubs[conn_nr] = undefined;
        read_chunks[conn_nr] = undefined; // discard unread chunks
        read_stubs[conn_nr] = undefined;
    }

    function h_receive(connection, chunk) {
        const conn_nr = connections.indexOf(connection);
        if (core.u_trace !== undefined) {
            core.u_trace(`TCP #${conn_nr} received ${chunk.length}B`);
        }

// Enqueue the chunk. We should be applying backpressure instead, but the
// transport interface does not yet support that.

        const queue = read_chunks[conn_nr] ?? new Uint8Array(0);
        read_chunks[conn_nr] = concat_bytes(queue, chunk);

// Fulfill any pending read requests.

        h_flush_read(conn_nr);
    }

    function h_listen(bind_address, on_open_cap, on_close_cap) {
        const on_open_stub = ddev.h_reserve_stub(on_open_cap);
        const on_close_stub = ddev.h_reserve_stub(on_close_cap);

        function on_open(connection) {
            const conn_cap = h_register(connection);
            h_send(on_open_cap, conn_cap);
        }

        function on_close(connection, reason) {
            const conn_nr = connections.indexOf(connection);
            const conn_stub = conn_stubs[conn_nr];
            const conn_cap = stub_to_cap(conn_stub);
            h_unregister(connection, reason);
            h_send(on_close_cap, conn_cap);
        }

        try {
            const listener_nr = listeners.length;
            const listener_tag = encode_tag({listener_nr});
            const stop = transport.listen(
                bind_address,
                on_open,
                h_receive,
                on_close
            );
            listeners.push({
                stop,
                h_release() {
                    core.h_release_stub(on_open_stub);
                    core.h_release_stub(on_close_stub);
                }
            });
            const stop_cap = ddev.h_reserve_proxy(listener_tag);
            if (core.u_trace !== undefined) {
                core.u_trace(`TCP %${listener_nr} listening`);
            }
            return h_reply_ok(stop_cap);
        } catch (exception) {
            if (core.u_trace !== undefined) {
                core.u_trace("TCP listen failed", exception);
            }
            return h_reply_fail();
        }
    }

    function h_connect(remote_address, callback_cap) {
        const callback_stub = ddev.h_reserve_stub(callback_cap);

        function on_open(connection) {
            core.h_release_stub(callback_stub);
            const conn_cap = h_register(connection);
            h_send(callback_cap, h_reply_ok(conn_cap));
        }

        function on_close(connection, reason) {
            if (connection !== undefined) {
                return h_unregister(connection, reason);
            }
            if (core.u_trace !== undefined) {
                core.u_trace("TCP connect failed", reason);
            }
            core.h_release_stub(callback_stub);
            h_send(callback_cap, h_reply_fail());
        }

        transport.connect(remote_address, on_open, h_receive, on_close);
    }

    ddev = make_ddev(function on_event_stub(event_stub_ptr) {
        const event_stub = core.u_read_quad(event_stub_ptr);
        const target = core.u_read_quad(core.u_cap_to_ptr(event_stub.x));
        const tag = ddev.u_tag(target.y);
        const event = core.u_read_quad(event_stub.y);
        const message = event.y;
        const callback = core.u_nth(message, 2);
        const request = core.u_nth(message, -2);
        if (!core.u_is_cap(callback)) {
            return ufork.E_NOT_CAP;
        }
        if (core.u_is_fix(tag)) {
            const {listener_nr, conn_nr} = decode_tag(tag);
            if (listener_nr !== undefined) {

// Stop listening.

                const listener = listeners[listener_nr];
                listeners[listener_nr] = undefined;
                if (listener !== undefined) {
                    listener.stop();
                    core.u_defer(listener.h_release);
                }
                return ufork.E_OK;
            }
            if (request === ufork.UNDEF_RAW) {

// Read request.

                core.u_defer(function () {
                    core.h_release_stub(event_stub_ptr);
                    const connection = connections[conn_nr];
                    if (connection === true) {
                        if (core.u_trace !== undefined) {
                            core.u_trace(`TCP #${conn_nr} read end of stream`);
                        }
                        return h_send(callback, h_reply_ok(ufork.NIL_RAW));
                    }
                    if (connection === false) {
                        if (core.u_trace !== undefined) {
                            core.u_trace(`TCP #${conn_nr} read after fail`);
                        }
                        return h_send(callback, h_reply_fail());
                    }
                    if (read_stubs[conn_nr] !== undefined) {
                        if (core.u_trace !== undefined) {
                            core.u_trace(`TCP #${conn_nr} double read`);
                        }
                        return h_send(callback, h_reply_fail());
                    }
                    if (core.u_trace !== undefined) {
                        core.u_trace(`TCP #${conn_nr} read`);
                    }
                    const stub = ddev.h_reserve_stub(callback);
                    read_stubs[conn_nr] = stub;
                    h_flush_read(conn_nr);
                });
                return ufork.E_OK;
            }
            if (core.u_is_cap(request)) {

// Write request.

                const blob_cap = request;
                const bytes = the_blob_dev.u_get_bytes(blob_cap);
                if (bytes === undefined) {
                    return ufork.E_BOUNDS; // not a blob
                }
                core.u_defer(function () {
                    core.h_release_stub(event_stub_ptr);
                    const connection = connections[conn_nr];
                    if (typeof connection !== "object") {
                        if (core.u_trace !== undefined) {
                            core.u_trace(`TCP #${conn_nr} write after close`);
                        }
                        return h_send(callback, h_reply_fail());
                    }
                    if (core.u_trace !== undefined) {
                        core.u_trace(`TCP #${conn_nr} write ${bytes.length}B`);
                    }
                    connection.send(bytes);
                    h_send(callback, h_reply_ok(ufork.UNDEF_RAW));
                });
                return ufork.E_OK;
            }
            if (request === ufork.NIL_RAW) {

// Close request.

                core.u_defer(function () {
                    core.h_release_stub(event_stub_ptr);
                    const connection = connections[conn_nr];
                    if (typeof connection === "object") {
                        connection.close();
                        h_unregister(connection);
                    }
                    h_send(callback, h_reply_ok(ufork.UNDEF_RAW));
                });
                return ufork.E_OK;
            }
            return ufork.E_BOUNDS;
        }
        if (core.u_is_fix(request)) {

// Connect request.

            const remote_petname = core.u_fix_to_i32(request);
            const remote_address = addresses[remote_petname];
            if (remote_address === undefined) {
                return ufork.E_BOUNDS;
            }
            core.u_defer(function () {
                core.h_release_stub(event_stub_ptr);
                h_connect(remote_address, callback);
            });
            return ufork.E_OK;
        }

// Listen request.

        const bind_petname_raw = core.u_nth(request, 1);
        if (!core.u_is_fix(bind_petname_raw)) {
            return ufork.E_NOT_FIX;
        }
        const bind_address = addresses[core.u_fix_to_i32(bind_petname_raw)];
        if (bind_address === undefined) {
            return ufork.E_BOUNDS;
        }
        const on_open = core.u_nth(request, 2);
        if (!core.u_is_cap(on_open)) {
            return ufork.E_NOT_CAP;
        }
        const on_close = core.u_nth(request, -2);
        if (!core.u_is_cap(on_close)) {
            return ufork.E_NOT_CAP;
        }
        core.u_defer(function () {
            core.h_release_stub(event_stub_ptr);
            const reply = h_listen(bind_address, on_open, on_close);
            h_send(callback, reply);
        });
        return ufork.E_OK;
    });
    const dev_cap = ddev.h_reserve_proxy();
    const dev_id = core.u_fixnum(tcp_key);
    core.h_install(dev_id, dev_cap, function on_dispose() {
        if (core.u_trace !== undefined) {
            core.u_trace("TCP disposing all connections");
        }
        connections.forEach(function (connection) {
            if (typeof connection === "object") {
                connection.close();
                h_unregister(connection);
            }
        });
        listeners.forEach(function (listener) {
            if (listener !== undefined) {
                listener.stop();
            }
        });
    });
    ddev.h_reserve_stub(dev_cap);
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
        on_audit(code, evidence) {
            log(
                "AUDIT:",
                core.u_fault_msg(core.u_fix_to_i32(code)),
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
        requestorize(function (asm_module) {
            const make_ddev = host_dev(core);
            tcp_dev(
                core,
                make_ddev,
                blob_dev(core, make_ddev),
                ["127.0.0.1:8370"],
                mock_transport()
            );
            core.h_boot(asm_module.boot);
            run_core();
            return true;
        })
    ])(log);
    setTimeout(core.h_dispose, 5000);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(tcp_dev);
