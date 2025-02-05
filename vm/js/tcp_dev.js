// Installs the TCP network device.

// The TCP device must be provided with a transport. Transports abstract away
// platform-specific aspects of TCP implementation, exposing a uniform
// interface comprising two functions: listen and connect.

//  transport.listen(bind_address, on_open)

//      Listen for TCP connections on the given 'bind_address', returning a
//      'stop' function that can be called to stop listening. The 'on_open'
//      callback is passed each new connection object.

//  transport.connect(address)

//      Attempt to forge a TCP connection with the given address. The returned
//      Promise resolves to a connection object once the connection is open.

// Connection objects have the following methods:

//  connection.read()
//      Read the next chunk of binary data from the connection,
//      returning a Promise that resolves to a Uint8Array, or undefined
//      if the connection was closed by the other side.

//  connection.write(chunk)
//      Send a Uint8Array 'chunk' over the connection. The returned
//      Promise resolves once the connection is ready for the next
//      write. To gracefully close the connection, pass undefined as
//      'chunk'.

//  connection.dispose(reason)
//      Tear down the connection immediately. Pending read or write Promises are
//      rejected with 'reason'.

/*jslint web, global */

import assemble from "https://ufork.org/lib/assemble.js";
import compile_humus from "https://ufork.org/lib/humus.js";
import parseq from "https://ufork.org/lib/parseq.js";
import bind from "https://ufork.org/lib/rq/bind.js";
import lazy from "https://ufork.org/lib/rq/lazy.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import unpromise from "https://ufork.org/lib/rq/unpromise.js";
import blob_dev from "./blob_dev.js";
import host_dev from "./host_dev.js";
import ufork from "./ufork.js";
import tcp_transport_mock from "./tcp_transport_mock.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");
const hum_demo_url = import.meta.resolve("./tcp_dev_demo.hum");

const tcp_key = 102; // from dev.asm

function encode_tag({listener_nr, conn_nr}) {
    return (
        listener_nr !== undefined
        ? ufork.fixnum(-listener_nr - 1)
        : ufork.fixnum(conn_nr)
    );
}

function decode_tag(tag) {
    const integer = ufork.fix_to_i32(tag);
    return (
        integer < 0
        ? {listener_nr: -1 - integer}
        : {conn_nr: integer}
    );
}

// console.log(decode_tag(encode_tag({listener_nr: 6})));
// console.log(decode_tag(encode_tag({conn_nr: 7})));

