// An asynchronous message-based interface for remotely controlling and
// monitoring a uFork WASM core. It is intended for use in both production and
// development scenarios.

// Message delivery is assumed to be reliable and in order.
// Messages are objects with a 'kind' property.
// The driver receives command messages and emits status messages.
// The protocol follows a publish-subscribe (rather than a request-response)
// model, in order to mitigate the effects of network latency.

// The message protocol is described below.

// COMMAND MESSAGES

//  {kind: "subscribe", topic: <string>, throttle: <number>}
//  {kind: "unsubscribe", topic: <string>}

//      Subscribe or unsubscribe from a particular kind of status message.

//      Specify a 'throttle' in milliseconds ensures that no more than one
//      status message of that kind is emitted in a given interval.

//  {kind: "play", steps: <number>}

//      Start running the core. The playing state persists even through periods
//      of idleness, automatically continuing when the core is awoken by a
//      device.

//      The optional 'steps' property dictates how many steps to run before
//      pausing. If omitted, the core will run indefinitely.

//      The driver will pause when one of the following conditions is met:
//          - an unrecoverable fault, such as E_FAIL, occurs
//          - a breakpoint is hit is 'debug' is true
//          - enough 'steps' have been performed

//  {kind: "pause"}

//      Stop running the core.

//  {kind: "debug", enabled: <boolean>}

//      If enabled, the driver will pause upon encountering a 'debug'
//      instruction. Note that maximum execution speed will be significantly
//      reduced. Disabled by default.

//  {kind: "interval", milliseconds: <number>}

//      If 'milliseconds' is greater than 0, an artificial delay is inserted
//      between steps when playing. Defaults to 0.

//  {kind: "refill", resources: <object>}

//      Refill the root sponsor with the given 'resources', an object like
//      {memory, events, cycles}.

//  {kind: "auto_refill", enabled: <boolean>}

//      Enables or disables automatic refilling of the root sponsor.
//      When 'enabled' is true, the "play" command behaves as if the root
//      sponsor is inexhaustible. Enabled by default.

// STATUS MESSAGES

// Status messages provides real-time updates on the state of the core. Status
// messages of a particular kind are only emitted if the controller has
// expressed interest with a "subscribe" command.

//  {kind: "signal", signal: <raw>}

//      The core halted, producing a raw 'signal' value:
//          - The fixnum 0 (E_OK) indicates that the core is idle.
//          - A negative fixnum indicates a fault occurred, e.g. E_FAIL.
//          - #? indicates that the core hit the step limit, but is not idle.

//  {kind: "wakeup", device_offset: <number>}

//      A device has attempted to wake up the core.

//  {kind: "playing", value: <boolean>}

//      Whether the driver is currently "playing". This does not necessarily
//      mean the core is running, just that the core will run when it is given
//      some work. The driver can pause due to conditions detected in the core,
//      for example when a 'debug' instruction is encountered.

//      The driver is initially paused (false).

//  {kind: "ram", bytes: <Uint8Array>}

//      Current contents of quad RAM.

//  {kind: "rom", bytes: <Uint8Array>, debugs: <object>, module_texts: <object>}

//      Current contents of quad ROM. The 'debugs' object contains debug objects
//      like {src, label, start, end}, keyed by pointer. The 'module_texts'
//      object contains the source text of each loaded module, keyed by src.

//  {kind: "auto_refill", enabled: <boolean>}
//  {kind: "debug", enabled: <boolean>}
//  {kind: "interval", milliseconds: <number>}

//      Current value as set by the command of the same name.

/*jslint web, global */

import assemble from "https://ufork.org/lib/assemble.js";
import throttle from "https://ufork.org/lib/throttle.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import ufork from "../ufork.js";
import timer_dev from "../timer_dev.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");

const max_fixnum = ufork.fixnum(2 ** 30 - 1);

