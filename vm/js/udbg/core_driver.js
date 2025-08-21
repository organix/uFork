// An asynchronous message-based interface for remotely controlling and
// monitoring a uFork WASM core. It is intended for use in both production and
// development.

// The message protocol is described in udbg.md.

/*jslint web, global, devel */

import assemble from "https://ufork.org/lib/assemble.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import ufork from "../ufork.js";
import make_core from "../core.js";
import blob_dev from "../blob_dev.js";
import timer_dev from "../timer_dev.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");

const max_fixnum = ufork.fixnum(2 ** 30 - 1);
const resource_error_codes = Object.freeze([
    ufork.E_MEM_LIM,
    ufork.E_MSG_LIM,
    ufork.E_CPU_LIM
]);
const resource_signals = resource_error_codes.map(ufork.fixnum);
const running = Object.freeze({});

function make_driver(core, on_status) {
    let auto_pause_on = [];
    let auto_refill_enabled = true;
    let signal;
    let step_queue = [];
    let steps;
    let subscriptions = [];

    function publish(kind) {
        if (!subscriptions.includes(kind)) {
            return;
        }
        if (kind === "auto_pause") {
            on_status({kind: "auto_pause", on: auto_pause_on});
        } else if (kind === "auto_refill") {
            on_status({kind: "auto_refill", value: auto_refill_enabled});
        } else if (kind === "playing") {
            on_status({kind: "playing", value: steps !== undefined});
        } else if (kind === "ram" && step_queue.length > 0) {
            on_status({kind: "ram", bytes: step_queue[0].ram});
        } else if (kind === "rom") {
            on_status({
                kind: "rom",
                bytes: core.h_rom(),
                debugs: core.u_rom_debugs(),
                module_texts: core.u_module_texts()
            });
        } else if (kind === "statuses") {
            on_status({kind: "statuses", value: subscriptions});
        }
    }

    function publish_step() {
        const kind = step_queue[0].message.kind;
        if (!subscriptions.includes(kind)) {
            return;
        }
        on_status(step_queue[0].message);
    }

    function pause() {
        if (steps === undefined) {
            return;
        }
        steps = undefined;
        publish("playing");
    }

    function consume_step() {
        if (step_queue.length === 0) {
            return;
        }
        publish("ram");
        publish_step();
        const the_step = step_queue.shift();
        if (the_step.pause) {
            pause();
        }
        if (steps !== undefined) {
            steps -= 1;
        }
    }

    function step(message, pause = false) {

// TODO can we do less work if steps === Infinity and there are no "step"
// or "ram" subscriptions?

        step_queue.push({
            message,
            pause,

// It is possible for 'step' to be called from within a run loop, so avoid
// reentrancy in that case. We copy the Uint8Array as it will be mutated in
// subsequent steps.

            ram: new Uint8Array(
                signal === running
                ? core.u_ram() // TODO compact?
                : core.h_ram()
            )
        });
        if (steps === undefined) {
            return;
        }
        if (steps > 0) {
            consume_step();
        }
    }

    function ip() {
        const cc = core.u_current_continuation();
        if (cc !== undefined) {
            return core.u_read_quad(cc.ip);
        }
    }

    function run() {
        if (signal === running || steps === undefined) {
            return;
        }
        while (true) {

// Drain the step queue before running the core.

            while (step_queue.length > 0 && steps !== undefined && steps > 0) {
                consume_step();
            }

// Bail if the driver was paused during the previous loop iteration or whilst
// consuming steps.

            if (steps === undefined) {
                return;
            }

// Pause if we have reached the step limit.

            if (steps <= 0) {
                return pause();
            }

// Run the core. It is possible that 'h_run_loop' will call 'txn'
// causing 'run' to be reentered, so we guard against that with a special
// signal value.

            signal = running;
            signal = core.h_run_loop(
                (
                    auto_pause_on.includes("debug")     // monitor for VM_DEBUG
                    || auto_pause_on.includes("instr")  // single step
                    || Number.isFinite(steps)           // step limit
                )
                ? 1
                : 0
            );

// If the root sponsor is exhausted, refill it and retry.

            if (auto_refill_enabled && resource_signals.includes(signal)) {
                core.h_refill({
                    memory: max_fixnum,
                    events: max_fixnum,
                    cycles: max_fixnum
                });
            } else {

// Pause on breakpoints.

                if (
                    auto_pause_on.includes("debug")
                    && ip()?.x === ufork.VM_DEBUG
                ) {
                    return step(
                        {kind: "debug"},
                        true
                    );
                }

// Stop running the core if it has become idle. Additionally, pause the driver
// if there was a fault.

                if (ufork.is_fix(signal)) {
                    return step(
                        {kind: "signal", signal},
                        ufork.fix_to_i32(signal) !== ufork.E_OK
                    );
                }

// An instruction step has concluded.

                if (
                    subscriptions.includes("signal")
                    || auto_pause_on.includes("instr")
                ) {
                    step({kind: "signal", signal});
                }
            }
        }
    }

    function txn(wake, sender, events) {
        step({kind: "txn", sender, events, wake});
        if (wake === true) {

// It is possible that 'txn' was called by 'u_defer' within 'h_run_loop',
// so defer the call to a future turn to avoid reentry.

            setTimeout(run, 0);
        }
    }

    function audit(code, evidence) {
        step(
            {kind: "audit", code, evidence},
            auto_pause_on.includes("audit")
        );
    }

    const commands = {
        auto_pause(message) {
            if (Array.isArray(message.on)) {
                auto_pause_on = message.on;
            }
        },
        auto_refill(message) {
            auto_refill_enabled = message.enabled === true;
            publish("auto_refill");
        },
        pause,
        play(message) {
            steps = (
                Number.isSafeInteger(message.steps) // TODO no message.steps?
                ? message.steps
                : Infinity
            );
            publish("playing");
            run();
        },
        refill(message) {
            core.h_refill(message.resources);
        },
        statuses(message) {
            if (Array.isArray(message.kinds)) {
                subscriptions = message.kinds;
                subscriptions.forEach(publish);
            }
        }
    };

    function command(message) {
        if (Object.hasOwn(commands, message.kind)) {
            return commands[message.kind](message);
        }
        throw new Error("Unknown command kind: " + message.kind);
    }

    function dispose() {
        return; // TODO remove this method?
    }

    return Object.freeze({command, dispose, txn, audit});
}

