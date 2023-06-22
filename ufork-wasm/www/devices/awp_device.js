// Installs the AWP device, allowing cores to communicate over the network via
// the Actor Wire Protocol.

// Returns a disposal function that destroys all connections and stops
// listening.

// TODO:
// - distributed garbage collection
// - swiss interning
// - cancel/stop capabilities

/*jslint browser, null, devel, long */

import OED from "../oed.js";
import hex from "./hex.js";
import dummy_transport from "./dummy_transport.js";

function stringify(value) {

// Returns a string representation of an OED-encodable value.

    return hex.encode(OED.encode(value));
}

// The Grant Matcher configuration. This will be removed eventually.

const alice_store = {
    name: "alice",
    identity: "alice",
    acquaintances: [
        {name: "bob", address: "@bob"},
        {name: "carol", address: "@carol"}
    ]
};
const bob_store = {
    name: "bob",
    identity: "bob",
    address: "@bob",
    bind_info: "@bob"
};
const carol_store = {
    name: "carol",
    identity: "carol",
    address: "@carol",
    bind_info: "@carol"
};
const dana_store = {
    name: "dana",
    identity: "dana",
    acquaintances: [
        {name: "bob", address: "@bob"},
        {name: "carol", address: "@carol"}
    ]
};

function awp_device(
    core,
    resume,
    transport = dummy_transport(),
    stores = [alice_store, bob_store, carol_store, dana_store],
    webcrypto = crypto // Node.js does not have a 'crypto' global
) {
    const sponsor = core.u_ramptr(core.SPONSOR_OFS);
    const device = core.u_ptr_to_cap(core.u_ramptr(core.AWP_DEV_OFS));

    let connections = Object.create(null);  // local:remote -> connection object
    let opening = Object.create(null);      // local:remote -> cancel function
    let outbox = Object.create(null);       // local:remote -> messages
    let lost = Object.create(null);         // local:remote -> functions // TODO are these ever cleaned up?
    let frame_ids = Object.create(null);    // local:remote -> integer
    let greeters = Object.create(null);     // local -> greeter stub raw
    let raw_to_swiss = Object.create(null); // raw -> swiss
    let stubs = Object.create(null);        // swiss -> stub raw    // TODO release at some point
    let handle_to_proxy_key = [];           // handle -> proxy key  // TODO release
    let proxies = Object.create(null);      // proxy key -> data    // TODO drop_proxy
    let stops = [];                         // listen stop functions // TODO release

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
        const raw = core.u_ptr_to_cap(core.h_reserve_ram({
            t: core.PROXY_T,
            x: device,
            y: core.u_fixnum(handle)
        }));
        proxies[proxy_key] = {raw, swiss, store, petname};
        return raw;
    }

    function get_petname(store, acquaintance) {

// Determine the petname of an acquaintance, adding them to the store if
// necessary.

        const key = stringify(acquaintance.name);
        if (store.acquaintances === undefined) {
            store.acquaintances = [];
        }
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
            if (raw === core.UNDEF_RAW) {
                return {value: null};
            }
            if (raw === core.UNIT_RAW) {
                return {meta: null};
            }
            if (raw === core.TRUE_RAW) {
                return {value: true};
            }
            if (raw === core.FALSE_RAW) {
                return {value: false};
            }
            if (raw === core.NIL_RAW) {
                return {value: []};
            }
            if (core.u_is_fix(raw)) {
                return {value: core.u_fix_to_i32(raw)};
            }
            if (core.u_is_ptr(raw)) {
                const pair = core.u_read_quad(raw);
                if (pair.t === core.PAIR_T) {
                    return {value: [pair.x, pair.y]};
                }
            }
            if (core.u_is_cap(raw)) {

// The quad is either a local actor (an ACTOR_T) or a remote actor (a PROXY_T).

                const quad = core.u_read_quad(core.u_cap_to_ptr(raw));
                if (quad.t === core.ACTOR_T) {
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
                        ] = core.h_reserve_stub(device, raw);
                        raw_to_swiss[raw] = swiss;
                    }
                    return {
                        meta: {
                            name: store.name,
                            address: store.address // optional
                        },
                        data: swiss
                    };
                }
                if (quad.t === core.PROXY_T) {
                    const handle = core.u_fix_to_i32(quad.y);
                    const proxy = proxies[handle_to_proxy_key[handle]];
                    const acquaintance = proxy.store.acquaintances[
                        proxy.petname
                    ];
                    return {
                        meta: {
                            name: acquaintance.name,
                            address: acquaintance.address
                        },
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
                return core.UNDEF_RAW;
            }
            if (object.meta === null) {
                return core.UNIT_RAW;
            }
            if (object.value === true) {
                return core.TRUE_RAW;
            }
            if (object.value === false) {
                return core.FALSE_RAW;
            }
            if (Array.isArray(object.value)) {
                if (object.value.length === 2) {
                    return core.h_reserve_ram({
                        t: core.PAIR_T,
                        x: object.value[0],
                        y: object.value[1]
                    });
                }
                if (object.value.length === 0) {
                    return core.NIL_RAW;
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

    function unregister(key) {
        lose(key);
        delete frame_ids[key]; // TODO is this safe?
        delete outbox[key];
        delete connections[key];
        return resume();
    }

    function receive(store, connection, frame) {
        if (frame.to === undefined) {

// The frame is an introduction request. Forward it to the greeter.

            const greeter_stub = greeters[stringify(store.name)];
            if (greeter_stub === undefined) {
                console.log("No greeter", store, frame);
                return;
            }
            const greeter = core.u_read_quad(greeter_stub).y;
            const acquaintance = {name: connection.name()};
            const petname = get_petname(store, acquaintance);
            const message = unmarshall(store, frame.message);
            const greeting_callback = core.u_nth(message, 1);
            const hello_data = core.u_nth(message, -1);

// (cancel_customer greeting_callback petname . hello) -> greeter

            core.h_event_inject(
                sponsor,
                greeter,
                core.h_reserve_ram({
                    t: core.PAIR_T,
                    x: core.UNDEF_RAW, // TODO cancel_customer
                    y: core.h_reserve_ram({
                        t: core.PAIR_T,
                        x: greeting_callback,
                        y: core.h_reserve_ram({
                            t: core.PAIR_T,
                            x: core.u_fixnum(petname),
                            y: hello_data
                        })
                    })
                })
            );
            return resume();
        }

// The frame is a message addressed to a particular actor.

        const stub = stubs[hex.encode(frame.to)];
        if (stub !== undefined) {
            core.h_event_inject(
                sponsor,
                core.u_read_quad(stub).y,
                unmarshall(store, frame.message)
            );
            return resume();
        }
        console.log("Missing stub", store, frame);
    }

    function next_frame_id(key) {
        const id = (
            frame_ids[key] === undefined
            ? 0
            : frame_ids[key] + 1
        );
        // TODO how big should the frame ID be? Should it wrap around?
        if (!Number.isSafeInteger(id)) {
            throw new Error("Too many frames.");
        }
        frame_ids[key] = id;
        return id;
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
                    id: next_frame_id(key),
                    to: swiss,
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
            function connected_callback(connection, reason) {
                delete opening[key];
                if (connection === undefined) {
                    console.log("connect fail", reason);
                    lose(key);
                } else {
                    console.log("connect open");
                    register(store, connection);
                }
            },
            {
                identity: store.identity,
                name: store.acquaintances[petname].name,
                address: store.acquaintances[petname].address,
                on_receive(connection, frame_buffer) {
                    const frame = OED.decode(frame_buffer);
                    console.log("connect on_receive");
                    return receive(store, connection.name(), frame);
                },
                on_close(connection, reason) {
                    console.log("connect on_close", reason);
                    return unregister(convo_key(
                        store.name,
                        connection.name()
                    ));
                }
            }
        );
        // TODO forward cancel capability to cancel_customer
        opening[key] = function () {
            if (typeof cancel === "function") {
                cancel();
            }
            delete opening[key];
        };
    }

    function register(store, connection) {
        const key = convo_key(store.name, connection.name());

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
        const key = convo_key(store.name, acquaintance.name);
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
            return core.E_FAIL;
        }
        const store_nr = core.u_fix_to_i32(store_fix);
        const petname = core.u_fix_to_i32(petname_fix);
        const store = stores[store_nr];
        if (
            store === undefined
            || store.acquaintances[petname] === undefined
            || store.acquaintances[petname].address === undefined
        ) {
            return core.E_BOUNDS; // TODO inform callback instead of failing
        }

// Wait a turn so we can safely use the non-reentrant core methods.

        setTimeout(function () {

// TODO rewrite this in assembly, and allocate in ROM.

            const sink_beh = core.h_reserve_ram({
                t: core.INSTR_T,
                x: core.VM_END,
                y: core.u_fixnum(1) // COMMIT
            });
            const callback_fwd = core.u_ptr_to_cap(core.h_reserve_ram({
                t: core.ACTOR_T,

//  fwd_beh:                ; callback <- message
//      msg 0               ; message
//      state 0             ; message callback
//      send -1             ; --
//      push std.sink_beh   ; sink_beh
//      beh 0               ; --
//      end commit

                x: core.h_reserve_ram({
                    t: core.INSTR_T,
                    x: core.VM_MSG,
                    y: core.u_fixnum(0),
                    z: core.h_reserve_ram({
                        t: core.INSTR_T,
                        x: core.VM_STATE,
                        y: core.u_fixnum(0),
                        z: core.h_reserve_ram({
                            t: core.INSTR_T,
                            x: core.VM_SEND,
                            y: core.u_fixnum(-1),
                            z: core.h_reserve_ram({
                                t: core.INSTR_T,
                                x: core.VM_PUSH,
                                y: sink_beh,
                                z: core.h_reserve_ram({
                                    t: core.INSTR_T,
                                    x: core.VM_BEH,
                                    y: core.u_fixnum(0),
                                    z: sink_beh
                                })
                            })
                        })
                    })
                }),
                y: intro_callback
            }));

// Enqueue the introduction request.

            enqueue(
                store,
                petname,
                undefined,
                marshall(store, core.h_reserve_ram({
                    t: core.PAIR_T,
                    x: callback_fwd, // retained by a stub
                    y: hello_data
                }))
            );
            const key = convo_key(
                store.name,
                store.acquaintances[petname].name
            );
            add(lost, key, function on_lost() {
                console.log("intro fail");
                core.h_event_inject(
                    sponsor,
                    callback_fwd,
                    core.h_reserve_ram({
                        t: core.PAIR_T,
                        x: core.UNDEF_RAW,
                        y: core.u_fixnum(-1) // TODO error codes
                    })
                );

// We could release the callback's stub here, but it becomes a sink once it
// forwards the reply so we can safely leave it for the distributed GC to clean
// up instead.

            });
            core.h_release_stub(event_stub_ptr);

// TODO send a cancel capability to the cancel_customer. This should nullify
// callback_fwd.

        });
        return core.E_OK;
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
            return core.E_FAIL;
        }
        const store = stores[core.u_fix_to_i32(store_fix)];
        if (store === undefined) {
            return core.E_BOUNDS; // TODO inform callback instead of failing
        }

        function release_event_stub() {
            if (event_stub_ptr !== undefined) {
                core.h_release_stub(event_stub_ptr);
                event_stub_ptr = undefined;
            }
        }

        function resolve(reply) {

// (stop . reason) -> listen_callback

            core.h_event_inject(sponsor, listen_callback, reply);
            release_event_stub();
            return resume();
        }

// Wait a turn so we can safely use the non-reentrant core methods.

        setTimeout(function () {
            // TODO send cancel to cancel_customer
            const cancel = transport.listen(
                function listening_callback(stop, reason) {
                    if (stop === undefined) {
                        console.log("listen fail", reason);
                        return resolve(core.h_reserve_ram({
                            t: core.PAIR_T,
                            x: core.UNDEF_RAW,
                            y: core.u_fixnum(-1) // TODO error codes
                        }));
                    }

// A store may not register more than one greeter. That would get very
// confusing.

                    const key = stringify(store.name);
                    if (greeters[key] !== undefined) {
                        stop();
                        return resolve(core.h_reserve_ram({
                            t: core.PAIR_T,
                            x: core.UNDEF_RAW,
                            y: core.u_fixnum(-1) // TODO error codes
                        }));
                    }
                    greeters[key] = core.h_reserve_stub(device, greeter);

                    function safe_stop() {
                        if (greeters[key] !== undefined) {
                            core.h_release_stub(greeters[key]);
                            delete greeters[key];
                        }
                        return stop();
                    }

                    stops.push(safe_stop);
                    return resolve(core.h_reserve_ram({
                        t: core.PAIR_T,
                        x: core.UNDEF_RAW, // TODO safe_stop
                        y: core.NIL_RAW
                    }));
                },
                {
                    identity: store.identity,
                    bind_info: store.bind_info,
                    on_open(connection) {
                        console.log("listen on_open");
                        return register(store, connection);
                    },
                    on_receive(connection, frame_buffer) {
                        const frame = OED.decode(frame_buffer);
                        console.log("listen on_receive");
                        return receive(store, connection, frame);
                    },
                    on_close(connection, reason) {
                        console.log("listen on_close", reason);
                        return unregister(convo_key(
                            store.name,
                            connection.name()
                        ));
                    }
                }
            );
            // TODO provide to cancel_customer
            function safe_cancel() {
                release_event_stub();
                cancel();
            }

        });
        return core.E_OK;
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
        return core.E_OK;
    }

    function handle_event(event_stub_ptr) {

// The event stub retains the event, including its message, in memory until
// explicitly released. This is necessary because h_reserve_stub is
// non-reentrant, so marshalling must take place on a future turn and we don't
// want the message to be GC'd in the meantime.

        const event_stub = core.u_read_quad(event_stub_ptr);
        const event = core.u_read_quad(event_stub.y);
        const message = event.y;

// Inspect the event target. If it is a proxy, forward the message to a remote
// actor.

        const target_quad = core.u_read_quad(core.u_cap_to_ptr(event.x));
        if (target_quad.t === core.PROXY_T) {
            const handle = core.u_fix_to_i32(target_quad.y);
            return forward(event_stub_ptr, handle, message);
        }

// Choose a method based on the message tag (#intro, #listen, etc).

        const tag = core.u_nth(message, 1);
        if (!core.u_is_fix(tag)) {
            return core.E_FAIL;
        }
        const method_array = [intro, listen];
        const method = method_array[core.u_fix_to_i32(tag)];
        if (method === undefined) {
            return core.E_BOUNDS;
        }

// Forward the remainder of the message to the chosen method. The method may
// need to reserve stubs for the portions of the message it will need later.
// When the method is done doing that, it should release the event stub.

        return method(event_stub_ptr, core.u_nth(message, -1));
    }

    function release_proxy(proxy_raw) {

// A proxy has been garbage collected.

        const quad = core.u_read_quad(core.u_cap_to_ptr(proxy_raw));
        const handle = core.u_fix_to_i32(quad.y);
        delete proxies[handle_to_proxy_key[handle]];

// TODO inform the relevant party.

        return core.E_OK;
    }

