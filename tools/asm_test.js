// A requestor that runs the tests embedded in a uFork assembly module.

// The requestor factory takes a URL string pointing to an *.asm file and
// produces a report object like {pass, logs}, where "pass" is a boolean
// indicating success (or undefined if the module was ineligible).
// If "pass" is not true, "logs" is an array of log entries like
// [log_level, ...values] that might help debug the failure.

// See testing.md.

/*jslint web, global */

import import_map from "./import_map.js";
import parseq from "https://ufork.org/lib/parseq.js";
import assemble from "https://ufork.org/lib/assemble.js";
import ufork from "https://ufork.org/js/ufork.js";
import host_dev from "https://ufork.org/js/host_dev.js";
import blob_dev from "https://ufork.org/js/blob_dev.js";
import clock_dev from "https://ufork.org/js/clock_dev.js";
import random_dev from "https://ufork.org/js/random_dev.js";
import timer_dev from "https://ufork.org/js/timer_dev.js";
const wasm_href = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");
const demo_href = import.meta.resolve("https://ufork.org/lib/rq/race.asm");

function asm_test(module_url, time_limit = 5000) {
    let logs = [];
    let core;
    let start_time = 0;
    let timer;
    let the_callback;
    let nr_audits = 0;

    function log(...values) {
        const elapsed = Date.now() - start_time;
        logs.push([elapsed, ...values]);
    }

    function run_ufork() {
        const status = ufork.fix_to_i32(core.h_run_loop(0));
        if (status === ufork.E_OK) {
            return log(ufork.LOG_DEBUG, "IDLE");
        }
        log(ufork.LOG_WARN, "FAULT", ufork.fault_msg(status));
        the_callback({pass: false, logs});
    }

    core = ufork.make_core({
        wasm_url: wasm_href,
        on_wakeup(sender, events) {
            log(
                ufork.LOG_WARN,
                "WAKE",
                ufork.print(sender),
                ...events.map(core.u_pprint)
            );
            run_ufork();
        },
        log_level: ufork.LOG_TRACE,
        on_log: log,
        on_audit(code, evidence) {
            nr_audits += 1;
            log(
                ufork.LOG_WARN,
                "AUDIT",
                ufork.fault_msg(ufork.fix_to_i32(code)),
                core.u_pprint(evidence)
            );
        },
        import_map,
        compilers: {asm: assemble}
    });
    return parseq.sequence([
        core.h_initialize(),
        core.h_import(module_url),
        function asm_test_requestor(callback, asm_module) {
            start_time = Date.now();
            the_callback = callback;
            const make_ddev = host_dev(core);
            blob_dev(core, make_ddev);
            clock_dev(core);
            random_dev(core);
            timer_dev(core);
            if (asm_module.test === undefined) {
                log(ufork.LOG_WARN, "Module did not export a test.");
                return callback({logs});
            }
            try {
                const ddev = make_ddev(function on_event_stub(ptr) {
                    clearTimeout(timer);
                    const event_stub = core.u_read_quad(ptr);
                    const event = core.u_read_quad(event_stub.y);
                    const message = event.y;
                    core.h_dispose();
                    if (message === ufork.TRUE_RAW && nr_audits === 0) {
                        return callback({pass: true, logs});
                    }
                    log(ufork.LOG_WARN, "VERDICT", core.u_pprint(message));
                    return callback({pass: false, logs});
                });

// Set a timeout timer and run the test suite.

                timer = setTimeout(function () {
                    core.h_dispose();
                    log(ufork.LOG_WARN, "TIMEOUT");
                    return callback({pass: false, logs});
                }, time_limit);
                const judge = ddev.h_reserve_proxy();
                core.h_boot(asm_module.test, judge);
                core.h_refill({memory: 4096, events: 256, cycles: 4096});
                run_ufork();
                return core.h_dispose; // cancel
            } catch (exception) {
                log(ufork.LOG_WARN, "EXCEPTION", exception);
                core.h_dispose();
                return callback({pass: false, logs});
            }
        }
    ]);
}

if (import.meta.main) {
    asm_test(demo_href)(globalThis.console.log);
}

export default Object.freeze(asm_test);
