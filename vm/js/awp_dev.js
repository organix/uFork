// Installs the AWP device, allowing cores to communicate over the network via
// the Actor Wire Protocol. See also awp.md and awp_dev.md.

// This device makes two kinds of proxies: "remote" and "stop".
// The two kinds can be distinguished by the type of their tag:
//  - Remote capabilities (transparent references to remote actors) have a
//    fixnum as their tag.
//  - Stop capabilities (used to stop listening) have a wrapped fixnum as their
//    tag.

/*jslint web, null, devel, long */

// TODO:
// - distributed garbage collection
// - acquaintance interning
// - cancel/stop capabilities
// - disconnect when all proxies are dropped?

import ufork from "./ufork.js";
import assemble from "https://ufork.org/lib/assemble.js";
import OED from "https://ufork.org/lib/oed.js";
import hex from "https://ufork.org/lib/hex.js";

const E_CONNECTION_LOST = -1;
const E_ALREADY_LISTENING = -2;
const E_LISTEN_FAIL = -3;
const E_NO_ACQUAINTANCE = -4;
const E_NO_STORE = -5;

const awp_key = 100; // from dev.asm
const once_fwd_ir = assemble(`
sink_beh:
    end commit

beh:                    ; callback <- message
    msg 0               ; message
    state 0             ; message callback
    send -1             ; --
    push sink_beh       ; sink_beh
    beh 0               ; --
    end commit

.export
    beh
`);

function stringify(value) {

// Returns a string representation of an OED-encodable value.

    return hex.encode(OED.encode(value));
}

