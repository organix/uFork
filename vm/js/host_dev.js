// Installs the host device, making it possible to provide "dynamic" devices
// without modifying uFork's Rust code.

// See host_dev.md.

/*jslint web, global */

import assemble from "https://ufork.org/lib/assemble.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import ufork from "./ufork.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");

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

const proxy_key = 1000;
const test_asm = `
proxy_key:
    ref ${proxy_key}
boot:                   ; _ <- {caps}
    push 42             ; 42
    msg 0               ; 42 {caps}
    push proxy_key      ; 42 {caps} proxy_key
    dict get            ; 42 proxy
    actor send          ; --
    end commit
.export
    boot
`;

function demo(log) {
    let core;

    function dummy_dev(make_ddev) {
        const ddev = make_ddev(
            function on_event_stub(ptr) {
                const event_stub = core.u_read_quad(ptr);
                const target = core.u_read_quad(
                    core.u_cap_to_ptr(event_stub.x)
                );
                const event = core.u_read_quad(event_stub.y);
                log(
                    "on_event_stub",
                    core.u_pprint(event.y), // message
                    core.u_pprint(ddev.u_tag(target.y)), // tag
                    ddev.u_owns_proxy(event_stub.x)
                );
            },
            function on_drop_proxy(proxy_raw) {
                const quad = core.u_read_quad(core.u_cap_to_ptr(proxy_raw));
                const tag = ddev.u_tag(quad.y);
                log("on_drop_proxy", core.u_pprint(tag));
            }
        );
        ddev.h_reserve_proxy(ufork.FALSE_RAW); // dropped
        let proxy = ddev.h_reserve_proxy(ufork.TRUE_RAW);
        let stub = ddev.h_reserve_stub(proxy);
        core.h_install(
            core.u_fixnum(proxy_key),
            proxy,
            function on_dispose() {
                log("disposing");
                ddev.h_dispose();
                if (stub !== undefined) {
                    core.h_release_stub(stub);
                    stub = undefined;
                }
            }
        );
    }

    function run_core() {
        log("IDLE:", core.u_fault_msg(core.u_fix_to_i32(core.h_run_loop())));
    }

    core = ufork.make_core({
        wasm_url,
        on_wakeup: run_core,
        on_log: log,
        log_level: ufork.LOG_DEBUG,
        compilers: {asm: assemble}
    });
    parseq.sequence([
        core.h_initialize(),
        core.h_import(undefined, assemble(test_asm)),
        requestorize(function (asm_module) {
            dummy_dev(host_dev(core));
            core.h_boot(asm_module.boot);
            run_core();
            return true;
        })
    ])(log);
    setTimeout(core.h_dispose, 1000);
}


if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(host_dev);
