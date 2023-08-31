// Installs the host device, making it possible to provide "dynamic" devices
// without modifying uFork's Rust code.

/*jslint browser */

import assemble from "../assemble.js";
import ufork from "../ufork.js";

const fwd_to_host_crlf = assemble(`
beh:                    ; (host_device . key) <- message
    msg 0               ; message
    state -1            ; message key
    pair 1              ; (key . message)
    state 1             ; (key . message) host_device
    send -1             ; --
    end commit

.export
    beh
`);

function host_device(core) {
    let next_key = 0;
    let dynamic_devices = Object.create(null);

    function handle_event(event_stub_ptr) {

// Route the event stub to the relevant dynamic device.

        const event_stub = core.u_read_quad(event_stub_ptr);
        const event = core.u_read_quad(event_stub.y);
        const target_quad = core.u_read_quad(core.u_cap_to_ptr(event.x));
        const key = (
            target_quad.t === ufork.PROXY_T
            ? core.u_nth(target_quad.y, 1)  // handle tag
            : core.u_nth(event.y, 1)        // message tag
        );
        if (!core.u_is_fix(key)) {
            return ufork.E_NOT_FIX;
        }
        const dynamic_device = dynamic_devices[core.u_fix_to_i32(key)];
        if (dynamic_device === undefined) {
            return ufork.E_BOUNDS;
        }
        return dynamic_device.on_event_stub(event_stub_ptr);
    }

    function drop_proxy(proxy_raw) {

// A proxy has been garbage collected. Route its handle to the relevant dynamic
// device.

        const quad = core.u_read_quad(core.u_cap_to_ptr(proxy_raw));
        const handle = quad.y;
        const key = core.u_nth(handle, 1);
        if (core.u_is_fix(key)) {
            const dynamic_device = dynamic_devices[core.u_fix_to_i32(key)];
            if (typeof dynamic_device?.on_drop_proxy === "function") {
                dynamic_device.on_drop_proxy(proxy_raw);
            }
        }
    }

// Install the host device.

    const host_device_cap = core.u_ptr_to_cap(
        core.u_ramptr(ufork.HOST_DEV_OFS)
    );
    core.h_install(
        [[ufork.HOST_DEV_OFS, host_device_cap]],
        {
            host(raw) {
                return (
                    core.u_is_cap(raw)
                    ? drop_proxy(raw)
                    : handle_event(raw)
                );
            }
        }
    );
    const fwd_to_host_beh = core.h_load(fwd_to_host_crlf).beh;

    return function make_dynamic_device(

// The 'on_event_stub' parameter is a function that is called when the dynamic
// device receives a message event via the host device. It returns an integer
// error code, such as E_OK or E_FAIL. It takes responsibility for releasing the
// event stub if it returns E_OK.

// There are some subtle differences between events received by a dynamic device
// and events received by a real device, because some fields are augmented with
// metadata used by the dynamic device. This metadata is opaque and should be
// discarded, using the 'h_strip_meta' method.

// Affected fields include proxy handles, and the message of events sent to the
// dynamic device (but not messages sent to a proxy).

        on_event_stub,

// The 'on_drop_proxy' parameter is a function that is called when a proxy made
// by 'h_reserve_proxy' is dropped. It is passed the raw proxy. Optional.

        on_drop_proxy
    ) {
        const key = next_key;
        next_key += 1;
        dynamic_devices[key] = {on_event_stub, on_drop_proxy};

        function h_reserve_cap() {

// Make a capability for the dynamic device. It forwards each message it
// receives to the host device, first tagging it with the dynamic device's key.

// Unlike real device capabilities, this capability is vulnerable to garbage
// collection.

            return core.u_ptr_to_cap(core.h_reserve_ram({
                t: ufork.ACTOR_T,
                x: fwd_to_host_beh,
                y: core.h_reserve_ram({
                    t: ufork.PAIR_T,
                    x: host_device_cap,
                    y: core.u_fixnum(key)
                })
            }));
        }

        function h_reserve_proxy(handle_raw = ufork.UNDEF_RAW) {

// Makes a proxy whose handle is tagged with the dynamic device's key.

            return core.u_ptr_to_cap(core.h_reserve_ram({
                t: ufork.PROXY_T,
                x: host_device_cap,
                y: core.h_reserve_ram({
                    t: ufork.PAIR_T,
                    x: core.u_fixnum(key),
                    y: handle_raw
                })
            }));
        }

        function h_reserve_stub(target_raw) {
            return core.h_reserve_stub(host_device_cap, target_raw);
        }

        function u_strip_meta(raw) {

// Strip the dynamic device metadata from a message or proxy handle.

            return core.u_nth(raw, -1);
        }

        function u_owns_proxy(proxy_raw) {

// Returns true if this dynamic device issued the proxy with 'h_reserve_proxy'.

            const quad = core.u_read_quad(core.u_cap_to_ptr(proxy_raw));
            const device = quad.x;
            const handle = quad.y;
            const key_raw = core.u_nth(handle, 1);
            return (
                device === host_device_cap
                && core.u_fix_to_i32(key_raw) === key
            );
        }

        function u_dispose() {
            delete dynamic_devices[key];
        }

        return Object.freeze({
            h_reserve_cap,
            h_reserve_stub,
            h_reserve_proxy,
            u_strip_meta,
            u_owns_proxy,
            u_dispose
        });
    };
}

