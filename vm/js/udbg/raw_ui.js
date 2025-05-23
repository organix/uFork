// An explorable representation of any 32-bit raw value. A raw is a tagged
// 32-bit unsigned integer representing a uFork value, as described in vm.md.

/*jslint browser, global */

import assemble from "https://ufork.org/lib/assemble.js";
import scheme from "https://ufork.org/lib/scheme.js";
import dom from "https://ufork.org/lib/dom.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import theme from "https://ufork.org/lib/theme.js";
import ufork from "../ufork.js";
import make_core from "../core.js";
import blob_dev from "../blob_dev.js";
import host_dev from "../host_dev.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");

const word_size = 32; // bits
const bytes_per_word = word_size / 8;
const bytes_per_quad = bytes_per_word * 4;

function truncate(string, max_length) {
    return (
        string.length > max_length
        ? string.slice(0, max_length - 1) + "…"
        : string
    );
}

function key_ui(text) {
    return dom(
        "key-ui",
        {
            style: {
                fontFamily: theme.proportional_font_family,
                fontSize: "0.8em",
                color: theme.white
            }
        },
        text
    );
}

function descend(expand, entry_nr) {
    if (Number.isSafeInteger(expand)) {
        return Math.max(0, expand - 1);
    }
    const matching = expand.filter(function (path) {
        return path[0] === entry_nr;
    });
    if (matching.length === 0) {
        return 0;  // closed
    }
    return matching.filter(function (path) {
        return path.length > 1;
    }).map(function (path) {
        return path.slice(1);
    });
}

function test_descend() {
    if (
        descend(0, 0) !== 0
        || descend(1, 0) !== 0
        || descend(2, 0) !== 1
        || descend([], 0) !== 0
        || descend([[1]], 0) !== 0
        || JSON.stringify(descend([[1]], 1)) !== "[]"
        || JSON.stringify(descend([[1], [1, 2, 3]], 1)) !== "[[2,3]]"
    ) {
        throw new Error("FAIL descend");
    }
}

function device_label(ram_ofs) {
    if (ram_ofs === ufork.DEBUG_DEV_OFS) {
        return "debug";
    }
    if (ram_ofs === ufork.CLOCK_DEV_OFS) {
        return "clock";
    }
    if (ram_ofs === ufork.TIMER_DEV_OFS) {
        return "timer";
    }
    if (ram_ofs === ufork.IO_DEV_OFS) {
        return "io";
    }
    if (ram_ofs === ufork.RANDOM_DEV_OFS) {
        return "random";
    }
    if (ram_ofs === ufork.HOST_DEV_OFS) {
        return "host";
    }
}

