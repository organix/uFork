// A JavaScript wrapper for a uFork WASM core.

// This module exports a 'make_core' constructor function that takes an object
// with the following properties:

//  wasm_url
//      The URL of the uFork WASM binary, as a string. Required.

//  on_log(log_level, ...values)
//      An optional callback that is called with values logged by the core
//      or devices. The 'values' may or may not be strings.

//  on_txn(wake, sender, events)
//      An optional callback that is called at the conclusion of every actor
//      transaction and device pseudo-transaction.

//      The value of 'wake' depends on whether the transaction was completed by
//      an actor or a device, synchronously or asynchronously:

//          wake        | sender            | asynchronous
//          ------------+-------------------+---------------
//          undefined   | actor             | no
//          false       | device or proxy   | no
//          true        | device or proxy   | yes

//      A 'wake' value of true indicates that execution of the core can resume
//      from its idle state.

//      The 'sender' is the capability for the actor, proxy, or device that
//      generated the message 'events', an array of pointers.

//      Beware that actor transactions can be aborted and thus have no effect!

//  on_audit(code, evidence)
//      An optional callback that is called when a non-fatal error (such as an
//      aborted transaction) occurs.

//      The 'code' is an error integer such as E_ABORT.
//      The 'evidence' is a value associated with the error, such as the reason
//      provided to the 'end abort' instruction.

//  log_level
//      An integer controlling the core's logging verbosity. Each level includes
//      all levels before it.

//      ufork.LOG_NONE (0)
//          No logging.
//      ufork.LOG_INFO (1)
//          Low volume, always shown unless all logging is disabled.
//      ufork.LOG_WARN (2)
//          Something went wrong, but perhaps it wasn't fatal.
//      ufork.LOG_DEBUG (3)
//          More detail to narrow down the source of a problem.
//      ufork.LOG_TRACE (4)
//          Extremely detailed (for example, all reserve and release actions).

//      The default level is LOG_WARN.

//  import_map
//      An object that maps prefixes to base URLs, used to resolve imports.
//      For example, the import map

//          {"lib/": "https://ufork.org/lib/"}

//      would resolve "lib/std.asm" to "https://ufork.org/lib/std.asm".

//  compilers
//      An object that maps file extensions to compiler functions.

//      Compilers are used by the 'h_import' method to transform text, fetched
//      over the network, to uFork IR. A compiler has the signature:

//          compile(text, src) -> ir

//      where 'text' is the source text as a string, 'src' is the module's
//      source (usually a URL, optional), and 'ir' is a CRLF object as
//      described in ir.md, unless compilation failed, in which case 'ir'
//      should have a non-empty array as its "errors" property.

//      For example, if both assembly and Scheme modules were to be imported,
//      the compilers object might look like:

//          {
//              asm: compile_assembly,
//              scm: compile_scheme
//          }

// The returned object is an uninitialized core, containing a bunch of methods.
// The methods beginning with "u_" are reentrant, but the methods beginning
// with "h_" are non-reentrant.

// To initialize the core, call the 'h_initialize' method and run the returned
// requestor to completion.

/*jslint web, global, bitwise */

import assemble from "https://ufork.org/lib/assemble.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import unpromise from "https://ufork.org/lib/rq/unpromise.js";
import loader from "./loader.js";
import ufork from "./ufork.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");
const asm_url = import.meta.resolve("../../lib/eq.asm");

const {
    cap_to_ptr,
    current_continuation,
    fault_msg,
    fix_to_i32,
    fixnum,
    in_mem,
    is_cap,
    is_ptr,
    is_ram,
    is_rom,
    print,
    print_quad,
    ptr_to_cap,
    ramptr,
    rawofs,
    read_quad,
    romptr,
    write_quad,
    UNDEF_RAW,
    NIL_RAW,
    ACTOR_T,
    PROXY_T,
    STUB_T,
    INSTR_T,
    PAIR_T,
    DICT_T,
    FREE_T,
    VM_JUMP,
    VM_DUP,
    VM_IF,
    VM_END,
    QUAD_ROM_MAX,
    QUAD_RAM_MAX,
    QUOTA_OFS,
    MEMORY_OFS,
    DEBUG_DEV_OFS,
    SPONSOR_OFS
} = ufork;