// Install the device.

    core.h_install(
        [[
            core.AWP_DEV_OFS,
            core.u_ptr_to_cap(core.u_ramptr(core.AWP_DEV_OFS))
        ]],
        {
            host_awp(raw) {
                return (
                    core.u_is_cap(raw)
                    ? release_proxy(raw)
                    : handle_event(raw)
                );
            }
        }
    );

    return function dispose() {
        Object.values(connections).forEach(function (connection) {
            connection.close();
        });
        stops.forEach(function (stop_listening) {
            stop_listening();
        });
    };
}

//debug import parseq from "../parseq.js";
//debug import instantiate_core from "../ufork.js";
//debug import debug_device from "./debug_device.js";
//debug let dispose;
//debug function run_demo({transport, bob_address, carol_address, webcrypto}) {
//debug     parseq.parallel([
//debug         transport.generate_identity,
//debug         transport.generate_identity,
//debug         transport.generate_identity,
//debug         transport.generate_identity
//debug     ])(function callback(
//debug         [alice_identity, bob_identity, carol_identity, dana_identity],
//debug         ignore
//debug     ) {
//debug         instantiate_core(import.meta.resolve(
//debug             "../../target/wasm32-unknown-unknown/debug/ufork_wasm.wasm"
//debug         ), console.log).then(function (core) {
//debug             function resume() {
//debug                 console.log("HALT:", core.u_fault_msg(
//debug                     core.h_run_loop()
//debug                 ));
//debug             }
//debug             const acquaintances = [
//debug                 {
//debug                     name: transport.identity_to_name(bob_identity),
//debug                     address: bob_address
//debug                 },
//debug                 {
//debug                     name: transport.identity_to_name(carol_identity),
//debug                     address: carol_address
//debug                 }
//debug             ];
//debug             const store = [
//debug                 {
//debug                     identity: alice_identity,
//debug                     name: transport.identity_to_name(alice_identity),
//debug                     acquaintances
//debug                 },
//debug                 {
//debug                     identity: bob_identity,
//debug                     name: transport.identity_to_name(bob_identity),
//debug                     address: bob_address,
//debug                     bind_info: bob_address
//debug                 },
//debug                 {
//debug                     identity: carol_identity,
//debug                     name: transport.identity_to_name(carol_identity),
//debug                     address: carol_address,
//debug                     bind_info: carol_address
//debug                 },
//debug                 {
//debug                     identity: dana_identity,
//debug                     name: transport.identity_to_name(dana_identity),
//debug                     acquaintances
//debug                 }
//debug             ];
//debug             debug_device(core);
//debug             dispose = awp_device(
//debug                 core,
//debug                 resume,
//debug                 transport,
//debug                 store,
//debug                 webcrypto
//debug             );
//debug             return core.h_import(
//debug                 import.meta.resolve("../../lib/grant_matcher.asm")
//debug             ).then(function (asm_module) {
//debug                 core.h_boot(asm_module.boot);
//debug                 resume();
//debug             });
//debug         });
//debug     });
//debug }

// Browser demo.

//debug import dummy_webrtc_signaller from "./dummy_webrtc_signaller.js";
//debug import webrtc_transport from "./webrtc_transport.js";
//debug if (typeof window === "object") {
//debug     run_demo({
//debug         transport: webrtc_transport(
//debug             dummy_webrtc_signaller(),
//debug             console.log
//debug         ),
//debug         bob_address: "ws://ufork.org",
//debug         carol_address: "ws://ufork.org",
//debug         webcrypto: crypto
//debug     });
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
//debug         run_demo({
//debug             transport: transport_module.default(),
//debug             bob_address: {host: "localhost", port: 5001},
//debug             carol_address: {host: "localhost", port: 5002},
//debug             webcrypto: crypto_module.webcrypto
//debug         });
//debug     });
//debug }

// Clean up.

// dispose();

export default Object.freeze(awp_device);
