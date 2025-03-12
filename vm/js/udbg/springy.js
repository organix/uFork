// A simplified and modernized version https://github.com/dhotson/springy, a
// force directed graphing engine.

/**
 * Springy v2.7.1
 *
 * Copyright (c) 2010-2013 Dennis Hotson
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

/*jslint browser, this */

function make_node(id, data = {}) {

// Data fields used by layout algorithm in this file: data.mass
// Data used by default renderer in springy_ui.js: data.label

    return {id, data};
}

function make_edge(id, source_id, target_id, data = {}) {

// Edge data field used by layout alorithm: data.length, data.type

    return {id, source_id, target_id, data};
}

function make_graph() {
    let nodes = Object.create(null);
    let sources = Object.create(null);

    function get_nodes() {
        return Object.values(nodes);
    }

    function get_edges() {
        return Object.values(sources).map(function (targets) {
            return Object.values(targets).flat();
        }).flat();
    }

    function add_node(node) {
        nodes[node.id] = node;
    }

    function add_edge(edge) {
        if (sources[edge.source_id] === undefined) {
            sources[edge.source_id] = Object.create(null);
        }
        if (sources[edge.source_id][edge.target_id] === undefined) {
            sources[edge.source_id][edge.target_id] = [];
        }
        if (!sources[edge.source_id][edge.target_id].some(function (an_edge) {
            return an_edge.id === edge.id;
        })) {
            sources[edge.source_id][edge.target_id].push(edge);
        }
    }

    function edges_between(a_id, b_id) {

// Returns an array of edges from node 'a' to node 'b'.

        return (
            sources[a_id] !== undefined
            ? sources[a_id][b_id] ?? []
            : []
        );
    }

    function filter_edges(predicate) {

// Remove edges for which the predicate returns false.

        Object.values(sources).forEach(function (targets) {
            Object.entries(targets).forEach(function ([target_id, edges]) {
                targets[target_id] = edges.filter(predicate);
            });
        });
    }

    function remove_edge(id) {

// Remove an edge from the graph.

        filter_edges(function (edge) {
            return edge.id !== id;
        });
    }

    function remove_node(id) {

// Remove a node and its associated edges from the graph.

        delete nodes[id];
        filter_edges(function (edge) {
            return edge.source_id !== id && edge.target_id !== id;
        });
    }

    function get_node(id) {
        return nodes[id];
    }

    return Object.freeze({
        add_edge,
        add_node,
        edges_between,
        get_edges,
        get_node,
        get_nodes,
        remove_edge,
        remove_node
    });
}

// A vector is an object like {x, y}.

function add(a, b) {
    return {
        x: a.x + b.x,
        y: a.y + b.y
    };
}

function subtract(a, b) {
    return {
        x: a.x - b.x,
        y: a.y - b.y
    };
}

function multiply(v, n) {
    return {
        x: v.x * n,
        y: v.y * n
    };
}

function divide(v, n) {
    return {
        x: v.x / n || 0,
        y: v.y / n || 0
    };
}