function awp_dev({
    core,
    make_ddev,
    transport,
    on_store_change,
    stores = [],
    webcrypto = crypto // Node.js does not have a 'crypto' global as of v19.
}) {
    const sponsor = core.u_ramptr(ufork.SPONSOR_OFS);
    const once_fwd_beh = core.h_load(once_fwd_ir).beh;

    let ddev;                                 // the dynamic device
    let connections = Object.create(null);    // local:remote -> connection
    let opening = Object.create(null);        // local:remote -> cancel function
    let outbox = Object.create(null);         // local:remote -> messages
    let lost = Object.create(null);           // local:remote -> functions      // TODO are these ever cleaned up?
    let raw_to_swiss = Object.create(null);   // raw -> swiss
    let stubs = Object.create(null);          // swiss -> stub raw              // TODO release at some point
    let listener_keys = Object.create(null);  // proxy tag -> local             // TODO implement safe_stop proxies
    let listeners = Object.create(null);      // local -> {greeter, stop}
    let proxy_keys = Object.create(null);     // proxy tag -> proxy key
    let proxies = Object.create(null);        // proxy key -> data
    let next_proxy_tag = 0;

    function random_swiss() {
        let swiss = new Uint8Array(16); // 128 bits
        webcrypto.getRandomValues(swiss);
        return swiss;
    }

    function get_proxy(store, petname, swiss) {
        const proxy_key = [
            stores.indexOf(store),
            petname,
            hex.encode(swiss)
        ].join(":");
        if (proxies[proxy_key] !== undefined) {
            return proxies[proxy_key].raw;
        }
        const remote_tag = next_proxy_tag;
        next_proxy_tag += 1;
        proxy_keys[remote_tag] = proxy_key;
        const raw = ddev.h_reserve_proxy(core.u_fixnum(remote_tag));
        proxies[proxy_key] = {raw, swiss, store, petname};
        return raw;
    }

    function get_petname(store, acquaintance) {

// Determine the petname of an acquaintance, adding them to the store if
// necessary.

        const key = stringify(acquaintance.name);
        const match = store.acquaintances.find(function (the_acquaintance) {
            return key === stringify(the_acquaintance.name);
        });
        if (match !== undefined && acquaintance.address !== undefined) {

// Add the acquaintance's address to the store, overwriting the previous one.
// This behavior facilitates a kind of primitive redirect, and may be a bad
// idea.

            match.address = acquaintance.address;
        }
        let petname = store.acquaintances.indexOf(match);
        if (petname === -1) {
            petname = store.acquaintances.length;
            store.acquaintances.push(acquaintance);
            if (on_store_change !== undefined) {
                on_store_change(store);
            }
        }
        return petname;
    }

//  uFork           | OED
//  ----------------|---------------
//  #?              | null
//  #t              | true
//  #f              | false
//  #nil            | []
//  (a . b)         | [a, b]
//  fixnum          | integer
//  capability      | ext(acquaintance, swiss)

    function marshall(store, value) {
        return OED.encode(value, function pack(raw, path) {
            if (path.includes(false)) {
                return {value: raw}; // meta
            }
            if (raw === ufork.UNDEF_RAW) {
                return {value: null};
            }
            if (raw === ufork.TRUE_RAW) {
                return {value: true};
            }
            if (raw === ufork.FALSE_RAW) {
                return {value: false};
            }
            if (raw === ufork.NIL_RAW) {
                return {value: []};
            }
            if (core.u_is_fix(raw)) {
                return {value: core.u_fix_to_i32(raw)};
            }
            if (core.u_is_ptr(raw)) {
                const pair = core.u_read_quad(raw);
                if (pair.t === ufork.PAIR_T) {
                    return {value: [pair.x, pair.y]};
                }
            }
            if (core.u_is_cap(raw)) {
                const quad = core.u_read_quad(core.u_cap_to_ptr(raw));
                const tag_raw = ddev.u_tag(quad.y);
                if (ddev.u_owns_proxy(raw) && core.u_is_fix(tag_raw)) {

// The proxy's tag is a fixnum only if the proxy refers to a remote actor.
// Rather than allocating it a Swiss number, pass on its details directly.

                    const remote_tag = core.u_fix_to_i32(tag_raw);
                    const proxy = proxies[proxy_keys[remote_tag]];
                    if (proxy !== undefined) {
                        const acquaintance = proxy.store.acquaintances[
                            proxy.petname
                        ];
                        return {
                            meta: acquaintance,
                            data: proxy.swiss
                        };
                    }
                }

// The capability is a local actor or some other kind of proxy.

                let swiss = raw_to_swiss[raw];
                if (
                    swiss === undefined
                    || stubs[hex.encode(swiss)] === undefined
                ) {

// There is no stub corresponding to this capability, making it vulnerable to
// garbage collection. Generate a new Swiss number and reserve a stub.

                    swiss = random_swiss();
                    stubs[hex.encode(swiss)] = ddev.h_reserve_stub(raw);
                    raw_to_swiss[raw] = swiss;
                }
                return {
                    meta: store.acquaintances[0], // self
                    data: swiss
                };
            }
            throw new Error("Failed to marshall " + core.u_pprint(value));
        });
    }

    function unmarshall(store, buffer) {
        return OED.decode(buffer, function unpack(object, canonical, path) {
            if (path.includes(false)) {
                return canonical(); // meta
            }
            if (object.value === null) {
                return ufork.UNDEF_RAW;
            }
            if (object.value === true) {
                return ufork.TRUE_RAW;
            }
            if (object.value === false) {
                return ufork.FALSE_RAW;
            }
            if (Array.isArray(object.value)) {
                if (object.value.length === 2) {
                    return core.h_reserve_ram({
                        t: ufork.PAIR_T,
                        x: object.value[0],
                        y: object.value[1]
                    });
                }
                if (object.value.length === 0) {
                    return ufork.NIL_RAW;
                }
            }
            if (
                object.natural !== undefined
                || Number.isSafeInteger(object.value)
            ) {
                return core.u_fixnum(canonical());
            }
            if (typeof object.meta === "object") {
                return get_proxy(
                    store,
                    get_petname(store, object.meta),
                    object.data
                );
            }
            throw new Error("Failed to unmarshall " + JSON.stringify(object));
        });
    }

    function convo_key(local_name, remote_name) {
        return stringify(local_name) + ":" + stringify(remote_name);
    }

    function lose(key) {

// Inform the relevant listeners of connection loss.

        if (lost[key] !== undefined) {
            lost[key].forEach(function (on_lost) {
                on_lost();
            });
            delete lost[key];
        }
    }

    function resume() {
        core.h_wakeup(ufork.HOST_DEV_OFS);
    }

    function unregister(key) {
        lose(key);
        delete outbox[key];
        delete connections[key];
    }

    function receive(store, connection, frame) {
        if (frame.target === undefined) {

// The frame is an introduction request. Forward it to the greeter.

            const greeter_stub = listeners[
                stringify(store.acquaintances[0].name) // self
            ]?.greeter;
            if (greeter_stub === undefined) {
                if (core.u_warn !== undefined) {
                    core.u_warn("No greeter", store, frame);
                }
                return;
            }
            const greeter = core.u_read_quad(greeter_stub).y;
            const acquaintance = {name: connection.name()};
            const petname = get_petname(store, acquaintance);
            const message = unmarshall(store, frame.message);
            const greeting_callback = core.u_nth(message, 1);
            const hello_data = core.u_nth(message, -1);

// (to_cancel greeting_callback petname . hello) -> greeter

            core.h_event_enqueue(core.h_reserve_ram({
                t: sponsor,
                x: greeter,
                y: core.h_reserve_ram({
                    t: ufork.PAIR_T,
                    x: ufork.UNDEF_RAW, // TODO to_cancel
                    y: core.h_reserve_ram({
                        t: ufork.PAIR_T,
                        x: greeting_callback,
                        y: core.h_reserve_ram({
                            t: ufork.PAIR_T,
                            x: core.u_fixnum(petname),
                            y: hello_data
                        })
                    })
                })
            }));
            return resume();
        }

// The frame is a message addressed to a particular actor (or proxy).

        const stub = stubs[hex.encode(frame.target)];
        if (stub !== undefined) {
            core.h_event_enqueue(core.h_reserve_ram({
                t: sponsor,
                x: core.u_read_quad(stub).y,
                y: unmarshall(store, frame.message)
            }));
            return resume();
        }
        if (core.u_warn !== undefined) {
            core.u_warn("Missing stub", store, frame);
        }
    }

    function flush(key) {

// Attempt to send the relevant messages from the outbox.

        if (outbox[key] === undefined || outbox[key].length === 0) {
            return;
        }
        if (connections[key] !== undefined) {

// There is already a connection.

            outbox[key].forEach(function ({swiss, message}) {
                connections[key].send(OED.encode({
                    target: swiss,
                    message
                }));
            });
            delete outbox[key];
            return;
        }
        if (opening[key] !== undefined) {

// A connection is currently being opened.

            return;
        }

// There is no connection opened or opening. Connect.

        const {store, petname} = outbox[key][0];
        const cancel = transport.connect(
            store.identity,
            store.acquaintances[petname].name,
            store.acquaintances[petname].address,
            function on_receive(connection, frame_buffer) {
                const frame = OED.decode(frame_buffer);
                if (core.u_debug !== undefined) {
                    core.u_debug("connect on_receive");
                }
                return receive(store, connection.name(), frame);
            },
            function on_close(connection, reason) {
                if (core.u_debug !== undefined) {
                    core.u_debug("connect on_close");
                }
                unregister(convo_key(
                    store.acquaintances[0].name, // self
                    connection.name()
                ));
                return resume();
            }
        )(
            function connected_callback(connection, reason) {
                delete opening[key];
                if (connection === undefined) {
                    if (core.u_debug !== undefined) {
                        core.u_debug("connect fail", reason);
                    }
                    lose(key);
                    return resume();
                }
                if (core.u_debug !== undefined) {
                    core.u_debug("connect open");
                }
                register(store, connection);
            }
        );
        // TODO forward cancel capability to to_cancel
        opening[key] = function () {
            if (typeof cancel === "function") {
                cancel();
            }
            delete opening[key];
        };
    }

    function register(store, connection) {
        const key = convo_key(store.acquaintances[0].name, connection.name());

// If we have been trying to connect, give up.

        const cancel = opening[key];
        if (cancel !== undefined) {
            cancel();
        }
        if (connections[key] === undefined) {

// Use the connection object to send any pending messages.

            connections[key] = connection;
            return flush(key);
        }

// There is already a connection between the two parties. We don't need both, so
// we should close one of them. But which one do we close?

// One plausible scenario is that the existing connection appears closed to the
// initiating party, but open to us. So let's close the old connection and keep
// the new connection open.

// It is unclear how well this strategy works when two parties attempt to
// connect to each other at the same time.

// TODO this makes it impossible for a party to connect to itself.

        connections[key].close();
        connections[key] = connection;
    }

    function add(object, key, element) {
        if (object[key] === undefined) {
            object[key] = [];
        }
        object[key].push(element);
    }

    function enqueue(store, petname, swiss, message) {
        const acquaintance = store.acquaintances[petname];
        const key = convo_key(store.acquaintances[0].name, acquaintance.name);
        add(outbox, key, {store, petname, swiss, message});
        return flush(key);
    }

    function intro(event_stub_ptr, request) {
        const intro_callback = core.u_nth(request, 2);
        const store_fix = core.u_nth(request, 3);
        const petname_fix = core.u_nth(request, 4);
        const hello_data = core.u_nth(request, -4);

// Validate the message.

        if (!core.u_is_cap(intro_callback)) {
            if (core.u_warn !== undefined) {
                core.u_warn(
                    "#intro",
                    "not a callback",
                    core.u_pprint(intro_callback)
                );
            }
            return ufork.E_NOT_CAP;
        }
        if (!core.u_is_fix(store_fix)) {
            if (core.u_warn !== undefined) {
                core.u_warn(
                    "#intro",
                    "not a store",
                    core.u_pprint(store_fix)
                );
            }
            return ufork.E_NOT_FIX;
        }
        if (!core.u_is_fix(petname_fix)) {
            if (core.u_warn !== undefined) {
                core.u_warn(
                    "#intro",
                    "not a petname",
                    core.u_pprint(petname_fix)
                );
            }
            return ufork.E_NOT_FIX;
        }
        const store_nr = core.u_fix_to_i32(store_fix);
        const petname = core.u_fix_to_i32(petname_fix);
        core.u_defer(function () {
            core.h_release_stub(event_stub_ptr);

// Send a failed result to the callback if the acquaintance can not be found.

            const store = stores[store_nr];
            if (
                store === undefined
                || store.acquaintances[petname]?.name === undefined
            ) {
                core.h_event_enqueue(core.h_reserve_ram({
                    t: sponsor,
                    x: intro_callback,
                    y: core.h_reserve_ram({
                        t: ufork.PAIR_T,
                        x: ufork.FALSE_RAW,
                        y: core.u_fixnum(
                            store === undefined
                            ? E_NO_STORE
                            : E_NO_ACQUAINTANCE
                        )
                    })
                }));
                return resume();
            }
            const callback_fwd = core.u_ptr_to_cap(core.h_reserve_ram({
                t: ufork.ACTOR_T,
                x: once_fwd_beh,
                y: intro_callback
            }));

// Enqueue the introduction request.

            enqueue(
                store,
                petname,
                undefined,
                marshall(store, core.h_reserve_ram({
                    t: ufork.PAIR_T,
                    x: callback_fwd, // retained by a stub
                    y: hello_data
                }))
            );
            const key = convo_key(
                store.acquaintances[0].name,
                store.acquaintances[petname].name
            );
            add(lost, key, function on_lost() {
                if (core.u_debug !== undefined) {
                    core.u_debug("intro fail");
                }
                core.h_event_enqueue(core.h_reserve_ram({
                    t: sponsor,
                    x: callback_fwd,
                    y: core.h_reserve_ram({
                        t: ufork.PAIR_T,
                        x: ufork.FALSE_RAW,
                        y: core.u_fixnum(E_CONNECTION_LOST)
                    })
                }));
            });

// TODO send a cancel capability to the to_cancel. Should we also neuter
// callback_fwd?

        });
        return ufork.E_OK;
    }

    function listen(event_stub_ptr, request) {
        const listen_callback = core.u_nth(request, 2);
        const store_fix = core.u_nth(request, 3);
        const greeter = core.u_nth(request, 4);

// Validate the message.

        if (!core.u_is_cap(listen_callback)) {
            if (core.u_warn !== undefined) {
                core.u_warn(
                    "#listen",
                    "not a callback",
                    core.u_pprint(listen_callback)
                );
            }
            return ufork.E_NOT_CAP;
        }
        if (!core.u_is_fix(store_fix)) {
            if (core.u_warn !== undefined) {
                core.u_warn(
                    "#listen",
                    "not a store",
                    core.u_pprint(store_fix)
                );
            }
            return ufork.E_NOT_FIX;
        }
        if (!core.u_is_cap(greeter)) {
            if (core.u_warn !== undefined) {
                core.u_warn(
                    "#listen",
                    "not a greeter",
                    core.u_pprint(greeter)
                );
            }
            return ufork.E_NOT_CAP;
        }

        function release_event_stub() {
            if (event_stub_ptr !== undefined) {
                core.h_release_stub(event_stub_ptr);
                event_stub_ptr = undefined;
            }
        }

        function resolve(result) {

// (ok . stop/error) -> listen_callback

            core.h_event_enqueue(core.h_reserve_ram({
                t: sponsor,
                x: listen_callback,
                y: result
            }));
            release_event_stub();
            return resume();
        }
        core.u_defer(function () {
            const store = stores[core.u_fix_to_i32(store_fix)];
            if (store === undefined) {
                return resolve(core.h_reserve_ram({
                    t: ufork.PAIR_T,
                    x: ufork.FALSE_RAW,
                    y: core.u_fixnum(E_NO_STORE)
                }));
            }
            // TODO send cancel to to_cancel
            const cancel = transport.listen(
                store.identity,
                store.bind_info,
                function on_open(connection) {
                    if (core.u_debug !== undefined) {
                        core.u_debug("listen on_open");
                    }
                    return register(store, connection);
                },
                function on_receive(connection, frame_buffer) {
                    const frame = OED.decode(frame_buffer);
                    if (core.u_debug !== undefined) {
                        core.u_debug("listen on_receive");
                    }
                    return receive(store, connection, frame);
                },
                function on_close(connection, reason) {
                    if (core.u_debug !== undefined) {
                        core.u_debug("listen on_close", reason);
                    }
                    return unregister(convo_key(
                        store.acquaintances[0].name,
                        connection.name()
                    ));
                }
            )(
                function listening_callback(stop, reason) {
                    if (stop === undefined) {
                        if (core.u_debug !== undefined) {
                            core.u_debug("listen fail", reason);
                        }
                        return resolve(core.h_reserve_ram({
                            t: ufork.PAIR_T,
                            x: ufork.FALSE_RAW,
                            y: core.u_fixnum(E_LISTEN_FAIL)
                        }));
                    }

// Fail if the store is already listening.

                    const key = stringify(store.acquaintances[0].name);
                    if (listeners[key] !== undefined) {
                        stop();
                        return resolve(core.h_reserve_ram({
                            t: ufork.PAIR_T,
                            x: ufork.FALSE_RAW,
                            y: core.u_fixnum(E_ALREADY_LISTENING)
                        }));
                    }

                    function safe_stop() {
                        if (core.u_debug !== undefined) {
                            core.u_debug("listen stop");
                        }
                        const listener = listeners[key];
                        if (listener.greeter !== undefined) {
                            core.h_release_stub(listener.greeter);
                        }
                        delete listeners[key];
                        return stop();
                    }

                    listeners[key] = {
                        greeter: ddev.h_reserve_stub(greeter),
                        stop: safe_stop
                    };

// Make a "stop" capabililty, put it in a successful result, and send it to the
// callback.

                    const stop_tag = next_proxy_tag;
                    next_proxy_tag += 1;
                    listener_keys[stop_tag] = key;
                    const stop_proxy = ddev.h_reserve_proxy(
                        core.h_reserve_ram({
                            t: ufork.PAIR_T,
                            x: core.u_fixnum(stop_tag),
                            y: ufork.NIL_RAW
                        })
                    );
                    return resolve(core.h_reserve_ram({
                        t: ufork.PAIR_T,
                        x: ufork.TRUE_RAW,
                        y: stop_proxy
                    }));
                }
            );

            // TODO provide to to_cancel
            function safe_cancel() {
                release_event_stub();
                cancel();
            }

        });
        return ufork.E_OK;
    }

// Install the device.

    ddev = make_ddev(
        function on_event_stub(event_stub_ptr) {

// The event stub retains the event, including its message, in memory until
// explicitly released. This is necessary because h_reserve_stub is
// non-reentrant, so marshalling must take place on a future turn and we don't
// want the message to be GC'd in the meantime.

            const event_stub = core.u_read_quad(event_stub_ptr);
            const event = core.u_read_quad(event_stub.y);
            const message = event.y;

// Inspect the event target. If it is a proxy, check if it is a stop capability
// or a reference to a remote actor.

            const target_quad = core.u_read_quad(core.u_cap_to_ptr(event.x));
            const tag_raw = ddev.u_tag(target_quad.y);

// Remote actor proxies have a fixnum tag.

            if (core.u_is_fix(tag_raw)) {
                const remote_tag = core.u_fix_to_i32(tag_raw);
                core.u_defer(function () {
                    const proxy = proxies[proxy_keys[remote_tag]];
                    if (proxy !== undefined) {
                        enqueue(
                            proxy.store,
                            proxy.petname,
                            proxy.swiss,
                            marshall(proxy.store, message)
                        );
                    }
                    core.h_release_stub(event_stub_ptr);
                });
                return ufork.E_OK;
            }

// "Stop listening" proxy tags are a wrapped fixnum.

            const stop_tag_raw = core.u_nth(tag_raw, 1);
            if (core.u_is_fix(stop_tag_raw)) {
                core.u_defer(function () {
                    const stop_tag = core.u_fix_to_i32(stop_tag_raw);
                    const listener_key = listener_keys[stop_tag];
                    if (listener_key !== undefined) {
                        const listener = listeners[listener_key];
                        if (listener !== undefined) {
                            listener.stop();
                        }
                        delete listener_keys[stop_tag];
                    }
                    core.h_release_stub(event_stub_ptr);
                });
                return ufork.E_OK;
            }

// Otherwise the proxy is the device capability. Choose a method based on the
// message tag (#intro, #listen, etc).

            const tag = core.u_nth(message, 1);
            const method_array = [intro, listen];
            const method = method_array[core.u_fix_to_i32(tag)];
            if (method === undefined) {
                if (core.u_warn !== undefined) {
                    core.u_warn("not a tag", core.u_pprint(tag));
                }
                return (
                    core.u_is_fix(tag)
                    ? ufork.E_BOUNDS
                    : ufork.E_NOT_FIX
                );
            }

// Forward the remainder of the message to the chosen method. The method may
// need to reserve stubs for the portions of the message it will need later.
// When the method is done doing that, it should release the event stub.

            return method(event_stub_ptr, core.u_nth(message, -1));
        },
        function on_drop_proxy(proxy_raw) {

// A proxy has been garbage collected.

            const quad = core.u_read_quad(core.u_cap_to_ptr(proxy_raw));

// Is it a reference to a remote actor? If so, clean up any references to it and
// inform the relevant party.

            const tag_raw = ddev.u_tag(quad.y);
            if (core.u_is_fix(tag_raw)) {
                const remote_tag = core.u_fix_to_i32(tag_raw);
                const proxy_key = proxy_keys[remote_tag];
                if (proxy_key !== undefined) {

// TODO inform the relevant party.

                    delete proxy_keys[remote_tag];
                    delete proxies[proxy_key];
                }
            }
        }
    );

// Install the dynamic device as if it were a real device. Unlike a real device,
// we must reserve a stub to keep the capability from being released.

    const dev_cap = ddev.h_reserve_proxy(ufork.UNDEF_RAW);
    const dev_id = core.u_fixnum(awp_key);
    core.h_install(dev_id, dev_cap, function on_dispose() {
        Object.values(connections).forEach((connection) => connection.close());
        Object.values(listeners).forEach((listener) => listener.stop());
    });
    ddev.h_reserve_stub(dev_cap);
}

