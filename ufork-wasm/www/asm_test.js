// A requestor that runs the tests embedded in a uFork assembly module.

// The requestor factory takes a URL string pointing to an *.asm file and
// produces a report object like {pass, logs}, where "pass" is a boolean
// indicating success (or undefined if the module was ineligible).
// If "pass" is not true, "logs" is an array of log entries like
// [log_level, ...values] that might help debug the failure.

// Eligible modules export a 'test' entrypoint, for example:

//      test:                       ; (verdict) <- {caps}
//          push #t                 ; #f
//          state 1                 ; #f verdict
//          ref std.send_msg        ; FAIL!

//      .export
//          test

// The 'verdict' capability is sent the outcome of the test. Anything other
// than #t is considered a failure.

/*jslint browser */

import parseq from "./parseq.js";
import ufork from "./ufork.js";
import lazy from "./requestors/lazy.js";
import host_device from "./devices/host_device.js";
import clock_device from "./devices/clock_device.js";
import timer_device from "./devices/timer_device.js";

function asm_test(module_url) {
    let logs = [];
    let core;
    let dispose_timer;
    let the_callback;

    function run_ufork() {
        const status = core.u_fix_to_i32(core.h_run_loop(0));
        if (status === ufork.E_OK) {
            return logs.push([ufork.LOG_DEBUG, "IDLE"]);
        }
        logs.push([ufork.LOG_WARN, "FAULT", core.u_fault_msg(status)]);
        the_callback({pass: false, logs});
    }

    return parseq.sequence([
        ufork.instantiate_core(
            import.meta.resolve(
                "../target/wasm32-unknown-unknown/debug/ufork_wasm.wasm"
            ),
            run_ufork,
            function on_log(...args) {
                logs.push([...args]);
            },
            ufork.LOG_DEBUG
        ),
        lazy(function (the_core) {
            core = the_core;
            clock_device(core);
            dispose_timer = timer_device(core);
            return core.h_import(module_url);
        }),
        function asm_test_requestor(callback, asm_module) {
            the_callback = callback;
            if (asm_module.test === undefined) {
                logs.push([ufork.LOG_WARN, "Module did not export a test."]);
                return callback({logs});
            }
            try {
                const make_dynamic_device = host_device(core);
                const device = make_dynamic_device(function on_event_stub(ptr) {
                    const event_stub = core.u_read_quad(ptr);
                    const event = core.u_read_quad(event_stub.y);
                    const message = event.y;
                    dispose_timer();
                    return (
                        message === ufork.TRUE_RAW
                        ? callback({pass: true})
                        : callback({pass: false, logs})
                    );
                });
                const state = core.h_reserve_ram({
                    t: ufork.PAIR_T,
                    x: device.h_reserve_proxy(),
                    y: ufork.NIL_RAW
                });
                core.h_boot(asm_module.test, state);
                run_ufork();
                return dispose_timer; // cancel
            } catch (exception) {
                logs.push([ufork.LOG_WARN, "EXCEPTION", exception]);
                dispose_timer();
                return callback({pass: false, logs});
            }
        }
    ]);
}

//debug asm_test(
//debug     import.meta.resolve("../lib/loop.asm")
//debug )(
//debug     console.log
//debug );

export default Object.freeze(asm_test);