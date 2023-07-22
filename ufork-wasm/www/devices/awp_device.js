// Installs the AWP device, allowing cores to communicate over the network via
// the Actor Wire Protocol.

// Returns a disposal function that destroys all connections and stops
// listening.

// TODO:
// - distributed garbage collection
// - acquaintance interning
// - cancel/stop capabilities

/*jslint browser, null, devel, long */

import ufork from "../ufork.js";
import assemble from "../assemble.js";
import OED from "../oed.js";
import hex from "../hex.js";

const awp_key = 100; // from dev.asm
const once_fwd_crlf = assemble(`
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

function awp_device({
    core,
    make_dynamic_device,
    transport,
    on_store_change,
    stores = [],
    webcrypto = crypto // Node.js does not have a 'crypto' global
}) {
    const sponsor = core.u_ramptr(ufork.SPONSOR_OFS);
    const once_fwd_beh = core.h_load(once_fwd_crlf).beh;

    let dynamic_device;
    let connections = Object.create(null);  // local:remote -> connection object
    let opening = Object.create(null);      // local:remote -> cancel function
    let outbox = Object.create(null);       // local:remote -> messages
    let lost = Object.create(null);         // local:remote -> functions // TODO are these ever cleaned up?
    let raw_to_swiss = Object.create(null); // raw -> swiss
    let stubs = Object.create(null);        // swiss -> stub raw    // TODO release at some point
    let handle_to_listener_key = [];        // handle -> local // TODO implement safe_stop proxies
    let listeners = Object.create(null);    // local -> {greeter, stop}
    let handle_to_proxy_key = [];           // handle -> proxy key  // TODO release
    let proxies = Object.create(null);      // proxy key -> data    // TODO drop_proxy

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
        const handle = handle_to_proxy_key.length;
        handle_to_proxy_key.push(proxy_key);
        const raw = dynamic_device.h_reserve_proxy(core.u_fixnum(handle));
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
//  #unit           | ext(null)
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
            if (raw === ufork.UNIT_RAW) {
                return {meta: null};
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

// The quad is either a local actor (an ACTOR_T) or a remote actor (a PROXY_T).

                const quad = core.u_read_quad(core.u_cap_to_ptr(raw));
                if (quad.t === ufork.ACTOR_T) {
                    let swiss = raw_to_swiss[raw];
                    if (
                        swiss === undefined
                        || stubs[hex.encode(swiss)] === undefined
                    ) {

// There is no stub corresponding to this capability, making it vulnerable to
// garbage collection. Generate a new Swiss number and reserve a stub.

                        swiss = random_swiss();
                        stubs[
                            hex.encode(swiss)
                        ] = dynamic_device.h_reserve_stub(raw);
                        raw_to_swiss[raw] = swiss;
                    }
                    return {
                        meta: store.acquaintances[0], // self
                        data: swiss
                    };
                }
                if (quad.t === ufork.PROXY_T) {

// Strip the dynamic device metadata from the proxy's handle.

                    const handle_raw = core.u_nth(quad.y, -1);
                    const handle = core.u_fix_to_i32(handle_raw);
                    const proxy = proxies[handle_to_proxy_key[handle]];
                    const acquaintance = proxy.store.acquaintances[
                        proxy.petname
                    ];
                    return {
                        meta: acquaintance,
                        data: proxy.swiss
                    };
                }
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
            if (object.meta === null) {
                return ufork.UNIT_RAW;
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
        return resume();
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

// The frame is a message addressed to a particular actor.

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
                return unregister(convo_key(
                    store.acquaintances[0].name, // self
                    connection.name()
                ));
            }
        )(
            function connected_callback(connection, reason) {
                delete opening[key];
                if (connection === undefined) {
                    if (core.u_debug !== undefined) {
                        core.u_debug("connect fail", reason);
                    }
                    lose(key);
                } else {
                    if (core.u_debug !== undefined) {
                        core.u_debug("connect open");
                    }
                    register(store, connection);
                }
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

        if (
            !core.u_is_cap(intro_callback)
            || !core.u_is_fix(store_fix)
            || !core.u_is_fix(petname_fix)
        ) {
            return ufork.E_FAIL;
        }
        const store_nr = core.u_fix_to_i32(store_fix);
        const petname = core.u_fix_to_i32(petname_fix);
        const store = stores[store_nr];
        if (
            store === undefined
            || store.acquaintances[petname] === undefined
            || store.acquaintances[petname].name === undefined
        ) {
            return ufork.E_BOUNDS; // TODO inform callback instead of failing
        }

// Wait a turn so we can safely use the non-reentrant core methods.

        setTimeout(function () {
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
                        x: ufork.UNDEF_RAW,
                        y: core.u_fixnum(-1) // TODO error codes
                    })
                }));

// We could release the callback's stub here, but it becomes a sink once it
// forwards the result so we can safely leave it for the distributed GC to clean
// up instead.

            });
            core.h_release_stub(event_stub_ptr);

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

        if (
            !core.u_is_cap(listen_callback)
            || !core.u_is_fix(store_fix)
            || !core.u_is_cap(listen_callback)
        ) {
            return ufork.E_FAIL;
        }
        const store = stores[core.u_fix_to_i32(store_fix)];
        if (store === undefined) {
            return ufork.E_BOUNDS; // TODO inform callback instead of failing
        }

        function release_event_stub() {
            if (event_stub_ptr !== undefined) {
                core.h_release_stub(event_stub_ptr);
                event_stub_ptr = undefined;
            }
        }

        function resolve(result) {

// (stop . error) -> listen_callback

            core.h_event_enqueue(core.h_reserve_ram({
                t: sponsor,
                x: listen_callback,
                y: result
            }));
            release_event_stub();
            return resume();
        }

// Wait a turn so we can safely use the non-reentrant core methods.

        setTimeout(function () {
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
                            x: ufork.UNDEF_RAW,
                            y: core.u_fixnum(-1) // TODO error codes
                        }));
                    }

// A store may not register more than one greeter. That would get very
// confusing.

                    const key = stringify(store.acquaintances[0].name);
                    if (listeners[key] !== undefined) {
                        stop();
                        return resolve(core.h_reserve_ram({
                            t: ufork.PAIR_T,
                            x: ufork.UNDEF_RAW,
                            y: core.u_fixnum(-1) // TODO error codes
                        }));
                    }

                    function safe_stop() {
                        const listener = listeners[key];
                        if (listener.greeter !== undefined) {
                            core.h_release_stub(listener.greeter);
                        }
                        delete listeners[key];
                        return stop();
                    }

                    listeners[key] = {
                        greeter: dynamic_device.h_reserve_stub(greeter),
                        stop: safe_stop
                    };
                    return resolve(core.h_reserve_ram({
                        t: ufork.PAIR_T,
                        x: ufork.UNDEF_RAW, // TODO safe_stop
                        y: ufork.NIL_RAW
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

    function forward(event_stub_ptr, handle, message) {
        setTimeout(function () {
            const proxy = proxies[handle_to_proxy_key[handle]];
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

// Install the device.

    dynamic_device = make_dynamic_device(
        function on_event_stub(event_stub_ptr) {

// The event stub retains the event, including its message, in memory until
// explicitly released. This is necessary because h_reserve_stub is
// non-reentrant, so marshalling must take place on a future turn and we don't
// want the message to be GC'd in the meantime.

            const event_stub = core.u_read_quad(event_stub_ptr);
            const event = core.u_read_quad(event_stub.y);
            const message = event.y;

// Inspect the event target. If it is a proxy, forward the message to a remote
// actor, stripping the dynamic device metadata from the handle.

            const target_quad = core.u_read_quad(core.u_cap_to_ptr(event.x));
            if (target_quad.t === ufork.PROXY_T) {
                const handle_raw = core.u_nth(target_quad.y, -1);
                const handle = core.u_fix_to_i32(handle_raw);
                return forward(event_stub_ptr, handle, message);
            }

// Choose a method based on the message tag (#intro, #listen, etc). Note that
// the message is tagged with dynamic device metadata, so we skip the head of
// the list.

            const tag = core.u_nth(message, 2);
            if (!core.u_is_fix(tag)) {
                return ufork.E_FAIL;
            }
            const method_array = [intro, listen];
            const method = method_array[core.u_fix_to_i32(tag)];
            if (method === undefined) {
                return ufork.E_BOUNDS;
            }

// Forward the remainder of the message to the chosen method. The method may
// need to reserve stubs for the portions of the message it will need later.
// When the method is done doing that, it should release the event stub.

            return method(event_stub_ptr, core.u_nth(message, -2));
        },
        function on_drop_proxy(proxy_raw) {

// A proxy has been garbage collected.
// TODO inform the relevant party.

            const quad = core.u_read_quad(core.u_cap_to_ptr(proxy_raw));
            const handle = quad.y;

// Strip the dynamic device's metadata from the proxy's handle.

            const subhandle = core.u_fix_to_i32(core.u_nth(handle, -1));
            delete proxies[handle_to_proxy_key[handle]];
        }
    );

// Install the dynamic device as if it were a real device. Unlike a real device,
// we must reserve a stub to keep the capability from being released.

    const awp_device_cap = dynamic_device.h_reserve_cap();
    core.h_install([[awp_key, awp_device_cap]]);
    dynamic_device.h_reserve_stub(awp_device_cap);
    return function dispose() {
        Object.values(connections).forEach(function (connection) {
            connection.close();
        });
        Object.values(listeners).forEach(function (listener) {
            listener.stop();
        });
        dynamic_device.dispose();
    };
}

//debug import parseq from "../parseq.js";
//debug import lazy from "../requestors/lazy.js";
//debug import requestorize from "../requestors/requestorize.js";
//debug import host_device from "./host_device.js";
//debug const wasm_url = import.meta.resolve(
//debug     "../../target/wasm32-unknown-unknown/debug/ufork_wasm.wasm"
//debug );
//debug let dispose;
//debug let core;
//debug function demo({
//debug     transport,
//debug     bob_address,
//debug     bob_bind_info = bob_address,
//debug     carol_address,
//debug     carol_bind_info = carol_address,
//debug     webcrypto
//debug }) {
//debug     return parseq.sequence([
//debug         ufork.instantiate_core(
//debug             wasm_url,
//debug             function on_wakeup(device_offset) {
//debug                 console.log("WAKE:", device_offset);
//debug                 console.log("IDLE:", core.u_fault_msg(
//debug                     core.h_run_loop()
//debug                 ));
//debug             },
//debug             console.log,
//debug             ufork.LOG_DEBUG
//debug         ),
//debug         parseq.parallel([
//debug             lazy(function (the_core) {
//debug                 core = the_core;
//debug                 return core.h_import(import.meta.resolve(
//debug                     "../../lib/grant_matcher.asm"
//debug                 ));
//debug             }),
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
//debug             const make_dynamic_device = host_device(core);
//debug             dispose = awp_device({
//debug                 core,
//debug                 make_dynamic_device,
//debug                 transport,
//debug                 stores,
//debug                 webcrypto
//debug             });
//debug             core.h_boot(asm_module.boot);
//debug             console.log("IDLE:", core.u_fault_msg(core.h_run_loop()));
//debug             return true;
//debug         })
//debug     ]);
//debug }

// Browser demo.

//debug import dummy_signaller from "../transports/dummy_signaller.js";
//debug import webrtc_transport from "../transports/webrtc_transport.js";
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
//debug         import("../transports/node_tls_transport.js")
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

// dispose();

export default Object.freeze(awp_device);