//debug import parseq from "https://ufork.org/lib/parseq.js";
//debug import requestorize from "https://ufork.org/lib/rq/requestorize.js";
//debug import host_dev from "./host_dev.js";
//debug const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");
//debug const asm_url = import.meta.resolve("../../apps/grant_matcher/grant_matcher.asm");
//debug const lib_url = import.meta.resolve("../../lib/");
//debug const core = ufork.make_core({
//debug     wasm_url,
//debug     on_wakeup(device_offset) {
//debug         console.log("WAKE:", device_offset);
//debug         console.log("IDLE:", core.u_fault_msg(core.u_fix_to_i32(
//debug             core.h_run_loop()
//debug         )));
//debug     },
//debug     on_log: console.log,
//debug     log_level: ufork.LOG_DEBUG,
//debug     import_map: {"https://ufork.org/lib/": lib_url},
//debug     compilers: {asm: assemble}
//debug });
//debug function demo({
//debug     transport,
//debug     bob_address,
//debug     bob_bind_info = bob_address,
//debug     carol_address,
//debug     carol_bind_info = carol_address,
//debug     webcrypto
//debug }) {
//debug     return parseq.sequence([
//debug         core.h_initialize(),
//debug         parseq.parallel([
//debug             core.h_import(asm_url),
//debug             transport.generate_identity(),
//debug             transport.generate_identity(),
//debug             transport.generate_identity(),
//debug             transport.generate_identity()
//debug         ]),
//debug         requestorize(function ([
//debug             asm_module,
//debug             alice_identity,
//debug             bob_identity,
//debug             carol_identity,
//debug             dana_identity
//debug         ]) {
//debug             const alice = {
//debug                 name: transport.identity_to_name(alice_identity)
//debug             };
//debug             const bob = {
//debug                 name: transport.identity_to_name(bob_identity),
//debug                 address: bob_address
//debug             };
//debug             const carol = {
//debug                 name: transport.identity_to_name(carol_identity),
//debug                 address: carol_address
//debug             };
//debug             const dana = {
//debug                 name: transport.identity_to_name(dana_identity)
//debug             };
//debug             const stores = [
//debug                 {
//debug                     identity: alice_identity,
//debug                     acquaintances: [alice, bob, carol]
//debug                 },
//debug                 {
//debug                     identity: bob_identity,
//debug                     bind_info: bob_bind_info,
//debug                     acquaintances: [bob]
//debug                 },
//debug                 {
//debug                     identity: carol_identity,
//debug                     bind_info: carol_bind_info,
//debug                     acquaintances: [carol]
//debug                 },
//debug                 {
//debug                     identity: dana_identity,
//debug                     acquaintances: [dana, bob, carol]
//debug                 }
//debug             ];
//debug             const make_ddev = host_dev(core);
//debug             awp_dev({
//debug                 core,
//debug                 make_ddev,
//debug                 transport,
//debug                 stores,
//debug                 webcrypto
//debug             });
//debug             core.h_boot(asm_module.boot);
//debug             console.log("IDLE:", core.u_fault_msg(core.u_fix_to_i32(
//debug                 core.h_run_loop()
//debug             )));
//debug             return true;
//debug         })
//debug     ]);
//debug }

// Browser demo.

//debug import dummy_signaller from "./dummy_signaller.js";
//debug import webrtc_transport from "./webrtc_transport.js";
//debug if (typeof window === "object") {
//debug     demo({
//debug         transport: webrtc_transport(dummy_signaller(), console.log),
//debug         bob_address: "connect:?name=bob",
//debug         bob_bind_info: "listen:?name=bob",
//debug         carol_address: "connect:?name=carol",
//debug         carol_bind_info: "listen:?name=carol",
//debug         webcrypto: crypto
//debug     })(console.log);
//debug }

// Node.js demo.

//debug if (typeof process === "object") {
//debug     Promise.all([
//debug         import("node:crypto"),
//debug         import("./node_tls_transport.js")
//debug     ]).then(function ([
//debug         crypto_module,
//debug         transport_module
//debug     ]) {
//debug         demo({
//debug             transport: transport_module.default(),
//debug             bob_address: {host: "localhost", port: 5001},
//debug             carol_address: {host: "localhost", port: 5002},
//debug             webcrypto: crypto_module.webcrypto
//debug         })(console.log);
//debug     });
//debug }

// Clean up.

// core.h_dispose();

export default Object.freeze(awp_dev);
