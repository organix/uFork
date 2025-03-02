// Visualize uFork actors as a directed graph.

/*jslint browser, global */

import assemble from "https://ufork.org/lib/assemble.js";
import parseq from "https://ufork.org/lib/parseq.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import prng from "https://ufork.org/lib/prng.js";
import make_ui from "https://ufork.org/lib/ui.js";
import make_core_driver from "./core_driver.js";
import ufork from "../ufork.js";
import springy from "./springy.js";
import springy_ui from "./springy_ui.js";
const lib_url = import.meta.resolve("https://ufork.org/lib/");
const wasm_url = import.meta.resolve("https://ufork.org/wasm/ufork.debug.wasm");

function is_device(ofs) {
    return ofs > ufork.DDEQUE_OFS && ofs < ufork.SPONSOR_OFS;
}

function print_short_cap(ram_ofs) {
    return ufork.print(
        ufork.ptr_to_cap(ufork.ramptr(ram_ofs))
    ).replace(
        /@60*/,
        "@"
    );
}

function device_label(ram_ofs) {
    if (ram_ofs === ufork.DEBUG_DEV_OFS) {
        return "debug_dev";
    }
    if (ram_ofs === ufork.CLOCK_DEV_OFS) {
        return "clock_dev";
    }
    if (ram_ofs === ufork.TIMER_DEV_OFS) {
        return "timer_dev";
    }
    if (ram_ofs === ufork.IO_DEV_OFS) {
        return "io_dev";
    }
    if (ram_ofs === ufork.RANDOM_DEV_OFS) {
        return "random_dev";
    }
    if (ram_ofs === ufork.HOST_DEV_OFS) {
        return "host_dev";
    }
}

const bytes_per_word = 4; // 32 bits
const bytes_per_quad = bytes_per_word * 4;
const actor_graph_ui = make_ui("actor-graph-ui", function (element, {
    ram = new Uint8Array(),
    rom_debugs = Object.create(null),
    background_color = "black",
    foreground_color = "white",
    device_color = "limegreen",
    proxy_color = "orange"
}) {
    const shadow = element.attachShadow({mode: "closed"});
    const graph = springy.make_graph();
    const layout = springy.make_layout({
        graph,
        random: prng(42)
    });
    const springy_element = springy_ui({
        layout,
        node_font_size: 18,
        background_color,
        foreground_color,
        stop_energy: 0.001
    });
    springy_element.style.width = "100%";
    springy_element.style.height = "100%";

    function label(raw) {
        if (ufork.is_rom(raw)) {
            return rom_debugs[raw]?.label;
        }
    }

    function invalidate() {
        if (!element.isConnected) {
            return;
        }

        function find_capabilities(raw) {
            if (ufork.is_cap(raw)) {
                return [raw];
            }
            if (ufork.is_ram(raw)) {
                const quad = ufork.read_quad(ram, ufork.rawofs(raw));
                return Object.values(quad).map(find_capabilities).flat();
            }
            return [];
        }

// Parse the RAM into quads. Identify all actors, proxies, and stubs.

        const nr_quads = ram.byteLength / bytes_per_quad;
        const quads = new Array(nr_quads).fill().map(function (_, ofs) {
            return ufork.read_quad(ram, ofs);
        });
        let actors = Object.create(null);
        quads.forEach(function (quad, ofs) {
            if (quad.t === ufork.ACTOR_T || quad.t === ufork.PROXY_T) {
                actors[ofs] = quad;
            }
        });

// A busy actor's effect quad is an #actor_t, yet it is not an actor.

        Object.values(actors).forEach(function (quad) {
            if (ufork.is_ram(quad.z)) {
                delete actors[ufork.rawofs(quad.z)];
            }
        });

// Find any actors directly or indirectly stubbed.

        let stubbed = Object.create(null);
        quads.filter(function (quad) {
            return quad.t === ufork.STUB_T;
        }).forEach(function (quad) {
            const device_ofs = ufork.rawofs(quad.x);
            find_capabilities(quad.y).forEach(function (cap) {
                stubbed[ufork.rawofs(cap)] = device_ofs;
            });
        });

// Show one node per actor.
// Show an edge to indicate one or more references from one actor to another.

        let nodes = [];
        let edges = Object.create(null);
        Object.entries(actors).forEach(function ([key, quad]) {
            const ofs = Number(key);
            const beh_label = label(quad.x);
            nodes.push(springy.make_node(ofs, {
                label: (
                    is_device(ofs)
                    ? device_label(ofs) ?? print_short_cap(ofs)
                    : print_short_cap(ofs) + (
                        beh_label !== undefined
                        ? ":" + beh_label
                        : ""
                    )
                ),
                color: (
                    is_device(ofs)
                    ? device_color
                    : (
                        quad.t === ufork.PROXY_T
                        ? proxy_color
                        : undefined
                    )
                )
            }));
            const target_caps = [
                ...find_capabilities(quad.x),  // ACTOR_T code or PROXY_T device
                ...find_capabilities(quad.y),  // ACTOR_T data or PROXY_T tag
                ...find_capabilities(quad.z)   // ACTOR_T effect
            ];
            target_caps.map(ufork.rawofs).forEach(function (target_ofs) {
                const id = ofs + ">" + target_ofs;
                edges[id] = springy.make_edge(id, ofs, target_ofs);
            });

// If the actor is stubbed, draw an edge from the device.

            const device_ofs = stubbed[ofs];
            if (device_ofs !== undefined) {
                const id = device_ofs + ">" + ofs;
                edges[id] = springy.make_edge(id, device_ofs, ofs);
            }
        });

// Forget actors or references that no longer exist.

        graph.get_edges().forEach(function (edge) {
            if (edges[edge.id] === undefined) {
                graph.remove_edge(edge.id);
            }
        });
        graph.get_nodes().forEach(function (node) {
            if (actors[node.id] === undefined) {
                graph.remove_node(node.id);
            }
        });

// Add or update nodes and edges.

        const edge_array = Object.values(edges);
        nodes.forEach(function (node) {

// Hide device actors until they are referenced.

            if (!is_device(node.id) || edge_array.some(function (edge) {
                return edge.source_id === node.id || edge.target_id === node.id;
            })) {
                graph.add_node(node);
            }
        });
        edge_array.forEach(graph.add_edge);
        springy_element.invalidate();
    }

    function set_ram(new_ram) {
        ram = new_ram;
        invalidate();
    }

    function get_rom_debugs() {
        return rom_debugs;
    }

    function set_rom_debugs(new_rom_debugs) {
        rom_debugs = new_rom_debugs;
        invalidate();
    }

    shadow.append(springy_element);
    set_ram(ram);
    set_rom_debugs(rom_debugs);
    element.style.background = background_color;
    element.set_ram = set_ram;
    element.get_rom_debugs = get_rom_debugs;
    element.set_rom_debugs = set_rom_debugs;
});

function demo(log) {
    document.documentElement.innerHTML = "";
    const element = actor_graph_ui({});
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
            element.set_rom_debugs(message.debugs);
        } else {
            log(message);
        }
    });
    parseq.sequence([
        core.h_initialize(),
        core.h_import("https://ufork.org/lib/cell.asm"),
        requestorize(function () {
            core.h_boot();
            driver.command({kind: "subscribe", topic: "rom"});
            driver.command({kind: "subscribe", topic: "ram"});
            driver.command({kind: "subscribe", topic: "signal"});
            driver.command({kind: "interval", milliseconds: 100});
            driver.command({kind: "play"});
            return true;
        })
    ])(log);
    document.body.append(element);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(actor_graph_ui);