function raw_ui({

// The raw value.

    value,

// The verbosity of the text:

//      0   Compact. No spaces, commas, or periods.
//      1   Verbose. May contain spaces, commas, or periods.

    depth = 0,

// Expansion:

//      undefined   Not expandable.
//      0           Expandable but not expanded.
//      1           Expanded, but entries not expanded. Same as [].
//      n           All entries expanded to a depth of n.
//      Array       The entries to expand, for example [[2, 3], [2, 4, 1]].

    expand,

// ROM constants are printed as quads, not constants, to this depth.

    rom_constant_depth = 0,

// The remaining parameters describe the state of the core.

    ram,
    rom,
    rom_debugs
}) {
    const element = dom("value-ui", {
        get_text() {
            return element.textContent;
        },
        get_color() {
            return element.style.color;
        },
        style: {
            color: theme.white,
            fontFamily: theme.monospace_font_family,
            whiteSpace: "nowrap",
            contain: "content"
        }
    });
    if (
        !Number.isSafeInteger(value)
        || value < 0
        || value >= 2 ** word_size
    ) {

// Invalid value.

        element.textContent = String(value);
        element.style.color = theme.white;
        element.style.background = theme.red;
        element.title = "Error: invalid raw";
        return element;
    }
    if (
        ufork.is_fix(value)
        || (value <= ufork.FREE_T && rom_constant_depth <= 0)
    ) {

// Constant.

        element.textContent = ufork.print(value);
        const is_bottom = value === ufork.UNDEF_RAW || value === ufork.NIL_RAW;
        element.style.color = (
            is_bottom
            ? theme.silver
            : theme.green
        );
        return element;
    }

// Quad.

    function sub(value, sub_depth, sub_expand) {
        return raw_ui({
            value,
            depth: sub_depth ?? depth - 1,
            expand: sub_expand,
            rom_constant_depth: Math.max(0, rom_constant_depth - 1),
            ram,
            rom,
            rom_debugs
        });
    }

    function read_quad(ptr_or_cap) {
        return ufork.read_quad(
            (
                ufork.is_rom(ptr_or_cap)
                ? rom
                : ram
            ),
            ufork.rawofs(ptr_or_cap)
        );
    }

    function pair_entries(quad, limit = Infinity) {
        let entries = [];
        let tail = quad.y;
        while (quad?.t === ufork.PAIR_T) {
            const head = quad.x;
            const head_n = String(entries.length + 1);
            entries.push([head_n, head]);
            tail = quad.y;
            if (!ufork.in_mem(tail) || entries.length >= limit - 1) {
                break;
            }
            quad = read_quad(tail);
        }
        const tail_n = String(-entries.length);
        entries.push([tail_n, tail]);
        return entries;
    }

    function dict_entries(quad) {
        let entries = [];
        while (quad?.t === ufork.DICT_T) {
            entries.push([quad.x, quad.y]);
            if (!ufork.in_mem(quad.z)) {
                break;
            }
            quad = read_quad(quad.z);
        }
        return entries;
    }

    const debug = rom_debugs[value];
    const quad = read_quad(value);
    if (quad === undefined) {
        element.textContent = ufork.print(value);
        element.style.color = theme.white;
        element.style.background = theme.red;
        element.title = "Error: out of bounds";
        return element;
    }
    element.title = "Address: " + ufork.print(value) + (
        debug?.src !== undefined
        ? "\nModule: " + debug.src
        : ""
    );
    const ofs = ufork.rawofs(value);
    const {t, x, y, z} = quad;
    if (typeof debug?.label === "string" && depth > 0) {

        element.append(
            dom("span", {style: {color: theme.yellow}}, debug.label),
            " "
        );
    }
    if (typeof debug?.label === "string" && depth <= 0) {

// Labelled quad.

        element.append(truncate(debug.label, 9));
        if (element.textContent !== debug.label) {
            element.title += "\nLabel: " + debug.label;
        }
        element.style.color = theme.yellow;
    } else if (
        ufork.is_cap(value)
        && (t === ufork.ACTOR_T || t === ufork.PROXY_T)
    ) {

// Capability.

        const is_device = ofs < ufork.SPONSOR_OFS;
        element.append("@");
        const proxy_dev = (
            t === ufork.PROXY_T
            ? device_label(ufork.rawofs(x))
            : undefined
        );
        if (is_device) {
            element.append(
                device_label(ofs)
                ?? ufork.fix_to_i32(x).toString(16)
            );
        } else {
            element.append(ofs.toString(16));
            if (depth > 0) {
                element.append(":", proxy_dev ?? sub(x), ".", sub(y));
            } else if (
                t === ufork.ACTOR_T
                && typeof rom_debugs[x]?.label === "string"
            ) {
                element.append(":", sub(x, 0));
            } else if (proxy_dev !== undefined) {
                element.append(":", proxy_dev);
            }
        }
        element.style.color = (
            is_device
            ? theme.purple
            : (
                t === ufork.PROXY_T
                ? theme.orange
                : theme.yellow
            )
        );
        element.title += "\nKind: " + (
            is_device
            ? "device"
            : (
                t === ufork.PROXY_T
                ? "proxy"
                : "actor"
            )
        ) + " capability";
    } else if (t === ufork.INSTR_T) {

// Instruction.

        const parts = ufork.instr_parts(quad);
        element.append("<", parts?.op ?? sub(x));
        if (depth > 0 && x !== ufork.VM_JUMP) {
            element.append(" ");
            if (x === ufork.VM_IF) {
                element.append(
                    key_ui("t: "),
                    sub(y),
                    " ",
                    key_ui("f: "),
                    sub(z)
                );
            } else {
                if (parts?.imm !== undefined) {
                    element.append(parts.imm);
                } else if (x !== ufork.VM_DEBUG) {
                    element.append(sub(y));
                }
                if (x !== ufork.VM_END) {
                    element.append(" ", key_ui("k: "), sub(z));
                }
            }
        }
        element.append(">");
        element.style.color = theme.blue;
        element.title += "\nKind: instruction";
    } else if (t === ufork.PAIR_T && depth > 0) {

// Pair.

        pair_entries(quad, 30).forEach(function ([_, value], entry_nr) {
            if (entry_nr > 0) {
                element.append(",");
            }
            element.append(sub(value));
        });
        element.title += "\nKind: pair";
    } else if (t === ufork.DICT_T && depth > 0) {

// Dict.

        element.append("{");
        dict_entries(quad).forEach(function ([key, value], entry_nr) {
            if (entry_nr > 0) {
                element.append(" ");
            }
            element.append(sub(key), ":", sub(value));
        });
        element.append("}");
        element.title += "\nKind: dictionary";
    } else if (ufork.is_ram(t) && ufork.is_cap(x)) {

// Event.

        element.append(sub(y));
        element.append(
            depth > 0
            ? " -> "
            : "->"
        );
        element.append(sub(x));
        element.title += "\nKind: event";
    } else if (ufork.is_fix(t)) {

// Sponsor.

        if (depth > 0) {
            element.append(
                "[",
                key_ui("mem: "),
                sub(t),
                key_ui(" evt: "),
                sub(x),
                key_ui(" cyc: "),
                sub(y),
                key_ui(" sig: "),
                sub(z),
                "]"
            );
        } else {
            element.append("[", ufork.print(t), "]");
        }
        element.title += "\nKind: sponsor";
    } else {

// Generic quad.

        element.append("[");
        if (depth > 0) {
            element.append(sub(t), " ", sub(x), " ", sub(y), " ", sub(z));
        } else if (typeof rom_debugs[t]?.label === "string") {
            element.append(sub(t)); // symbol_t, etc
        } else {
            element.append(ufork.print(t));
        }
        element.append(["]"]);
        element.title += "\nKind: quad";
    }

    function cells(entries) {
        return entries.map(function ([key, value], entry_nr) {
            return [
                dom(
                    "dt",
                    {style: {display: "flex", justifyContent: "flex-end"}},
                    (
                        typeof key === "string"
                        ? key_ui(key + ":")
                        : [sub(key, undefined, 0), ":"]
                    )
                ),
                dom(
                    "dd",
                    {
                        style: {
                            margin: "0",
                            textOverflow: "ellipsis",
                            overflowX: "hidden"
                        }
                    },
                    sub(
                        value,
                        Math.max(1, depth),
                        descend(expand, entry_nr)
                    )
                )
            ];
        }).flat();
    }

    function entrify() {
        if (t === ufork.DICT_T) {
            return dict_entries(quad);
        }
        if (t === ufork.PAIR_T) {
            return pair_entries(quad, 100);
        }
        return Object.entries(
            value === ufork.ramptr(ufork.MEMORY_OFS)
            ? {"top addr": t, "next free": x, "free count": y, "GC root": z}
            : (
                value === ufork.ramptr(ufork.DDEQUE_OFS)
                ? {"e head": t, "e tail": x, "k head": y, "k tail": z}
                : (
                    ufork.is_cap(value)
                    ? (
                        t === ufork.PROXY_T
                        ? {type: t, device: x, tag: y}
                        : {type: t, beh: x, state: y, effect: z}
                    )
                    : (
                        t === ufork.STUB_T
                        ? {type: t, device: x, target: y, next: z}
                        : (
                            (ufork.is_ram(t) && ufork.is_cap(x))
                            ? {sponsor: t, target: x, message: y, next: z}
                            : (
                                ufork.is_fix(t)
                                ? {memory: t, events: x, cycles: y, signal: z}
                                : (
                                    (
                                        t === ufork.ACTOR_T
                                        && !ufork.is_cap(value)
                                    )
                                    ? {"new beh": x, "new state": y, events: z}
                                    : (
                                        (
                                            ufork.in_mem(t)
                                            && read_quad(t)?.t === ufork.INSTR_T
                                        )
                                        ? {ip: t, sp: x, ep: y, next: z}
                                        : quad
                                    )
                                )
                            )
                        )
                    )
                )
            )
        );
    }

    if (expand !== undefined) {
        const summary = dom(
            "summary",
            {style: {overflowX: "hidden", textOverflow: "ellipsis"}},
            [element]
        );
        const dl = dom("dl", {
            title: "Alt+click for t, x, y, z",
            onclick(event) {
                if (event.altKey) {
                    dl.innerHTML = "";
                    dl.append(...cells(Object.entries(quad)));
                    event.stopPropagation();
                }
            },
            style: {
                margin: "0",
                display: "grid",
                gridTemplateColumns: "max-content 1fr",
                gap: "0.2em 0.4em"
            }
        });
        const open = Array.isArray(expand) || expand > 0;
        const details = dom(
            "details",
            {
                open,
                ontoggle() {
                    if (details.open) {
                        if (dl.children.length === 0) {
                            dl.append(...cells(entrify()));
                        }
                    } else {
                        dl.innerHTML = "";
                    }
                },
                style: {
                    whiteSpace: "nowrap",  // forbid linebreak after triangle
                    color: theme.white  // triangle color
                }
            },
            [summary, dl]
        );
        if (open) {
            dl.append(...cells(entrify()));
        }
        return details;
    }
    return element;
}

