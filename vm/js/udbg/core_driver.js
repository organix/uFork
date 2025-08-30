// An asynchronous message-based interface for remotely controlling and
// monitoring a uFork WASM core. It is intended for use in both production and
// development.

// The message protocol is described in udbg.md.

/*jslint web, global */

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
    let verbose = Object.create(null);
    let wake_timer;

    function consume_step() {
        if (step_queue.length === 0) {
            return;
        }
        const {kind, payload, ram} = step_queue[0];
        let message = {};
        if (auto_pause_on.includes(kind)) {
            steps = undefined;
            if (verbose.playing !== undefined) {
                message.playing = {value: false};
            }
        }
        if (ram !== undefined) {
            message.ram = {bytes: ram};
        }
        message[kind] = payload;
        on_status(message);
        step_queue.shift();
        if (steps !== undefined) {
            steps -= 1;
        }
    }

    function step(kind, payload = {}) {
        const pause = auto_pause_on.includes(kind);

// Skip steps that the client can not observe.

        if (!pause && verbose[kind] !== true) {
            return;
        }
        let the_step = {kind, payload};
        if (verbose.ram === true || (pause && verbose.ram === false)) {

// It is possible for 'step' to be called from within a run loop, so avoid
// reentrancy in that case. We make a copy of the Uint8Array to avoid mutation
// in subsequent steps.

            the_step.ram = new Uint8Array(
                signal === running
                ? core.u_ram() // TODO compact?
                : core.h_ram()
            );
        }
        step_queue.push(the_step);
        if (steps !== undefined && steps > 0) {
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
                steps = undefined;
                if (verbose.playing !== undefined) {
                    on_status({playing: {value: false}});
                }
                return;
            }

// Run the core. It is possible that 'h_run_loop' will call 'txn'
// causing 'run' to be reentered, so we guard against that with a special
// signal value.

            signal = running;
            signal = core.h_run_loop(
                (
                    auto_pause_on.includes("debug")     // monitor for VM_DEBUG
                    || verbose.debug === true           // report breakpoints
                    || auto_pause_on.includes("instr")  // single stepping
                    || verbose.instr === true           // report instructions
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

// Stop running the core if it has become idle or experienced an unrecoverable
// fault.

                if (ufork.is_fix(signal)) {
                    const code = ufork.fix_to_i32(signal);
                    return (
                        code === ufork.E_OK
                        ? step("idle")
                        : step("fault", {code})
                    );
                }

// An instruction step has concluded.

                step("instr");

// Pause if the next instruction is a breakpoint.

                if (ip()?.x === ufork.VM_DEBUG) {
                    step("debug");
                }
            }
        }
    }

    function txn(wake, sender, events) {
        step("txn", {sender, events, wake});
        if (wake === true) {

// It is possible that 'txn' was called by 'u_defer' within 'h_run_loop',
// so defer the call to a future turn to avoid reentry.

            clearTimeout(wake_timer);
            wake_timer = setTimeout(run);
        }
    }

    function audit(code, evidence) {
        step("audit", {code, evidence});
    }


    function publish_state(kinds) {
        kinds = kinds.filter(function (kind) {
            return verbose[kind] !== undefined;
        });
        if (kinds.length === 0) {
            return;
        }
        let message = {};
        if (kinds.includes("auto_pause")) {
            message.auto_pause = {on: auto_pause_on};
        }
        if (kinds.includes("auto_refill")) {
            message.auto_refill = {enabled: auto_refill_enabled};
        }
        if (kinds.includes("playing")) {
            message.playing = {value: steps !== undefined};
        }
        if (kinds.includes("ram")) {
            message.ram = {bytes: new Uint8Array(core.h_ram())};
        }
        if (kinds.includes("rom")) {
            message.rom = {
                bytes: new Uint8Array(core.h_rom()),
                debugs: core.u_rom_debugs(),
                module_texts: core.u_module_texts()
            };
        }
        if (kinds.includes("statuses")) {
            message.statuses = {verbose};
        }
        on_status(message);
    }

    const commands = {
        auto_pause(message) {
            if (Array.isArray(message.on)) {
                auto_pause_on = message.on;
            }
            publish_state(["auto_pause"]);
        },
        auto_refill(message) {
            auto_refill_enabled = message.enabled === true;
            publish_state(["auto_refill"]);
        },
        pause() {
            steps = undefined;
            publish_state(["playing"]);
        },
        play(message) {
            if (steps !== undefined) {
                return;
            }

// The 'steps' parameter is undocumented because steps are an implementation
// detail of the core driver.

            steps = (
                Number.isSafeInteger(message.steps)
                ? message.steps
                : Infinity
            );
            publish_state(["playing"]);
            run();
        },
        refill(message) {
            core.h_refill(message.resources);
        },
        statuses(message) {
            if (typeof message.verbose === "object") {
                verbose = Object.assign(
                    Object.create(null),
                    message.verbose
                );
                publish_state(Object.keys(verbose));
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
        clearTimeout(wake_timer);
    }

    return Object.freeze({command, dispose, txn, audit});
}

function demo(log) {
    let driver;
    let nr_plays_remaining = Infinity;
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
        log("STATUS {" + Object.keys(message).join(", ") + "}");
        if (message.playing !== undefined) {
            log("playing:", message.playing);
            if (message.playing.value === false && nr_plays_remaining > 0) {
                nr_plays_remaining -= 1;
                setTimeout(driver.command, 0, {kind: "play"});  // continue
            }
        }
        if (message.audit !== undefined) {
            log("audit:", ufork.fault_msg(message.audit.code));
        } else if (message.fault !== undefined) {
            log("fault:", ufork.fault_msg(message.fault.code));
        } else if (message.txn !== undefined) {
            log("txn:", message.txn);
        }
    });
    parseq.sequence([
        core.h_initialize(),
        core.h_import("https://ufork.org/lib/rq/delay.asm"),
        // core.h_import("https://ufork.org/lib/blob.asm"),
        requestorize(function () {
            blob_dev(core);
            timer_dev(core);
            core.h_boot();
            driver.command({
                kind: "auto_pause",
                on: ["audit", "debug", "fault", "txn"]
            });
            // driver.command({kind: "auto_refill", enabled: false});
            // driver.command({kind: "refill", resources: {cycles: 3}});
            driver.command({
                kind: "statuses",
                verbose: {
                    audit: true,
                    debug: true,
                    fault: true,
                    idle: true,
                    instr: false,
                    playing: false,
                    ram: false,
                    rom: false,
                    txn: false
                }
            });
            // setTimeout(function () {
            //     nr_plays_remaining = 0;
            //     driver.command({kind: "pause"});
            // }, 500);
            return true;
        })
    ])(log);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(make_driver);
