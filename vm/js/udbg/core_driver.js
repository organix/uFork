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
//      pausing, where the size of each step is controlled by the "step_size"
//      command. If omitted, the core will run indefinitely.

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

//  {kind: "step_size", value: <string>}

//      Set the step size. The 'value' controls how much activity is performed
//      in a single step:

//          "instr"
//              One iteration of the run-loop. This involves executing the
//              instruction at the front of the continuation queue (if any),
//              dispatching the event at the front of the event queue (if any),
//              and possibly performing some GC. Default.

//          "txn"
//              Until the conclusion of an actor transaction, right before
//              an 'end commit' or 'end abort' instruction is executed.

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

//  {kind: "device_txn", sender: <raw>, events: <Array>, wake: <boolean>}

//      The pseudo-transactional effects of a device enqueuing one or more
//      events and possibly attempting waking up the core.

//      The 'sender' is the capability of the device or proxy that generated the
//      events. Omitted if no device transaction occurred during the previous
//      run-loop iteration.

//      The 'events' array contains pointers to each of the generated events.

//      If the device has attempted to wake up the core, 'wake' is true.

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
//  {kind: "step_size", value: <string>}

//      Current value as set by the command of the same name.

/*jslint web, global */

import assemble from "https://ufork.org/lib/assemble.js";
import throttle from "https://ufork.org/lib/throttle.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import ufork from "../ufork.js";
import blob_dev from "../blob_dev.js";
import timer_dev from "../timer_dev.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");

const max_fixnum = ufork.fixnum(2 ** 30 - 1);
const busy = Object.freeze({});

function make_driver(core, on_status) {
    let auto_refill_enabled = true;
    let debug = false;
    let device_txn;
    let interval = 0;
    let play_timer;
    let signal;
    let step_size = "instr";
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
        } else if (kind === "device_txn") {
            callback({
                kind: "device_txn",
                sender: device_txn?.sender,
                events: device_txn?.events,
                wake: device_txn?.wake
            });
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
        } else if (kind === "signal" && ufork.is_raw(signal)) {
            callback({kind: "signal", signal});
        } else if (kind === "step_size") {
            callback({kind: "step_size", value: step_size});
        }
    }

    function publish_state() {
        publish("ram");
        publish("signal");
        publish("device_txn");
    }

    function pause() {
        steps = undefined;
        clearTimeout(play_timer);
        publish("playing");
    }

    function ip() {
        const cc = core.u_current_continuation();
        if (cc !== undefined) {
            return core.u_read_quad(cc.ip);
        }
    }

    function run() {
        if (steps === undefined || signal === busy) {
            return;  // paused or already running
        }
        while (true) {

// Pause if we have reached the step limit.

            if (steps <= 0) {
                pause();
                return publish_state();
            }

// Run the core. It is possible that 'h_run_loop' will call 'wakeup'
// causing 'run' to be reentered, so we guard against that with a special
// signal value.

            device_txn = undefined;
            signal = busy;
            signal = core.h_run_loop(
                (
                    debug                   // monitor for VM_DEBUG
                    || step_size === "txn"  // monitor for VM_END
                    || interval > 0         // artificial delay
                )
                ? 1
                : 0
            );

// Pause if we have hit a breakpoint.

            if (debug && ip()?.x === ufork.VM_DEBUG) {
                pause();
                return publish_state();
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

// Have we completed a step?

            if (
                step_size === "instr"
                || ip()?.x === ufork.VM_END
                || device_txn !== undefined
            ) {
                steps -= 1;
                if (interval > 0 && steps > 0) {
                    play_timer = setTimeout(run, interval);
                    return publish_state();
                }
            }
        }
    }

    function wakeup(sender, events) {
        if (steps !== undefined) {

// It is possible that 'wakeup' was called by 'u_defer' within 'h_run_loop',
// so defer the call to a future turn to avoid reentry.

            setTimeout(run);
        } else {
            publish_state();
        }
        device_txn = {
            sender,
            events,
            wake: true
        };
        publish("device_txn");
    }

    function txn(ep, kp_or_fx) {
        const target = core.u_read_quad(ep).x;
        const is_device_or_proxy = (
            core.u_read_quad(ufork.cap_to_ptr(target)).t === ufork.PROXY_T
            || ufork.rawofs(target) < ufork.SPONSOR_OFS
        );
        if (is_device_or_proxy) {
            device_txn = {
                sender: target,
                events: [kp_or_fx],
                wake: false
            };
            publish("device_txn");
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
        step_size(message) {
            step_size = (
                message.value === "txn"
                ? "txn"
                : "instr"
            );
            publish("step_size");
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

    return Object.freeze({command, dispose, txn, wakeup});
}

function demo(log) {
    let driver;
    const core = ufork.make_core({
        wasm_url,
        on_wakeup(...args) {
            driver.wakeup(...args);
        },
        on_txn(...args) {
            driver.txn(...args);
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
            if (message.kind === "device_txn" && message.wake) {
                driver.command({kind: "play"});  // continue
            }
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
            driver.command({kind: "subscribe", topic: "signal", throttle: 50});
            driver.command({kind: "subscribe", topic: "device_txn"});
            driver.command({kind: "subscribe", topic: "rom"});
            driver.command({kind: "subscribe", topic: "ram", throttle: 1000});
            // driver.command({kind: "subscribe", topic: "rom"});
            // driver.command({kind: "auto_refill", enabled: false});
            driver.command({kind: "refill", resources: {cycles: 3}});
            // driver.command({kind: "interval", milliseconds: 250});
            // driver.command({kind: "step_size", value: "txn"});
            driver.command({kind: "play", steps: 30});
            return true;
        })
    ])(log);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(make_driver);