function tabulate(caption, rows) {
    const header = dom("tr", [
        dom("th", "Printed"),
        dom("th", "Shallow"),
        dom("th", "Deep")
    ]);
    return dom("table", {border: 1, cellPadding: 4}, [
        dom("caption", caption),
        header,
        ...rows.map(function ([printed, shallow, deep]) {
            return dom("tr", [
                dom("td", [printed]),
                dom("td", [shallow]),
                dom("td", {style: {maxWidth: "300px"}}, [deep])
            ]);
        })
    ]);
}

function demo(log) {
    document.documentElement.innerHTML = "";
    const core = make_core({
        wasm_url,
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble, scm: scheme.compile}
    });

    function row(value, expand) {
        const ram = core.h_ram();
        const rom = core.h_rom();
        const rom_debugs = core.u_rom_debugs();
        if (ufork.is_ram(value)) {
            const quad = ufork.read_quad(ram, ufork.rawofs(value));
            if (quad?.t === ufork.ACTOR_T || quad?.t === ufork.PROXY_T) {
                value = ufork.ptr_to_cap(value);
            }
        }
        return [
            ufork.print(value),
            raw_ui({
                value,
                ram,
                rom,
                rom_debugs,
                depth: 0
            }),
            raw_ui({
                value,
                ram,
                rom,
                rom_debugs,
                depth: 1,
                expand,
                rom_constant_depth: 1
            })
        ];
    }

    function print_bank(caption, bytes, bottom_ptr) {
        const nr_quads = Math.floor(bytes.length / bytes_per_quad);
        const rows = new Array(nr_quads).fill().map(function (_, quad_nr) {
            return row(bottom_ptr + quad_nr, (
                quad_nr === 0
                ? [[3, 2, 1], [3, 2, 2]]
                : 0
            ));
        });
        return tabulate(caption, rows);
    }

    parseq.sequence([
        core.h_initialize(),
        core.h_import("https://ufork.org/lib/blob.asm"),
        // core.h_import("https://ufork.org/lib/future.scm"),
        requestorize(function () {
            const make_ddev = host_dev(core);
            blob_dev(core, make_ddev);
            core.h_boot();
            core.h_run_loop(1);
            document.body.append(
                print_bank("RAM", core.h_ram(), ufork.ramptr(0)),
                print_bank("ROM", core.h_rom(), ufork.romptr(0))
            );
            document.body.style.display = "flex";
            document.body.style.alignItems = "flex-start";
            document.body.style.background = "black";
            document.body.style.color = "white";
            return true;
        })
    ])(log);
}

if (import.meta.main) {
    test_descend();
    demo(globalThis.console.log);
}

export default Object.freeze(raw_ui);
