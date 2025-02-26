// An asynchronous message-based interface for remotely controlling and
// monitoring a uFork WASM core. It is intended for use in both production and
// development scenarios.

// Message delivery is assumed to be reliable and in order.
// Messages are objects with a 'kind' property.
// The driver receives command messages and emits status messages.
// The protocol follows a publish-subscribe (rather than a request-response)
// model, in an attempt to mitigate the effects of network latency.

// The message protocol is described below.

// COMMAND MESSAGES

//  {kind: "subscribe", topic: <string>, throttle: <number>}
//  {kind: "unsubscribe", topic: <string>}

//      Subscribe or unsubscribe from a particular kind of status message.

//      Specify a 'throttle' in milliseconds ensures that no more than one
//      status message of that kind is emitted in a given interval.

//  {kind: "play", debug: <boolean>}

//      Run indefinitely. The core not only runs until idle, but also continues
//      whenever it is awoken by a device.

//      If the optional 'debug' property is true, the driver will pause upon
//      encountering a 'debug' instruction. (Maximum execution speed is
//      significantly reduced when using this feature.)

//  {kind: "pause"}

//      Stop running the core.

//  {kind: "step"}

//      Execute a single VM instruction cycle and produce a "signal"
//      status message.

//  {kind: "auto_refill", enabled: <boolean>}

//      Enables or disables automatic refilling of the root sponsor.
//      When 'enabled' is true, commands such as "play" and "step" are made to
//      behave as if the root sponsor is inexhaustible. Enabled by default.

//  {kind: "interval", milliseconds: <number>}

//      If 'milliseconds' is greater than 0, an artificial delay is inserted
//      between instructions when playing. Defaults to 0.

//  {kind: "refill", resources: <object>}

//      Refill the root sponsor with the given 'resources', an object like
//      {memory, events, cycles}.

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
//  {kind: "rom", bytes: <Uint8Array>}

//      Current contents of quad memory.

//  {kind: "source", sourcemap: <object>}

//      The full text of the source file, and range within, of the current
//      instruction. The 'sourcemap' is an object like {debug, text}.

//  {kind: "labels", mapping: <object>}

//      A partial mapping from ROM pointers to debug labels, for
//      example {"54": "fork_beh", "63": "join_beh", "82": "list_of_3"}.

//  {kind: "auto_refill", enabled: <boolean>}
//  {kind: "interval", milliseconds: <number>}

//      Current value as set by commands of the same name.

/*jslint web, global */

import assemble from "https://ufork.org/lib/assemble.js";
import throttle from "https://ufork.org/lib/throttle.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import ufork from "../ufork.js";
import timer_dev from "../timer_dev.js";
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");
const lib_url = import.meta.resolve("../../../lib/");

function make_driver(core, on_status) {
    let auto_refill_enabled = true;
    let interval = 0;
    let play_debug;
    let play_timer;
    let signal;
    let subscriptions = Object.create(null);

    function publish(kind) {
        const callback = subscriptions[kind];
        if (callback === undefined) {
            return;
        }
        if (kind === "auto_refill") {
            callback({kind: "auto_refill", value: auto_refill_enabled});
        } else if (kind === "interval") {
            callback({kind: "interval", milliseconds: interval});
        } else if (kind === "labels") {
            let mapping = Object.create(null);
            new Array(core.h_rom_top()).fill().forEach(function (_, ofs) {
                const ptr = ufork.romptr(ofs);
                const debug = core.u_sourcemap(ptr)?.debug;
                if (debug?.label !== undefined) {
                    mapping[ptr] = debug.label;
                }
            });
            callback({kind: "labels", mapping});
        } else if (kind === "playing") {
            callback({kind: "playing", value: play_debug !== undefined});
        } else if (kind === "ram") {
            callback({kind: "ram", bytes: core.h_ram()});
        } else if (kind === "rom") {
            callback({kind: "rom", bytes: core.h_rom()});
        } else if (kind === "signal" && signal !== undefined) {
            callback({kind: "signal", signal});
        } else if (kind === "source") {
            const ip = core.u_current_continuation()?.ip;
            callback({
                kind: "source",
                sourcemap: (
                    ip !== undefined
                    ? core.u_sourcemap(ip)
                    : undefined  // no source available
                )
            });
        }
    }

    function publish_state() {
        publish("ram");
        publish("rom");
        publish("signal");
        publish("source");
    }

    function auto_refill(signal) {
        if (auto_refill_enabled && signal !== ufork.UNDEF_RAW) {
            const error_code = ufork.fix_to_i32(signal);
            if (
                error_code === ufork.E_MEM_LIM
                || error_code === ufork.E_MSG_LIM
                || error_code === ufork.E_CPU_LIM
            ) {
                core.h_refill({memory: 65536, events: 8192, cycles: 65536});
                return true;
            }
        }
        return false;
    }

    function step() {
        signal = core.h_run_loop(1);
        if (auto_refill(signal)) {
            return step();  // try again
        }
        publish_state();
    }

    function pause() {
        play_debug = undefined;
        clearTimeout(play_timer);
        publish("playing");
    }

    function run() {
        if (play_debug === undefined) {
            return;  // paused
        }

// Run until there is no more work or an unrecoverable error occurs.

        while (true) {
            signal = core.h_run_loop(
                (play_debug || interval > 0)
                ? 1  // step by step
                : 0  // run free
            );

// Have we hit a breakpoint?

            if (play_debug) {
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

// Handle resource exhaustion.

            if (!auto_refill(signal)) {
                if (ufork.is_fix(signal)) {
                    if (ufork.fix_to_i32(signal) !== ufork.E_OK) {
                        pause();
                    }
                    return publish_state();
                }

// Add artificial delay if requested.

                if (interval > 0) {
                    play_timer = setTimeout(run, interval);
                    return publish_state();
                }
            }
        }
    }

    function wakeup(device_offset) {
        if (play_debug === undefined) {
            if (subscriptions.wakeup !== undefined) {
                subscriptions.wakeup({kind: "wakeup", device_offset});
            }
            publish_state();
        } else {
            run();
        }
    }

    const commands = {
        auto_refill(message) {
            auto_refill_enabled = message.enabled === true;
            publish("auto_refill");
        },
        interval(message) {
            interval = message.milliseconds ?? 0;
            publish("interval");
        },
        play(message) {
            play_debug = message.debug === true;
            publish("playing");
            run();
        },
        pause,
        refill(message) {
            core.h_refill(message.resources);
        },
        step,
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
            driver.command({kind: "subscribe", topic: "ram", throttle: 1000});
            // driver.command({kind: "subscribe", topic: "rom"});
            // driver.command({kind: "auto_refill", enabled: false});
            driver.command({kind: "refill", resources: {cycles: 3}});
            new Array(30).fill().forEach(function () {
                driver.command({kind: "step"});  // kick it off
            });
            return true;
        })
    ])(log);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(make_driver);