function magnitude(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

function normal(v) {
    return {
        x: v.y,
        y: v.x
    };
}

function normalise(v) {
    return divide(v, magnitude(v));
}

function apply_force(point, force) {
    point.a = add(point.a, divide(force, point.m));
}

function make_layout({
    graph,
    stiffness = 400,            // spring stiffness constant
    repulsion = 400,            // repulsion constant
    damping = 0.5,              // velocity damping factor
    padding = 0.1,              // padding from bounds
    random = Math.random,       // source of randomness
    max_speed = Infinity        // nodes aren't allowed to exceed this speed
}) {
    let points = Object.create(null);   // points associated with nodes
    let springs = Object.create(null);  // springs associated with edges

    function get_point(node) {
        if (points[node.id] === undefined) {
            points[node.id] = {
                p: {                                // position
                    x: 10 * (random() - 0.5),
                    y: 10 * (random() - 0.5)
                },
                m: node.data.mass ?? 1,             // mass
                v: {x: 0, y: 0},                    // velocity
                a: {x: 0, y: 0}                     // acceleration
            };
        }
        return points[node.id];
    }

    function get_spring(edge) {
        if (springs[edge.id] === undefined) {
            springs[edge.id] = {
                point1: get_point(graph.get_node(edge.source_id)),
                point2: get_point(graph.get_node(edge.target_id)),
                length: edge.data.length ?? 1,
                k: stiffness
            };
        }
        return springs[edge.id];
    }

    function get_points() {
        return graph.get_nodes().map(get_point);
    }

    function nearest(pos) {

// Find the nearest point to a particular position.

        let min = {};
        graph.get_nodes().forEach(function (node) {
            const point = get_point(node);
            const distance = magnitude(subtract(point.p, pos));
            if (min.distance === undefined || distance < min.distance) {
                min = {node, point, distance};
            }
        });
        return min;
    }

    function get_bounding_box() {

// Returns {bottomleft, topright}.

        let bottomleft = {x: -2, y: -2};
        let topright = {x: 2, y: 2};
        get_points().forEach(function (point) {
            if (point.p.x < bottomleft.x) {
                bottomleft.x = point.p.x;
            }
            if (point.p.y < bottomleft.y) {
                bottomleft.y = point.p.y;
            }
            if (point.p.x > topright.x) {
                topright.x = point.p.x;
            }
            if (point.p.y > topright.y) {
                topright.y = point.p.y;
            }
        });
        const padding_vector = multiply(
            subtract(topright, bottomleft),
            padding
        );
        return {
            bottomleft: subtract(bottomleft, padding_vector),
            topright: add(topright, padding_vector)
        };
    }

    function apply_coulombs_law() {
        get_points().forEach(function (point_a) {
            get_points().forEach(function (point_b) {
                if (point_a !== point_b) {
                    const d = subtract(point_a.p, point_b.p);

// Avoid massive forces at small distances (and divide by zero).

                    const distance = magnitude(d) + 0.1;
                    const direction = normalise(d);
                    const multiplication = multiply(direction, repulsion);

// Apply force to each end point.

                    const divisor = distance * distance * 0.5;
                    apply_force(point_a, divide(multiplication, divisor));
                    apply_force(point_b, divide(multiplication, -divisor));
                }
            });
        });
    }

    function apply_hookes_law() {
        graph.get_edges().forEach(function (edge) {
            const {point1, point2, length, k} = get_spring(edge);

// The direction of the spring.

            const d = subtract(point2.p, point1.p);
            const displacement = length - magnitude(d);
            const direction = normalise(d);

// Apply force to each end point.

            apply_force(point1, multiply(direction, k * displacement * -0.5));
            apply_force(point2, multiply(direction, k * displacement * 0.5));
        });
    }

    function attract_to_centre() {
        get_points().forEach(function (point) {
            const direction = multiply(point.p, -1);
            apply_force(point, multiply(direction, repulsion / 50));
        });
    }

    function update_velocity(timestep) {
        get_points().forEach(function (point) {
            point.v = multiply(
                add(point.v, multiply(point.a, timestep)),
                damping
            );
            if (magnitude(point.v) > max_speed) {
                point.v = multiply(normalise(point.v), max_speed);
            }
            point.a = {x: 0, y: 0};
        });
    }

    function update_position(timestep) {
        get_points().forEach(function (point) {
            point.p = add(point.p, multiply(point.v, timestep));
        });
    }

    function total_energy() {

// Calculate the total kinetic energy of the system.

        let energy = 0;
        get_points().forEach(function (point) {
            const speed = magnitude(point.v);
            energy += 0.5 * point.m * speed * speed;
        });
        return energy;
    }

    function tick(timestep) {
        apply_coulombs_law();
        apply_hookes_law();
        attract_to_centre();
        update_velocity(timestep);
        update_position(timestep);
    }

    return Object.freeze({
        get_bounding_box,
        get_point,
        get_spring,
        graph,
        nearest,
        tick,
        total_energy
    });
}

function make_renderer({
    layout,
    clear,
    draw_edge,
    draw_node,
    timestep = 0.03,
    stop_energy = 0.01
}) {
    let timer;

    function start() {
        if (timer !== undefined) {
            return;
        }
        timer = requestAnimationFrame(function step() {
            layout.tick(timestep);
            clear();
            layout.graph.get_edges().forEach(function (edge) {
                const spring = layout.get_spring(edge);
                draw_edge(edge, spring.point1.p, spring.point2.p);
            });
            layout.graph.get_nodes().forEach(function (node) {
                const point = layout.get_point(node);
                draw_node(node, point.p);
            });

// Stop when energy of the system falls below the threshold.

            timer = (
                layout.total_energy() < stop_energy
                ? undefined
                : requestAnimationFrame(step)
            );
        });
    }

    function stop() {
        cancelAnimationFrame(timer);
        timer = undefined;
    }

    return Object.freeze({start, stop});
}


export default Object.freeze({
    make_graph,
    make_layout,
    make_renderer,
    make_node,
    make_edge,
    add,
    subtract,
    multiply,
    divide,
    magnitude,
    normal,
    normalise
});