function tcp_dev(
    core,
    make_ddev,
    the_blob_dev,
    addresses,
    transport = tcp_transport_mock()
) {
    const sponsor = ufork.ramptr(ufork.SPONSOR_OFS);
    let ddev;
    let disposed = false;
    let connections = [];                   // conn_nr -> connection
    let referenced = [];                    // conn_nr -> true/undefined
    let reading = [];                       // conn_nr -> true/undefined
    let writing = [];                       // conn_nr -> true/undefined
    let listeners = [];                     // listener_nr -> {stop, h_release}

    function u_trace(...values) {
        if (core.u_trace !== undefined) {
            core.u_trace("TCP", ...values);
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

    function h_register(connection) {
        const conn_nr = connections.length;
        connections.push(connection);
        referenced[conn_nr] = true;
        u_trace(`#${conn_nr} opened`);
        const tag = encode_tag({conn_nr});
        return ddev.h_reserve_proxy(tag);
    }

    function u_check_forgotten(conn_nr) {
        if (
            referenced[conn_nr] === undefined
            && reading[conn_nr] === undefined
            && writing[conn_nr] === undefined
        ) {
            connections[conn_nr].dispose();
        }
    }

    function h_listen(bind_address, on_open_cap) {
        const on_open_stub = ddev.h_reserve_stub(on_open_cap);
        try {
            const listener_nr = listeners.length;
            const listener_tag = encode_tag({listener_nr});
            const stop = transport.listen(
                bind_address,
                function on_open(connection) {
                    if (disposed) {
                        return;
                    }
                    const conn_cap = h_register(connection);
                    h_send(on_open_cap, conn_cap);
                }
            );
            listeners.push({
                stop,
                h_release() {
                    core.h_release_stub(on_open_stub);
                }
            });
            const stop_cap = ddev.h_reserve_proxy(listener_tag);
            u_trace(`%${listener_nr} listening`);
            return h_reply_ok(stop_cap);
        } catch (exception) {
            u_trace("listen failed", exception);
            return h_reply_fail();
        }
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

        function u_write_chunks(conn_nr) {
            const undefined_value = true;
            const connection = connections[conn_nr];
            return lazy(function (chunk_array) {
                return parseq.sequence(chunk_array.map(function (chunk) {
                    return unpromise(function () {
                        return connection.write(chunk);
                    }, undefined_value);
                }));
            }, undefined_value);
        }

        if (ufork.is_fix(tag)) {
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
                    if (reading[conn_nr] === true) {
                        core.h_release_stub(event_stub_ptr);
                        u_trace(`#${conn_nr} read busy`);
                        return h_send(callback, h_reply_fail());
                    }
                    reading[conn_nr] = true;
                    const eof = false;
                    unpromise(
                        connections[conn_nr].read,
                        eof
                    )(function (chunk, reason) {
                        if (disposed) {
                            return;
                        }
                        reading[conn_nr] = false;
                        u_check_forgotten(conn_nr);
                        core.h_release_stub(event_stub_ptr);
                        if (chunk === undefined) {
                            u_trace(`#${conn_nr} read fail`, reason);
                            return h_send(callback, h_reply_fail());
                        }
                        if (chunk === eof) {
                            u_trace(`#${conn_nr} read EOF`);
                            return h_send(callback, h_reply_ok(ufork.NIL_RAW));
                        }
                        u_trace(`#${conn_nr} read ${chunk.length}B`);
                        const blob = the_blob_dev.h_alloc_blob(chunk);
                        return h_send(callback, h_reply_ok(blob.cap));
                    });
                });
                return ufork.E_OK;
            }
            if (ufork.is_cap(request) || request === ufork.NIL_RAW) {

// Write request.

                const is_close = request === ufork.NIL_RAW;
                core.u_defer(function () {
                    if (writing[conn_nr] === true) {
                        core.h_release_stub(event_stub_ptr);
                        u_trace(`#${conn_nr} write busy`);
                        return h_send(callback, h_reply_fail());
                    }
                    writing[conn_nr] = true;
                    parseq.sequence([
                        (
                            is_close
                            ? requestorize(() => [undefined])
                            : bind(the_blob_dev.h_read_chunks(), request)
                        ),
                        u_write_chunks(conn_nr)
                    ])(function (value, reason) {
                        if (disposed) {
                            return;
                        }
                        writing[conn_nr] = undefined;
                        u_check_forgotten(conn_nr);
                        core.h_release_stub(event_stub_ptr);
                        if (value === undefined) {
                            u_trace(`#${conn_nr} write failed`, reason);
                            return h_send(callback, h_reply_fail());
                        }
                        u_trace(`#${conn_nr} ` + (
                            is_close
                            ? "close"
                            : "write"
                        ));
                        return h_send(callback, h_reply_ok(ufork.UNDEF_RAW));
                    });
                });
                return ufork.E_OK;
            }
            return ufork.E_BOUNDS;
        }
        if (ufork.is_fix(request)) {

// Connect request.

            const remote_petname = ufork.fix_to_i32(request);
            const remote_address = addresses[remote_petname];
            if (remote_address === undefined) {
                return ufork.E_BOUNDS;
            }
            core.u_defer(function () {
                unpromise(transport.connect)(
                    function (connection, reason) {
                        if (disposed) {
                            return;
                        }
                        core.h_release_stub(event_stub_ptr);
                        if (connection !== undefined) {
                            const conn_cap = h_register(connection);
                            h_send(callback, h_reply_ok(conn_cap));
                        } else {
                            u_trace("connect failed", remote_address, reason);
                            h_send(callback, h_reply_fail());
                        }
                    },
                    remote_address
                );
            });
            return ufork.E_OK;
        }

// Listen request.

        const bind_petname_raw = core.u_nth(request, 1);
        if (!ufork.is_fix(bind_petname_raw)) {
            return ufork.E_NOT_FIX;
        }
        const bind_address = addresses[ufork.fix_to_i32(bind_petname_raw)];
        if (bind_address === undefined) {
            return ufork.E_BOUNDS;
        }
        const on_open = core.u_nth(request, -1);
        if (!ufork.is_cap(on_open)) {
            return ufork.E_NOT_CAP;
        }
        core.u_defer(function () {
            core.h_release_stub(event_stub_ptr);
            const reply = h_listen(bind_address, on_open);
            h_send(callback, reply);
        });
        return ufork.E_OK;
    }

    function on_drop_proxy(proxy_raw) {
        const quad = core.u_read_quad(ufork.cap_to_ptr(proxy_raw));
        const tag = ddev.u_tag(quad.y);
        if (ufork.is_fix(tag)) {
            const {conn_nr} = decode_tag(tag);
            if (conn_nr !== undefined) {
                u_trace(`#${conn_nr} proxy dropped`);
                referenced[conn_nr] = undefined;
                u_check_forgotten(conn_nr);
            }
        }
    }

    ddev = make_ddev(on_event_stub, on_drop_proxy);
    const dev_cap = ddev.h_reserve_proxy();
    const dev_id = ufork.fixnum(tcp_key);
    core.h_install(dev_id, dev_cap, function on_dispose() {
        disposed = true;
        connections.forEach(function (connection) {
            connection.dispose();
        });
        listeners.forEach(function (listener) {
            if (listener !== undefined) {
                listener.stop();
            }
        });
    });
    ddev.h_reserve_stub(dev_cap);
}

function demo(log, flakiness = 0, max_chunk_size = 16) {
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
        requestorize(function (demo_module) {
            const make_ddev = host_dev(core);
            tcp_dev(
                core,
                make_ddev,
                blob_dev(core, make_ddev),
                ["127.0.0.1:8370"],
                tcp_transport_mock(flakiness, max_chunk_size)
            );
            core.h_boot(demo_module.boot);
            core.h_refill({memory: 65536, events: 65536, cycles: 65536});
            run_core();
            return true;
        })
    ])(log);
    setTimeout(function () {
        log("disposing core");
        core.h_dispose();
    }, 5000);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(tcp_dev);