function demo(log) {
    let driver;
    const core = make_core({
        wasm_url,
        on_txn(...args) {
            driver.txn(...args);
        },
        on_audit(...args) {
            driver.audit(...args);
        },
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble}
    });
    driver = make_driver(core, function on_status(message) {
        if (message.kind === "audit") {
            log("audit:", ufork.fault_msg(message.code));
        } else if (message.kind === "debug") {
            log("debug:", message);
        } else if (message.kind === "txn") {
            log("txn:", message);
            if (message.wake) {
                driver.command({kind: "play"});  // continue
            }
        } else if (message.kind === "playing") {
            log("playing:", message.value);
        } else if (message.kind === "signal") {
            log("signal:", (
                message.signal === ufork.UNDEF_RAW
                ? "step limit reached"
                : (
                    ufork.is_fix(message.signal)
                    ? ufork.fault_msg(ufork.fix_to_i32(message.signal))
                    : message.signal
                )
            ));
        }
    });
    parseq.sequence([
        core.h_initialize(),
        // core.h_import("https://ufork.org/lib/rq/delay.asm"),
        core.h_import("https://ufork.org/lib/blob.asm"),
        requestorize(function () {
            blob_dev(core);
            timer_dev(core);
            core.h_boot();
            driver.command({
                kind: "statuses",
                kinds: [
                    "signal",
                    "audit",
                    "debug",
                    "txn",
                    "playing",
                    "ram",
                    "rom"
                ]
                // TODO
                // kinds: ["audit", "txn", "playing", "ram", "rom"]
            });
            driver.command({
                kind: "auto_pause",
                on: ["audit", "debug", "fault", "instr"]
            });
            // driver.command({kind: "auto_refill", enabled: false});
            // driver.command({kind: "refill", resources: {cycles: 3}});
            driver.command({kind: "play", steps: 300});
            return true;
        })
    ])(log);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(make_driver);