function make_driver(core, on_status) {
    let auto_refill_enabled = true;
    let debug = false;
    let interval = 0;
    let play_timer;
    let signal;
    let steps;
    let subscriptions = Object.create(null);

    function publish(kind) {
        const callback = subscriptions[kind];
        if (callback === undefined) {
            return;
        }
        if (kind === "auto_refill") {
            callback({kind: "auto_refill", value: auto_refill_enabled});
        } else if (kind === "debug") {
            callback({kind: "debug", enabled: debug});
        } else if (kind === "interval") {
            callback({kind: "interval", milliseconds: interval});
        } else if (kind === "playing") {
            callback({kind: "playing", value: steps !== undefined});
        } else if (kind === "ram") {
            callback({kind: "ram", bytes: core.h_ram()});
        } else if (kind === "rom") {
            callback({
                kind: "rom",
                bytes: core.h_rom(),
                debugs: core.u_rom_debugs(),
                module_texts: core.u_module_texts()
            });
        } else if (kind === "signal" && signal !== undefined) {
            callback({kind: "signal", signal});
        }
    }

    function publish_state() {
        publish("ram");
        publish("signal");
    }

    function pause() {
        steps = undefined;
        clearTimeout(play_timer);
        publish("playing");
    }

    function run() {
        if (steps === undefined) {
            return;  // paused
        }
        while (true) {

// Pause if we have reached the step limit.

            if (steps <= 0) {
                pause();
                return publish_state();
            }

// Run the core.

            signal = core.h_run_loop(
                (debug || interval > 0)
                ? 1  // cycle by cycle
                : 0  // run free
            );

// Pause if we have hit a breakpoint.

            if (debug) {
                const cc = core.u_current_continuation();
                if (cc !== undefined) {
                    const instruction_quad = core.u_read_quad(cc.ip);
                    const op_code = instruction_quad.x;
                    if (op_code === ufork.VM_DEBUG) {
                        pause();
                        return publish_state();
                    }
                }
            }

// Refill the root sponsor if it is exhausted.

            if (auto_refill_enabled && signal !== ufork.UNDEF_RAW) {
                const error_code = ufork.fix_to_i32(signal);
                if (
                    error_code === ufork.E_MEM_LIM
                    || error_code === ufork.E_MSG_LIM
                    || error_code === ufork.E_CPU_LIM
                ) {
                    core.h_refill({
                        memory: max_fixnum,
                        events: max_fixnum,
                        cycles: max_fixnum
                    });
                    signal = ufork.UNDEF_RAW;  // recovered
                }
            }

// Pause if we have run out of work or experienced a fault.

            if (ufork.is_fix(signal)) {
                if (ufork.fix_to_i32(signal) !== ufork.E_OK) {
                    pause();
                }
                return publish_state();
            }
            steps -= 1;

// Add artificial delay if requested.

            if (interval > 0) {
                play_timer = setTimeout(run, interval);
                return publish_state();
            }
        }
    }

    function wakeup(device_offset) {
        if (subscriptions.wakeup !== undefined) {
            subscriptions.wakeup({kind: "wakeup", device_offset});
        }
        if (steps !== undefined) {
            run();
        } else {
            publish_state();
        }
    }

    const commands = {
        auto_refill(message) {
            auto_refill_enabled = message.enabled === true;
            publish("auto_refill");
        },
        debug(message) {
            debug = message.enabled === true;
            publish("debug");
        },
        interval(message) {
            interval = (
                Number.isSafeInteger(message.milliseconds)
                ? message.milliseconds
                : 0
            );
            publish("interval");
        },
        pause,
        play(message) {
            steps = (
                Number.isSafeInteger(message.steps)
                ? message.steps
                : Infinity
            );
            publish("playing");
            run();
        },
        refill(message) {
            core.h_refill(message.resources);
        },
        subscribe(message) {
            subscriptions[message.topic] = (
                message.throttle !== undefined
                ? throttle(on_status, message.throttle)
                : on_status
            );
            publish(message.topic);
        },
        unsubscribe(message) {
            delete subscriptions[message.topic];
        }
    };

    function command(message) {
        if (Object.hasOwn(commands, message.kind)) {
            return commands[message.kind](message);
        }
        throw new Error("Unknown command kind: " + message.kind);
    }

    function dispose() {
        clearTimeout(play_timer);
    }

    return Object.freeze({command, dispose, wakeup});
}

function demo(log) {
    let driver;
    const core = ufork.make_core({
        wasm_url,
        on_wakeup(device_offset) {
            driver.wakeup(device_offset);
        },
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble}
    });
    driver = make_driver(core, function on_status(message) {
        if (message.kind === "signal") {
            log("STATUS signal:", (
                message.signal === ufork.UNDEF_RAW
                ? "step limit reached"
                : ufork.fault_msg(ufork.fix_to_i32(message.signal))
            ));
        } else {
            log("STATUS " + message.kind);
            if (message.kind === "wakeup") {
                driver.command({kind: "play"});  // continue
            }
        }
    });
    parseq.sequence([
        core.h_initialize(),
        core.h_import("https://ufork.org/lib/rq/delay.asm"),
        requestorize(function (module) {
            timer_dev(core);
            core.h_boot(module.boot);
            driver.command({kind: "subscribe", topic: "signal", throttle: 50});
            driver.command({kind: "subscribe", topic: "wakeup"});
            driver.command({kind: "subscribe", topic: "rom"});
            driver.command({kind: "subscribe", topic: "ram", throttle: 1000});
            // driver.command({kind: "subscribe", topic: "rom"});
            // driver.command({kind: "auto_refill", enabled: false});
            driver.command({kind: "refill", resources: {cycles: 3}});
            driver.command({kind: "play", steps: 30});
            return true;
        })
    ])(log);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(make_driver);
