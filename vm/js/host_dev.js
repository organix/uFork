// Installs the host device, making it possible to provide "dynamic" devices
// without modifying uFork's Rust code.

// See host_dev.md.

/*jslint web */

import ufork from "./ufork.js";

function host_dev(core) {
    let next_key = 0;
    let dynamic_devs = Object.create(null);

    function handle_event(event_stub_ptr) {

// Route the event stub to the relevant dynamic device.

        const event_stub = core.u_read_quad(event_stub_ptr);
        const event = core.u_read_quad(event_stub.y);
        const proxy = core.u_read_quad(core.u_cap_to_ptr(event.x));
        const handle = proxy.y;
        const key = core.u_nth(handle, 1);
        if (!core.u_is_fix(key)) {
            return ufork.E_NOT_FIX;
        }
        const dynamic_dev = dynamic_devs[core.u_fix_to_i32(key)];
        if (dynamic_dev === undefined) {
            return ufork.E_BOUNDS;
        }
        return dynamic_dev.on_event_stub(event_stub_ptr);
    }

    function drop_proxy(proxy_raw) {

// A proxy has been garbage collected. Inform it's dynamic device.

        const quad = core.u_read_quad(core.u_cap_to_ptr(proxy_raw));
        const handle = quad.y;
        const key = core.u_nth(handle, 1);
        if (core.u_is_fix(key)) {
            const dynamic_dev = dynamic_devs[core.u_fix_to_i32(key)];
            if (typeof dynamic_dev?.on_drop_proxy === "function") {
                dynamic_dev.on_drop_proxy(proxy_raw);
            }
        }
    }

// Install the host device.

    const dev_ptr = core.u_ramptr(ufork.HOST_DEV_OFS);
    const dev_cap = core.u_ptr_to_cap(dev_ptr);
    const dev_id = core.u_read_quad(dev_ptr).x;
    core.h_install(dev_id, dev_cap, undefined, {
        host(raw) {
            return (
                core.u_is_cap(raw)
                ? drop_proxy(raw)
                : handle_event(raw)
            );
        }
    });

    return function make_ddev(on_event_stub, on_drop_proxy) {
        const key = next_key;
        next_key += 1;
        dynamic_devs[key] = {on_event_stub, on_drop_proxy};

        function h_reserve_proxy(tag_raw = ufork.UNDEF_RAW) {
            return core.u_ptr_to_cap(core.h_reserve_ram({
                t: ufork.PROXY_T,
                x: dev_cap,
                y: core.h_reserve_ram({
                    t: ufork.PAIR_T,
                    x: core.u_fixnum(key),
                    y: tag_raw
                })
            }));
        }

        function h_reserve_stub(target_raw) {
            return core.h_reserve_stub(dev_cap, target_raw);
        }

        function u_tag(proxy_handle_raw) {
            return core.u_nth(proxy_handle_raw, -1);
        }

        function u_owns_proxy(raw) {

// Returns true if this dynamic device issued the proxy via 'h_reserve_proxy'.

            if (core.u_is_cap(raw)) {
                const quad = core.u_read_quad(core.u_cap_to_ptr(raw));
                const dev = quad.x;
                const handle = quad.y;
                const key_raw = core.u_nth(handle, 1);
                return (
                    quad.t === ufork.PROXY_T
                    && dev === dev_cap
                    && core.u_fix_to_i32(key_raw) === key
                );
            }
            return false;
        }

        function h_dispose() {
            delete dynamic_devs[key];
        }

        return Object.freeze({
            h_dispose,
            h_reserve_stub,
            h_reserve_proxy,
            u_tag,
            u_owns_proxy
        });
    };
}

//debug import assemble from "https://ufork.org/lib/assemble.js";
//debug import parseq from "https://ufork.org/lib/parseq.js";
//debug import requestorize from "https://ufork.org/lib/rq/requestorize.js";
//debug const wasm_url = import.meta.resolve(
//debug     "https://ufork.org/wasm/ufork.wasm"
//debug );
//debug const proxy_key = 1000;
//debug const test_ir = assemble(`
//debug proxy_key:
//debug     ref ${proxy_key}
//debug boot:                   ; _ <- {caps}
//debug     push 42             ; 42
//debug     msg 0               ; 42 {caps}
//debug     push proxy_key      ; 42 {caps} proxy_key
//debug     dict get            ; 42 proxy
//debug     actor send          ; --
//debug     end commit
//debug .export
//debug     boot
//debug `);
//debug let core;
//debug function dummy_dev(make_ddev) {
//debug     const ddev = make_ddev(
//debug         function on_event_stub(ptr) {
//debug             const event_stub = core.u_read_quad(ptr);
//debug             const target = core.u_read_quad(
//debug                 core.u_cap_to_ptr(event_stub.x)
//debug             );
//debug             const event = core.u_read_quad(event_stub.y);
//debug             console.log(
//debug                 "on_event_stub",
//debug                 core.u_pprint(event.y), // message
//debug                 core.u_pprint(ddev.u_tag(target.y)), // tag
//debug                 ddev.u_owns_proxy(event_stub.x)
//debug             );
//debug         },
//debug         function on_drop_proxy(proxy_raw) {
//debug             const quad = core.u_read_quad(core.u_cap_to_ptr(proxy_raw));
//debug             const tag = ddev.u_tag(quad.y);
//debug             console.log("on_drop_proxy", core.u_pprint(tag));
//debug         }
//debug     );
//debug     ddev.h_reserve_proxy(ufork.FALSE_RAW); // dropped
//debug     let proxy = ddev.h_reserve_proxy(ufork.TRUE_RAW);
//debug     let stub = ddev.h_reserve_stub(proxy);
//debug     core.h_install(
//debug         core.u_fixnum(proxy_key),
//debug         proxy,
//debug         function on_dispose() {
//debug             console.log("disposing");
//debug             ddev.h_dispose();
//debug             if (stub !== undefined) {
//debug                 core.h_release_stub(stub);
//debug                 stub = undefined;
//debug             }
//debug         }
//debug     );
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
//debug     log_level: ufork.LOG_DEBUG,
//debug     compilers: {asm: assemble}
//debug });
//debug parseq.sequence([
//debug     core.h_initialize(),
//debug     core.h_import(undefined, test_ir),
//debug     requestorize(function (asm_module) {
//debug         dummy_dev(host_dev(core));
//debug         core.h_boot(asm_module.boot);
//debug         run_core();
//debug         return true;
//debug     })
//debug ])(console.log);
//debug setTimeout(core.h_dispose, 1000);

export default Object.freeze(host_dev);
