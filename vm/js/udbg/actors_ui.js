// Visualize the actors in a uFork core.

/*jslint browser, global */

import assemble from "https://ufork.org/lib/assemble.js";
import dom from "https://ufork.org/lib/dom.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import prng from "https://ufork.org/lib/prng.js";
import split_ui from "https://ufork.org/lib/split_ui.js";
import theme from "https://ufork.org/lib/theme.js";
import make_ui from "https://ufork.org/lib/ui.js";
import make_core_driver from "./core_driver.js";
import ufork from "../ufork.js";
import timer_dev from "../timer_dev.js";
import raw_ui from "./raw_ui.js";
import springy from "./springy.js";
import springy_ui from "./springy_ui.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");

function is_device_ofs(ofs) {
    return ofs > ufork.DDEQUE_OFS && ofs < ufork.SPONSOR_OFS;
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

function find_caps(ram, raws, deep = false) {
    let caps = new Set();
    let seen = new Set();  // cycle protection
    let stack = Array.from(raws);
    while (stack.length > 0) {
        let raw = stack.pop();
        if (!seen.has(raw)) {
            seen.add(raw);
            if (ufork.is_cap(raw)) {
                caps.add(raw);
                if (deep) {
                    stack.push(ufork.cap_to_ptr(raw));
                }
            } else if (ufork.is_ram(raw)) {
                const quad = ufork.read_quad(ram, ufork.rawofs(raw));
                if (quad !== undefined) {
                    stack.push(...Object.values(quad));  // t, x, y, z
                }
            }
        }
    }
    return caps;
}

function rooted_caps(ram) {

// Search RAM for all capabilities, beginning at the roots.

    const gc_root = ufork.read_quad(ram, ufork.MEMORY_OFS).z;
    const e_head = ufork.read_quad(ram, ufork.DDEQUE_OFS).t;
    const k_head = ufork.read_quad(ram, ufork.DDEQUE_OFS).y;
    const device_start = ufork.DDEQUE_OFS + 1;
    const nr_devices = ufork.SPONSOR_OFS - device_start;
    const devices = new Array(nr_devices).fill().map(function (_, device_nr) {
        const device_ofs = device_start + device_nr;
        return ufork.ptr_to_cap(ufork.ramptr(device_ofs));
    });
    const root_sponsor = ufork.ramptr(ufork.SPONSOR_OFS);
    const roots = [gc_root, e_head, k_head, ...devices, root_sponsor];
    return find_caps(ram, roots, true);
}

function find_stubs(
    ram,
    stub = ufork.read_quad(ram, ufork.MEMORY_OFS).z,
    object = Object.create(null)
) {

// Find any actors directly or indirectly stubbed.

    if (ufork.is_ram(stub)) {
        const quad = ufork.read_quad(ram, ufork.rawofs(stub));
        if (quad.t === ufork.STUB_T) {
            const device_ofs = ufork.rawofs(quad.x);
            Array.from(
                find_caps(ram, [quad.y])
            ).forEach(function (cap) {
                const cap_ofs = ufork.rawofs(cap);
                object[cap_ofs] = device_ofs;
            });
        }
        return find_stubs(ram, quad.z, object);
    }
    return object;
}

const actors_ui = make_ui("actor-ui", function (element, {
    ram = new Uint8Array(),
    rom = new Uint8Array(),
    rom_debugs = Object.create(null)
}) {
    let controls;
    let isolate_checkbox;
    let graph_element;
    let selected_ofs;
    const shadow = element.attachShadow({mode: "closed"});
    const style = dom("style", `
        :host {
            background-color: ${theme.black};
        }
        inspector-ui {
            background-color: ${theme.black};
            color: ${theme.white};
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        details-ui {
            overflow-y: auto;
            scrollbar-color: ${theme.gray} transparent;
            padding: 12px;
        }
        controls-ui {
            padding: 8px 10px;
            border-top: 1px solid ${theme.gray};
        }
        label {
            display: flex;
            align-items: center;
            font-family: ${theme.proportional_font_family};
            font-size: 13px;
            color: ${theme.white};
        }
    `);
    const graph = springy.make_graph();
    const layout = springy.make_layout({
        graph,
        random: prng(42)
    });
    const inspector_element = dom("inspector-ui");

    function label(raw) {
        if (ufork.is_rom(raw)) {
            return rom_debugs[raw]?.label;
        }
    }

    function invalidate() {
        if (!element.isConnected || ram.length === 0) {
            return;
        }

// Update inspector panel.

        let selected_actor_ofs;
        let value;
        inspector_element.innerHTML = "";
        if (selected_ofs !== undefined) {
            selected_actor_ofs = selected_ofs;
            value = ufork.ptr_to_cap(ufork.ramptr(selected_ofs));
        } else {
            const cc = ufork.current_continuation(ram);
            if (cc?.ep !== undefined) {
                value = cc.ep;
                const target = ufork.read_quad(ram, ufork.rawofs(cc.ep)).x;
                selected_actor_ofs = ufork.rawofs(target);
            }
        }
        if (value !== undefined) {
            inspector_element.append(
                dom("details-ui", [
                    raw_ui({
                        value,
                        depth: 1,
                        expand: 3,
                        ram,
                        rom,
                        rom_debugs
                    })
                ]),
                controls
            );
        }
        const caps = (
            (isolate_checkbox.checked && selected_actor_ofs !== undefined)
            ? find_caps(ram, [
                ufork.ptr_to_cap(ufork.ramptr(selected_actor_ofs)),
                ufork.ramptr(selected_actor_ofs)
            ])
            : rooted_caps(ram)
        );
        const stubbed = find_stubs(ram);

// Show one node per capability. Show an edge to indicate one or more references
// from one capability to another.

        let nodes = [];
        let edges = Object.create(null);
        Array.from(caps).forEach(function (raw) {
            const ofs = ufork.rawofs(raw);
            const quad = ufork.read_quad(ram, ofs);
            const beh_label = (
                quad.t === ufork.PROXY_T
                ? device_label(ufork.rawofs(quad.x))
                : label(quad.x)
            );
            nodes.push(springy.make_node(ofs, {
                selected: ofs === selected_actor_ofs,
                label: "@" + (
                    is_device_ofs(ofs)
                    ? device_label(ofs) ?? ofs.toString(16)
                    : ofs.toString(16) + (
                        beh_label !== undefined
                        ? ":" + beh_label
                        : ""
                    )
                ),
                color: (
                    is_device_ofs(ofs)
                    ? theme.purple
                    : (
                        quad.t === ufork.PROXY_T
                        ? theme.orange
                        : theme.yellow
                    )
                )
            }));
            const target_caps = find_caps(ram, [
                quad.x,  // ACTOR_T code or PROXY_T device
                quad.y,  // ACTOR_T data or PROXY_T tag
                quad.z   // ACTOR_T effect
            ]);
            Array.from(target_caps).forEach(function (cap) {
                const target_ofs = ufork.rawofs(cap);
                if (ofs !== target_ofs && caps.has(cap)) {
                    const id = ofs + ">" + target_ofs;
                    edges[id] = springy.make_edge(id, ofs, target_ofs);
                }
            });

// If the actor is stubbed, draw an edge from the device.

            const device_ofs = stubbed[ofs];
            if (device_ofs !== undefined) {
                const cap = ufork.ptr_to_cap(ufork.ramptr(device_ofs));
                if (caps.has(cap)) {
                    const id = device_ofs + ">" + ofs;
                    edges[id] = springy.make_edge(id, device_ofs, ofs);
                }
            }
        });

// Forget actors or references that no longer exist.

        graph.get_edges().forEach(function (edge) {
            if (edges[edge.id] === undefined) {
                graph.remove_edge(edge.id);
            }
        });
        graph.get_nodes().forEach(function (node) {
            const cap = ufork.ptr_to_cap(ufork.ramptr(node.id));
            if (!caps.has(cap)) {
                graph.remove_node(node.id);
            }
        });

// Add or update nodes and edges.

        const edge_array = Object.values(edges);
        nodes.forEach(function (node) {

// Hide device actors until they are referenced for the first time.

            if (!is_device_ofs(node.id) || edge_array.some(function (edge) {
                return edge.source_id === node.id || edge.target_id === node.id;
            })) {
                graph.add_node(node);
            }
        });
        edge_array.forEach(graph.add_edge);
        graph_element.invalidate();
    }

    function set_ram(new_ram) {
        selected_ofs = undefined;  // deselect
        ram = new_ram;
        invalidate();
    }

    function set_rom(new_rom, new_rom_debugs) {
        rom = new_rom;
        rom_debugs = new_rom_debugs;
        invalidate();
    }

    function on_keydown(event) {
        if (!event.altKey && !event.metaKey && !event.ctrlKey) {
            if (event.key === "i") {
                isolate_checkbox.checked = !isolate_checkbox.checked;
                invalidate();
            }
        }
    }

    isolate_checkbox = dom("input", {
        type: "checkbox",
        oninput: invalidate
    });
    controls = dom("controls-ui", [
        dom(
            "label",
            {title: "Direct references only (i)"},
            ["Isolate", isolate_checkbox]
        )
    ]);
    graph_element = springy_ui({
        layout,
        node_font_size: 18,
        font_family: theme.monospace_font_family,
        background_color: theme.black,
        foreground_color: theme.white,
        stop_energy: 0.001,
        on_click(ofs) {
            selected_ofs = ofs;  // undefined will deselect
            invalidate();
        }
    });
    const split_element = dom(
        split_ui({
            placement: "right",
            divider_color: theme.gray,
            divider_width: "3px"
        }),
        {style: {width: "100%", height: "100%"}},
        [
            dom(graph_element, {slot: "main"}),
            dom(inspector_element, {slot: "peripheral"})
        ]
    );
    shadow.append(style, split_element);
    set_ram(ram);
    set_rom(rom, rom_debugs);
    element.set_ram = set_ram;
    element.set_rom = set_rom;
    return {
        connect() {
            split_element.set_size(0.4 * globalThis.innerWidth);
            document.addEventListener("keydown", on_keydown);
        },
        disconnect() {
            document.removeEventListener("keydown", on_keydown);
        }
    };
});

function demo(log) {
    document.documentElement.innerHTML = "";
    const element = actors_ui({});
    element.style.position = "fixed";
    element.style.inset = "0";
    const core = ufork.make_core({
        wasm_url,
        import_map: {"https://ufork.org/lib/": lib_url},
        compilers: {asm: assemble}
    });
    const driver = make_core_driver(core, function on_status(message) {
        if (message.kind === "ram") {
            element.set_ram(message.bytes);
        } else if (message.kind === "rom") {
            element.set_rom(message.bytes, message.debugs);
        } else if (message.kind === "signal") {
            log("signal", ufork.print(message.signal));
        } else {
            log(message);
        }
    });
    parseq.sequence([
        core.h_initialize(),
        core.h_import("https://ufork.org/lib/cell.asm"),
        requestorize(function () {
            timer_dev(core);
            core.h_boot();
            driver.command({kind: "subscribe", topic: "rom"});
            driver.command({kind: "subscribe", topic: "ram"});
            driver.command({kind: "subscribe", topic: "playing"});
            driver.command({kind: "subscribe", topic: "signal"});
            driver.command({kind: "step_size", value: "txn"});
            driver.command({kind: "interval", milliseconds: 2000});
            driver.command({kind: "play", steps: 1});
            return true;
        })
    ])(log);
    document.body.append(element);
    document.onkeydown = function (event) {
        if (event.key === "s") {
            driver.command({kind: "play", steps: 1});
        }
    };
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(actors_ui);