//debug import parseq from "../parseq.js";
//debug import requestorize from "../requestors/requestorize.js";
//debug const wasm_url = import.meta.resolve(
//debug     "../../target/wasm32-unknown-unknown/debug/ufork_wasm.wasm"
//debug );
//debug let dispose;
//debug let core;
//debug function dummy_device(make_dynamic_device) {
//debug     const dev = make_dynamic_device(
//debug         function on_event_stub(ptr) {
//debug             const event_stub = core.u_read_quad(ptr);
//debug             const target = core.u_read_quad(
//debug                 core.u_cap_to_ptr(event_stub.x)
//debug             );
//debug             const event = core.u_read_quad(event_stub.y);
//debug             if (target.t === ufork.PROXY_T) {
//debug                 console.log(
//debug                     "on_event_stub proxy",
//debug                     core.u_pprint(event.y), // message
//debug                     core.u_pprint(dev.u_strip_meta(target.y)), // handle
//debug                     dev.u_owns_proxy(event_stub.x)
//debug                 );
//debug             } else {
//debug                 console.log(
//debug                     "on_event_stub message",
//debug                     core.u_pprint(dev.u_strip_meta(event.y))
//debug                 );
//debug             }
//debug         },
//debug         function on_drop_proxy(proxy_raw) {
//debug             const quad = core.u_read_quad(core.u_cap_to_ptr(proxy_raw));
//debug             const handle = dev.u_strip_meta(quad.y);
//debug             console.log("on_drop_proxy", core.u_pprint(handle));
//debug         }
//debug     );
//debug     dev.h_reserve_proxy(ufork.FALSE_RAW); // dropped
//debug     let proxy = dev.h_reserve_proxy(ufork.TRUE_RAW);
//debug     let dummy_cap = dev.h_reserve_cap();
//debug     let dummy_cap_stub = dev.h_reserve_stub(dummy_cap);
//debug     core.h_install([[1000, dummy_cap]]);
//debug     core.h_install([[1001, proxy]]);
//debug     return function dispose() {
//debug         dev.u_dispose();
//debug         if (dummy_cap_stub !== undefined) {
//debug             core.h_release_stub(dummy_cap_stub);
//debug             dummy_cap_stub = undefined;
//debug         }
//debug     };
//debug }
//debug function run_core() {
//debug     console.log(
//debug         "IDLE:",
//debug         core.u_fault_msg(core.u_fix_to_i32(core.h_run_loop()))
//debug     );
//debug }
//debug core = ufork.make_core({
//debug     wasm_url,
//debug     on_wakeup: run_core,
//debug     on_log: console.log,
//debug     log_level: ufork.LOG_DEBUG
//debug });
//debug parseq.sequence([
//debug     core.h_initialize(),
//debug     core.h_import(import.meta.resolve("../../lib/host_device.asm")),
//debug     requestorize(function (asm_module) {
//debug         dispose = dummy_device(host_device(core));
//debug         core.h_boot(asm_module.boot);
//debug         run_core();
//debug         return true;
//debug     })
//debug ])(console.log);
//debug setTimeout(function () {
//debug     dispose();
//debug }, 1000);

export default Object.freeze(host_device);
