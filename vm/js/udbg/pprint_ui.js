// An interactive, explorable representation of any uFork value.

/*jslint browser, global */

import assemble from "https://ufork.org/lib/assemble.js";
import scheme from "https://ufork.org/lib/scheme.js";
import dom from "https://ufork.org/lib/dom.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import blob_dev from "../blob_dev.js";
import host_dev from "../host_dev.js";
import ufork from "../ufork.js";
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

function key_ui(text, color = "inherit") {
    return dom(
        "key-ui",
        {
            style: {
                fontFamily: "system-ui",
                fontSize: "0.8em",
                color
            }
        },
        text
    );
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

function pprint_ui({
    value,
    depth = 0,
    expand = -1,
    theme = {
        red: "red",
        orange: "orange",
        silver: "silver",
        white: "white",
        black: "black",
        blue: "lightskyblue",
        green: "limegreen",
        purple: "violet",
        yellow: "gold"
    },
    ram,
    rom,
    rom_debugs
}) {
    const element = dom("value-ui", {
        style: {fontFamily: "monospace", whiteSpace: "nowrap"}
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
        element.title = "Invalid value.";
        return element;
    }
    if (ufork.is_fix(value) || value <= ufork.FREE_T) {

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
        return pprint_ui({
            value,
            depth: sub_depth ?? depth - 1,
            expand: sub_expand,
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

    const debug = rom_debugs[value];
    const quad = read_quad(value);
    if (quad === undefined) {
        element.textContent = ufork.print(value);
        element.style.color = theme.white;
        element.style.background = theme.red;
        element.title = "Out of bounds.";
        return element;
    }
    element.title = ufork.print(value) + (
        debug?.src !== undefined
        ? "\nsrc: " + debug.src
        : ""
    );
    const ofs = ufork.rawofs(value);
    const {t, x, y, z} = quad;
    if (typeof debug?.label === "string") {

// Label. Truncate if too long.

        const short = truncate(debug.label, 9);
        element.textContent = (
            depth > 0
            ? debug.label
            : short
        );
        if (element.textContent !== debug.label) {
            element.title += "\nlabel: " + debug.label;
        }
        element.style.color = theme.yellow;
    } else {
        if (
            ufork.is_cap(value)
            && (t === ufork.ACTOR_T || t === ufork.PROXY_T)
        ) {
            const is_device = ofs < ufork.SPONSOR_OFS;
            element.append("@");
            const proxy_dev = (
                t === ufork.PROXY_T
                ? device_label(ufork.rawofs(x))
                : undefined
            );
            if (is_device) {
                element.append(device_label(ofs) ?? ufork.fix_to_i32(x));
            } else if (depth > 0) {
                element.append(proxy_dev ?? sub(x), ".", sub(y));
            } else if (
                t === ufork.ACTOR_T
                && typeof rom_debugs[x]?.label === "string"
            ) {
                element.append(sub(x, 0));
            } else if (proxy_dev !== undefined) {
                element.append(proxy_dev);
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
        } else if (t === ufork.INSTR_T) {
            const parts = ufork.instr_parts(quad);
            element.append("<", parts?.op ?? sub(x));
            if (depth > 0 && x !== ufork.VM_JUMP) {
                element.append(" ");
                if (x === ufork.VM_IF) {
                    element.append(
                        key_ui("t: ", theme.white),
                        sub(y),
                        " ",
                        key_ui("f: ", theme.white),
                        sub(z)
                    );
                } else {
                    if (parts?.imm !== undefined) {
                        element.append(parts.imm);
                    } else if (x !== ufork.VM_DEBUG) {
                        element.append(sub(y));
                    }
                    if (x !== ufork.VM_END) {
                        element.append(
                            " ",
                            key_ui("k: ", theme.white),
                            sub(z)
                        );
                    }
                }
            }
            element.append(">");
            element.style.color = theme.blue;
        } else if (t === ufork.PAIR_T && depth > 0) {
            element.append(sub(x), ",", sub(y, depth));
        } else if (t === ufork.DICT_T && depth > 0) {
            element.append("{");
            let dict = quad;
            while (dict !== undefined) {
                element.append(sub(dict.x), ":", sub(dict.y));
                if (!ufork.in_mem(dict.z)) {
                    break;
                }
                dict = read_quad(dict.z);
                element.append(" ");
            }
            element.append("}");
        } else {
            element.append("[");
            if (depth > 0) {
                element.append(sub(t), " ", sub(x), " ", sub(y), " ", sub(z));
            } else if (typeof rom_debugs[t]?.label === "string") {
                element.append(sub(t)); // symbol_t, etc
            } else {
                element.append(ufork.print(t));
            }
            element.append(["]"]);
        }
    }

    function cells(entries) {
        return entries.map(function ([key, value]) {
            return [
                dom("dt", {style: {textAlign: "right"}}, (
                    typeof key === "string"
                    ? key_ui(key + ":")
                    : [sub(key), ":"]
                )),
                dom("dd", {
                    style: {
                        margin: "0",
                        textOverflow: "ellipsis",
                        overflowX: "hidden"
                    }
                }, [
                    sub(value, Math.max(1, depth), Math.max(0, expand - 1))
                ])
            ];
        }).flat();
    }

    if (expand >= 0) {
        const summary = dom(
            "summary",
            {style: {overflowX: "hidden", textOverflow: "ellipsis"}},
            [element]
        );
        const dl = dom("dl", {
            style: {
                margin: "0",
                display: "grid",
                gridTemplateColumns: "max-content 1fr",
                gap: "0.2em 0.4em"
            }
        });
        const details = dom(
            "details",
            {
                open: expand > 0,
                ontoggle() {
                    if (!details.open) {
                        dl.innerHTML = ""; // clear
                        return;
                    }
                    dl.append(...cells(Object.entries(
                        ufork.is_cap(value)
                        ? (
                            t === ufork.PROXY_T
                            ? {type: t, device: x, tag: y}
                            : {type: t, code: x, data: y, effect: z}
                        )
                        : (
                            t === ufork.STUB_T
                            ? {type: t, device: x, target: y}
                            : quad
                        )
                    )));
                },
                style: {whiteSpace: "nowrap"} // forbid linebreak after triangle
            },
            [summary, dl]
        );
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
    const core = ufork.make_core({
        wasm_url,
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble, scm: scheme.compile}
    });

    function cells(value) {
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
            pprint_ui({
                value,
                ram,
                rom,
                rom_debugs,
                depth: 0
            }),
            pprint_ui({
                value,
                ram,
                rom,
                rom_debugs,
                depth: 1,
                expand: 0
            })
        ];
    }

    function print_bank(caption, bytes, bottom_ptr) {
        const nr_quads = Math.floor(bytes.length / bytes_per_quad);
        const rows = new Array(nr_quads).fill().map(function (_, quad_nr) {
            return cells(bottom_ptr + quad_nr);
        });
        return tabulate(caption, rows);
    }

    parseq.sequence([
        core.h_initialize(),
        core.h_import("https://ufork.org/lib/blob.asm"),
        // core.h_import("https://ufork.org/lib/future.scm"),
        requestorize(function (module) {
            const make_ddev = host_dev(core);
            blob_dev(core, make_ddev);
            core.h_boot(module.boot);
            core.h_run_loop(1);
            document.body.append(
                print_bank("RAM", core.h_ram(), ufork.ramptr(0)),
                print_bank("ROM", core.h_rom(), ufork.romptr(0))
            );
            document.body.style.display = "flex";
            document.body.style.alignItems = "flex-start";
            return true;
        })
    ])(log);
    document.head.append(
        dom("meta", {name: "color-scheme", content: "dark"})
    );
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(pprint_ui);