function make_core({
    wasm_url,
    on_log,
    on_txn,
    on_audit,
    log_level = ufork.LOG_WARN,
    import_map = {},
    compilers = {}
}) {
    let wasm_exports;
    let boot_caps_dict = []; // empty
    let wasm_caps = Object.create(null);
    let on_dispose_callbacks = [];
    let import_promises = Object.create(null);
    let module_texts = Object.create(null);
    let rom_debugs = Object.create(null);
    let wasm_call_in_progress = false;
    let deferred_queue = [];
    let initial_rom_ofs;
    let initial_ram_ofs;
    let entry_ptr;

// The presence of a particular logging method indicates that its associated log
// level is enabled. Thus calling code can log conditionally, avoiding the
// performance overhead of producing diagnostics that would just be discarded
// anyway.

    function make_log_method(log_level) {
        if (on_log !== undefined) {
            return function (...values) {
                on_log(log_level, ...values);
            };
        }
    }

    const u_info = (
        log_level >= ufork.LOG_INFO
        ? make_log_method(ufork.LOG_INFO)
        : undefined
    );
    const u_warn = (
        log_level >= ufork.LOG_WARN
        ? make_log_method(ufork.LOG_WARN)
        : undefined
    );
    const u_debug = (
        log_level >= ufork.LOG_DEBUG
        ? make_log_method(ufork.LOG_DEBUG)
        : undefined
    );
    const u_trace = (
        log_level >= ufork.LOG_TRACE
        ? make_log_method(ufork.LOG_TRACE)
        : undefined
    );

    function u_audit(code, evidence) {
        if (typeof on_audit === "function") {
            on_audit(code, evidence >>> 0);
        }
    }

    function wrap_wasm_call(get_wasm_function) {
        return function (...args) {

// It is only valid to call 'u_defer' during a non-reentrant call into WASM.
// There is no need to implement a mutex here because Rust's RefCell will panic
// upon illegal reentry.

            wasm_call_in_progress = true;
            let result = get_wasm_function()(...args);
            wasm_call_in_progress = false;

// Some callbacks that make non-reentrant calls may have been scheduled
// by 'u_defer' whilst the WASM component had control. Run them now and flush
// the queue.

            const callbacks = deferred_queue;
            deferred_queue = [];
            callbacks.forEach((callback) => callback());
            if (Number.isSafeInteger(result)) {

// Some of the WASM exports return a fixnum, but fixnums appear to be negative
// because the top bit is set. Discard the sign.

                result = result >>> 0;  // i32 -> u32
            }
            return result;
        };
    }

    //const h_init = wrap_wasm_call(() => wasm_exports.h_init);
    const h_run_loop = wrap_wasm_call(() => wasm_exports.h_run_loop);
    const h_step = wrap_wasm_call(() => wasm_exports.h_step);
    const h_event_enqueue = wrap_wasm_call(() => wasm_exports.h_event_enqueue);
    const h_revert = wrap_wasm_call(() => wasm_exports.h_revert);
    const h_gc_run = wrap_wasm_call(() => wasm_exports.h_gc_run);
    const h_rom_buffer = wrap_wasm_call(() => wasm_exports.h_rom_buffer);
    const h_rom_top = wrap_wasm_call(() => wasm_exports.h_rom_top);
    const h_set_rom_top = wrap_wasm_call(() => wasm_exports.h_set_rom_top);
    const h_reserve_rom = wrap_wasm_call(() => wasm_exports.h_reserve_rom);
    const h_ram_buffer = wrap_wasm_call(() => wasm_exports.h_ram_buffer);
    const h_ram_top = wrap_wasm_call(() => wasm_exports.h_ram_top);
    const h_reserve = wrap_wasm_call(() => wasm_exports.h_reserve);
    const h_reserve_stub = wrap_wasm_call(() => wasm_exports.h_reserve_stub);
    const h_release_stub = wrap_wasm_call(() => wasm_exports.h_release_stub);
    const h_car = wrap_wasm_call(() => wasm_exports.h_car);
    const h_cdr = wrap_wasm_call(() => wasm_exports.h_cdr);
    const h_gc_color = wrap_wasm_call(() => wasm_exports.h_gc_color);
    const h_gc_state = wrap_wasm_call(() => wasm_exports.h_gc_state);

    function u_memory() {

// WARNING! The WASM memory buffer can move if it is resized. We get a fresh
// pointer each time for safety.

        return wasm_exports.memory.buffer;
    }

// WASM mandates little-endian byte ordering.

    function h_rom() {
        const mem_base = u_memory();
        const rom_ofs = h_rom_buffer();
        const rom_len = rawofs(h_rom_top()) << 4;
        return new Uint8Array(mem_base, rom_ofs, rom_len); // not copied
    }

    function h_ram() {
        const mem_base = u_memory();
        const ram_ofs = h_ram_buffer();
        const ram_len = rawofs(h_ram_top()) << 4;
        return new Uint8Array(mem_base, ram_ofs, ram_len); // not copied
    }

// We avoid unnecessary reentrancy by caching the offsets at initialization
// time. Even if the WASM memory is rearranged, offsets should not change. We
// can not, however, avoid reentrancy if we wish to check the current top of
// ROM or RAM.

    function u_rom_ofs() {
        return initial_rom_ofs;
    }

    function u_ram_ofs() {
        return initial_ram_ofs;
    }

    function u_rom() {
        const mem_base = u_memory();
        const rom_ofs = u_rom_ofs();
        const rom_len = QUAD_ROM_MAX << 4;
        return new Uint8Array(mem_base, rom_ofs, rom_len); // not copied
    }

    function u_ram() {
        const mem_base = u_memory();
        const ram_ofs = u_ram_ofs();
        const ram_len = QUAD_RAM_MAX << 4;
        return new Uint8Array(mem_base, ram_ofs, ram_len); // not copied
    }

    function u_rom_debugs() {
        return Object.assign(Object.create(null), rom_debugs);
    }

    function u_module_texts() {
        return Object.assign(Object.create(null), module_texts);
    }

    function u_cap_to_ptr(cap) {
        const ptr = cap_to_ptr(cap);
        if (ptr === UNDEF_RAW) {
            if (u_warn !== undefined) {
                u_warn("cap_to_ptr: must be mutable", print(cap));
            }
            return UNDEF_RAW;
        }
        return ptr;
    }

    function u_ptr_to_cap(ptr) {
        const cap = ptr_to_cap(ptr);
        if (cap === UNDEF_RAW) {
            if (u_warn !== undefined) {
                u_warn("ptr_to_cap: must be mutable", print(ptr));
            }
            return UNDEF_RAW;
        }
        return cap;
    }

    function u_mem_pages() {
        return u_memory().byteLength / 65536;
    }

    function u_read_quad(ptr) {
        if (is_ram(ptr)) {
            const ram_ofs = rawofs(ptr);
            if (ram_ofs < QUAD_RAM_MAX) {
                return read_quad(u_ram(), ram_ofs);
            }
            if (u_warn !== undefined) {
                u_warn("u_read_quad: RAM ptr out of bounds", print(ptr));
            }
        } else if (is_rom(ptr)) {
            const rom_ofs = rawofs(ptr);
            if (rom_ofs < QUAD_ROM_MAX) {
                return read_quad(u_rom(), rom_ofs);
            }
            if (u_warn !== undefined) {
                u_warn("u_read_quad: ROM ptr out of bounds", print(ptr));
            }
        } else if (u_warn !== undefined) {
            u_warn("u_read_quad: required ptr, got", print(ptr));
        }
    }

    function u_write_quad(ptr, quad) {
        if (is_ram(ptr)) {
            const ram_ofs = rawofs(ptr);
            if (ram_ofs < QUAD_RAM_MAX) {
                write_quad(u_ram(), ram_ofs, quad);
            } else if (u_warn !== undefined) {
                u_warn("u_write_quad: RAM ptr out of bounds", print(ptr));
            }
        } else if (is_rom(ptr)) {
            const rom_ofs = rawofs(ptr);
            if (rom_ofs < QUAD_ROM_MAX) {
                write_quad(u_rom(), rom_ofs, quad);
            } else if (u_warn !== undefined) {
                u_warn("u_write_quad: ROM ptr out of bounds", print(ptr));
            }
        } else if (u_warn !== undefined) {
            u_warn("u_write_quad: required ptr, got", print(ptr));
        }
    }

    function u_current_continuation() {
        return current_continuation(u_ram());
    }

    function u_nth(list_ptr, n) {

// Safely extract the 'nth' item from a list of pairs.

//           0          -1          -2          -3
//      lst -->[car,cdr]-->[car,cdr]-->[car,cdr]-->...
//            +1 |        +2 |        +3 |
//               V           V           V

        if (n === 0) {
            return list_ptr;
        }
        if (!is_ptr(list_ptr)) {
            return UNDEF_RAW;
        }
        const pair = u_read_quad(list_ptr);
        if (pair.t !== PAIR_T) {
            return UNDEF_RAW;
        }
        if (n === 1) {
            return pair.x;
        }
        return (
            n < 0
            ? u_nth(pair.y, n + 1)
            : u_nth(pair.y, n - 1)
        );
    }

    function u_next(ptr) {
        if (is_ptr(ptr)) {
            const quad = u_read_quad(ptr);
            const t = quad.t;
            if (t === INSTR_T) {
                const op = quad.x;
                if ((op !== VM_IF) && (op !== VM_JUMP) && (op !== VM_END)) {
                    return quad.z;
                }
            } else if (t === PAIR_T) {
                return quad.y;
            } else {
                return quad.z;
            }
        }
        return UNDEF_RAW;
    }

    function u_flatten(ptr) {

// Traverse a linked list of quads, returning an array of pointers.

        let ptrs = [];
        while (is_ptr(ptr) && rawofs(ptr) > FREE_T) {
            ptrs.push(ptr);
            ptr = u_next(ptr);
        }
        return ptrs;
    }

    function u_defer(callback) {

// Schedule a callback to be run at the conclusion of the currently running
// non-reentrant method, for example 'h_run_loop'. The callback can safely call
// the core's non-reentrant methods.

        if (!wasm_call_in_progress) {
            throw new Error("u_defer called outside of WASM control.");
        }
        deferred_queue.push(callback);
    }

    function h_reserve_ram(quad = {}) {
        const ptr = h_reserve();
        u_write_quad(ptr, quad);
        return ptr;
    }

    function h_load(ir, imports) {
        return loader.load({
            ir,
            imports,
            alloc_quad(debug_info) {
                const ptr = h_reserve_rom();
                rom_debugs[ptr] = debug_info;
                return ptr;
            },
            read_quad: u_read_quad,
            write_quad: u_write_quad
        });
    }

    function h_import(src, content) {
        return parseq.sequence([
            loader.import({
                src,
                content,
                import_map,
                import_promises,
                compilers,
                load: h_load,
                on_trace: u_trace,
                on_fetch_text(src, text) {
                    module_texts[src] = text;
                }
            }),
            requestorize(function (module) {

// If the module exports a boot behavior, make that the entrypoint.

                if (module.boot !== undefined) {
                    u_write_quad(entry_ptr, {
                        t: INSTR_T,
                        x: VM_DUP,
                        y: fixnum(0),
                        z: module.boot
                    });
                }
                return module;
            })
        ]);
    }

    function u_disasm(raw) {
        let s = print(raw);
        if (is_cap(raw)) {
            raw = u_cap_to_ptr(raw);
        }
        if (is_ptr(raw)) {
            s += ": ";
            const quad = u_read_quad(raw);
            s += print_quad(quad);
        }
        return s;
    }

    function u_pprint(raw) {
        let s = "";
        if (is_ptr(raw)) {
            let quad = u_read_quad(raw);
            let sep;
            if (quad.t === PAIR_T) {
                let p = raw;
                sep = ",";
                while (quad.t === PAIR_T) {
                    const car = u_pprint(quad.x);
                    s += (
                        car.includes(sep)
                        ? "(" + car + ")"
                        : car
                    );
                    s += sep;
                    p = quad.y;  // cdr
                    if (!is_ptr(p)) {
                        break;
                    }
                    quad = u_read_quad(p);
                }
                s += u_pprint(p);
                return s;
            }
            if (quad.t === DICT_T) {
                sep = "{";
                while (quad.t === DICT_T) {
                    s += sep;
                    s += u_pprint(quad.x);  // key
                    s += ":";
                    s += u_pprint(quad.y);  // value
                    sep = ", ";
                    quad = u_read_quad(quad.z);  // next
                }
                s += "}";
                return s;
            }
            if (quad.t === STUB_T) {
                s += "STUB[";
                s += print(quad.x);  // device
                s += ",";
                s += print(quad.y);  // target
                s += "]";
                return s;
            }
        }
        if (is_cap(raw)) {
            const ptr = u_cap_to_ptr(raw);
            const cap_quad = u_read_quad(ptr);
            if (cap_quad.t === PROXY_T) {
                s += "PROXY[";
                s += print(cap_quad.x);  // device
                s += ",";
                s += print(cap_quad.y);  // handle
                s += "]";
                return s;
            }
        }
        return print(raw);
    }

    function h_boot(instr_ptr = entry_ptr, state_ptr = UNDEF_RAW) {
        if (!is_ptr(instr_ptr)) {
            throw new Error("Not an instruction: " + u_pprint(instr_ptr));
        }

// Make a boot actor, to be sent the boot message.

        const actor = h_reserve_ram({
            t: ACTOR_T,
            x: instr_ptr,
            y: state_ptr,
            z: UNDEF_RAW
        });

// Inject the boot event (with a message holding the capabilities) to the front
// of the event queue.

        const evt = h_reserve_ram({
            t: ramptr(SPONSOR_OFS),
            x: u_ptr_to_cap(actor),
            y: boot_caps_dict.reduce(function (dict, [key_raw, value_raw]) {
                return h_reserve_ram({
                    t: DICT_T,
                    x: key_raw,
                    y: value_raw,
                    z: dict
                });
            }, NIL_RAW)
        });
        h_event_enqueue(evt);
    }

// FIXME: need a general strategy for saving and restoring device state

    function h_snapshot() {
        return {
            rom: h_rom().slice(),
            ram: h_ram().slice()
        };
    }

    function h_restore(snapshot) {
        const mem_base = u_memory();

        const rom_ofs = u_rom_ofs();
        const rom_len = snapshot.rom.byteLength;
        const rom = new Uint8Array(mem_base, rom_ofs, rom_len);
        rom.set(snapshot.rom);

        const ram_ofs = ramptr(MEMORY_OFS);
        const ram_len = snapshot.ram.byteLength;
        const ram = new Uint8Array(mem_base, ram_ofs, ram_len);
        ram.set(snapshot.ram);

        const rom_top = romptr(rom_len >> 2);
        h_set_rom_top(rom_top);  // register new top-of-ROM
    }

    function h_install(boot_key, boot_value, on_dispose, wasm_imports) {

// Install a device. This usually involves extending the boot capabilities
// dictionary, handling disposal, and providing capability functions to the
// WASM instance.

// If provided, the 'boot_key' and 'boot_value' are added to the "caps"
// dictionary provided to boot actors (created via the 'h_boot' method). Each
// entry is an array containing two values like [key, value]. Both the key and
// the value can be any raw value.

// The 'on_dispose' callback is called when the core is disposed.

// The 'wasm_imports' parameter is an object with functions to provide to the
// WASM instance. The names of these functions are hard coded into the built
// WASM, e.g. "host_clock".

        if (boot_key !== undefined && boot_value !== undefined) {
            boot_caps_dict.push([boot_key, boot_value]);
        }
        if (typeof on_dispose === "function") {
            on_dispose_callbacks.push(on_dispose);
        }
        Object.assign(wasm_caps, wasm_imports);
    }

    function h_dispose() {

// Dispose of the core by disposing of any installed devices.

        const callbacks = on_dispose_callbacks;
        on_dispose_callbacks = [];
        callbacks.forEach((on_dispose) => on_dispose());
    }

    function h_wakeup(sender, events) {
        events.map(h_event_enqueue);
        if (on_txn !== undefined) {
            on_txn(true, sender, events);
        }
    }

    function h_refill({memory, events, cycles}) {
        const quota_ptr = ramptr(QUOTA_OFS);
        const quota = u_read_quad(quota_ptr);
        if (Number.isSafeInteger(memory)) {
            quota.t = fixnum(memory);
        }
        if (Number.isSafeInteger(events)) {
            quota.x = fixnum(events);
        }
        if (Number.isSafeInteger(cycles)) {
            quota.y = fixnum(cycles);
        }
        u_write_quad(quota_ptr, quota);
    }

    function h_initialize() {

// Initializes the core. This requestor should be run exactly once before the
// core is asked to do any work.

        return parseq.sequence([
            unpromise(function () {
                return WebAssembly.instantiateStreaming(fetch(wasm_url), {
                    capabilities: {
                        host_clock(...args) {
                            return wasm_caps.host_clock(...args);
                        },
                        host_random(...args) {
                            return wasm_caps.host_random(...args);
                        },
                        host_print(...args) {
                            return wasm_caps.host_print(...args);
                        },
                        host_log(...args) {
                            return wasm_caps.host_log(...args);
                        },
                        host_start_timer(...args) {
                            return wasm_caps.host_start_timer(...args);
                        },
                        host_stop_timer(...args) {
                            return wasm_caps.host_stop_timer(...args);
                        },
                        host_read(...args) {
                            return wasm_caps.host_read(...args);
                        },
                        host_write(...args) {
                            return wasm_caps.host_write(...args);
                        },
                        host_txn(...args) {
                            return wasm_caps.host_txn(...args);
                        },
                        host_audit(...args) {
                            return wasm_caps.host_audit(...args);
                        },
                        host(...args) {
                            return wasm_caps.host(...args);
                        }
                    }
                });
            }),
            requestorize(function (wasm) {
                wasm_exports = wasm.instance.exports;
                wasm.instance.exports.h_init();  // initialize WASM memory
                initial_rom_ofs = wasm.instance.exports.h_rom_buffer();
                initial_ram_ofs = wasm.instance.exports.h_ram_buffer();

// Install an anonymous plugin to handle transaction and audit information.

                Object.assign(wasm_caps, {
                    host_txn(ep, kp_or_fx) {
                        if (typeof on_txn === "function") {
                            const event = u_read_quad(ep);
                            const sender = event.x;
                            const maybe_fx = u_read_quad(kp_or_fx);
                            if (is_cap(maybe_fx.x)) {
                                const events = [kp_or_fx];  // sync dev txn
                                on_txn(false, sender, events);
                            } else {
                                const busy_actor = u_read_quad(
                                    ufork.cap_to_ptr(sender)
                                );
                                const effect = u_read_quad(busy_actor.z);
                                const events = u_flatten(effect.z);
                                on_txn(undefined, sender, events);  // actor txn
                            }
                        }
                    },
                    host_audit: u_audit
                });

// Install the debug device, regardless of whether debug logging is enabled.

                const dev_ptr = ramptr(DEBUG_DEV_OFS);
                const dev_cap = u_ptr_to_cap(dev_ptr);
                const dev_id = u_read_quad(dev_ptr).x;
                boot_caps_dict.push([dev_id, dev_cap]);
                Object.assign(wasm_caps, {
                    host_log(x) { // (i32) -> nil
                        if (u_debug !== undefined) {
                            const u = (x >>> 0);  // convert i32 -> u32
                            //u_debug(print(u), "->", u_pprint(u));
                            let s = print(u);
                            if (in_mem(u)) {
                                s += ": " + u_pprint(u);
                            }
                            u_debug(s);
                        }
                    }
                });

// The first quad of non-reserved ROM is the default entry point. Unless
// overwritten during load, it will trigger an E_NOT_EXE fault.

                entry_ptr = h_reserve_rom();
                return true;
            })
        ]);
    }

    return Object.freeze({

// The non-reentrant methods.

        h_boot,
        h_car,
        h_cdr,
        h_dispose,
        h_gc_color,
        h_gc_run,
        h_gc_state,
        h_import,
        h_initialize,
        h_install,
        h_load,
        h_ram,
        h_ram_top,
        h_refill,
        h_release_stub,
        h_reserve_ram,
        h_reserve_rom,
        h_reserve_stub,
        h_restore,
        h_revert,
        h_rom,
        h_rom_top,
        h_run_loop,
        h_set_rom_top,
        h_snapshot,
        h_step,
        h_wakeup,

// The reentrant methods.

        u_audit,
        u_current_continuation,
        u_debug,
        u_defer,
        u_disasm,
        u_info,
        u_mem_pages,
        u_memory,
        u_module_texts,
        u_next,
        u_nth,
        u_pprint,
        u_ram,
        u_ram_ofs,
        u_read_quad,
        u_rom,
        u_rom_debugs,
        u_rom_ofs,
        u_trace,
        u_warn,
        u_write_quad
    });
}

const abort_src = `
boot:                       ; _ <- {caps}
    push 123                ; reason
    end abort               ; --

.export
    boot
`;

function demo(log) {
    let core;

    function run_ufork() {
        const status = core.h_run_loop(0);
        log("IDLE:", fault_msg(fix_to_i32(status)));
    }

    core = make_core({
        wasm_url,
        log_level: ufork.LOG_DEBUG,
        on_log: log,
        on_audit(code, evidence) {
            log("AUDIT:", fault_msg(code), print(evidence));
        },
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble}
    });
    parseq.sequence([
        core.h_initialize(),
        parseq.parallel([
            core.h_import(asm_url),
            core.h_import("abort.asm", abort_src)
        ]),
        requestorize(function ([test_module, audit_module]) {
            const start = performance.now();
            core.h_boot(test_module.boot);
            core.h_refill({cycles: 100});
            run_ufork(); // sponsor cycle limit reached
            core.h_refill({cycles: 4096});
            run_ufork(); // #t
            core.h_boot(audit_module.boot);
            run_ufork(); // actor transaction aborted
            const duration = performance.now() - start;
            return duration.toFixed(3) + "ms";
        })
    ])(log);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(make_core);
