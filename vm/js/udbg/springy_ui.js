// An element that displays an animated object graph. See springy.js.

/**
Copyright (c) 2010 Dennis Hotson

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.
*/

/*jslint browser, global */

import make_ui from "https://ufork.org/lib/ui.js";
import springy from "./springy.js";

const {add, subtract, multiply, divide, normal, normalise} = springy;
const edge_labels_upright = true;

function translucent(color, alpha) {
    return `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`;
}

const springy_ui = make_ui("springy-ui", function (element, {
    layout,
    node_font_size = 16,
    edge_font_size = 12,
    scale = globalThis.devicePixelRatio,
    background_color = "white",
    foreground_color = "black",
    on_node_select,
    timestep,
    stop_energy
}) {
    let images = {};
    let resize_observer;
    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

// Drag & drop.

    let selected;
    let nearest;
    let dragged;

// Auto adjust the bounding box of graph layout, with ease-in.

    let current_bb = layout.get_bounding_box();
    let target_bb = {
        bottomleft: {x: -2, y: -2},
        topright: {x: 2, y: 2}
    };
    requestAnimationFrame(function adjust() {
        target_bb = layout.get_bounding_box();

// current_bb gets 20% closer to target_bb every frame.

        current_bb = {
            bottomleft: add(
                current_bb.bottomleft,
                divide(
                    subtract(target_bb.bottomleft, current_bb.bottomleft),
                    10
                )
            ),
            topright: add(
                current_bb.topright,
                divide(
                    subtract(target_bb.topright, current_bb.topright),
                    10
                )
            )
        };
        requestAnimationFrame(adjust);
    });

// Convert to and from screen coordinates.

    function to_screen(p) {
        const size = subtract(current_bb.topright, current_bb.bottomleft);
        return {
            x: divide(
                subtract(p, current_bb.bottomleft),
                size.x
            ).x * canvas.width,
            y: divide(
                subtract(p, current_bb.bottomleft),
                size.y
            ).y * canvas.height
        };
    }

    function from_screen(s) {
        const size = subtract(current_bb.topright, current_bb.bottomleft);
        return {
            x: (s.x / canvas.width) * size.x + current_bb.bottomleft.x,
            y: (s.y / canvas.height) * size.y + current_bb.bottomleft.y
        };
    }

    function mouse_point(e) {
        const scale_x = canvas.width / canvas.clientWidth;
        const scale_y = canvas.height / canvas.clientHeight;
        const rect = canvas.getBoundingClientRect();
        return from_screen({
            x: scale_x * e.clientX - rect.left,
            y: scale_y * e.clientY - rect.top
        });
    }

    function get_text_width(node) {
        const text = node.data.label ?? node.id;
        if (node.text_widths && node.text_widths[text]) {
            return node.text_widths[text];
        }
        ctx.save();
        ctx.font = node.data.font ?? (scale * node_font_size) + "px system-ui";
        const width = ctx.measureText(text).width;
        ctx.restore();
        if (!node.text_widths) {
            node.text_widths = {};
        }
        node.text_widths[text] = width;
        return width;
    }

    function get_text_height() {
        return scale * node_font_size;
    }

    function get_image_width(node) {
        return (
            node.data.image.width !== undefined
            ? node.data.image.width
            : images[node.data.image.src].object.width
        );
    }

    function get_image_height(node) {
        return (
            node.data.image.height !== undefined
            ? node.data.image.height
            : images[node.data.image.src].object.height
        );
    }

    function get_node_height(node) {
        return (
            node.data.image === undefined
            ? get_text_height(node)
            : (
                (
                    images[node.data.image.src] !== undefined
                    && images[node.data.image.src].loaded
                )
                ? get_image_height(node)
                : 10
            )
        );
    }

    function get_node_width(node) {
        return (
            node.data.image === undefined
            ? get_text_width(node)
            : (
                (
                    images[node.data.image.src] !== undefined
                    && images[node.data.image.src].loaded
                )
                ? get_image_width(node)
                : 10
            )
        );
    }

// Helpers for figuring out where to draw arrows.

    function intersect_line_line(p1, p2, p3, p4) {
        const denom = (
            (p4.y - p3.y) * (p2.x - p1.x)
            - (p4.x - p3.x) * (p2.y - p1.y)
        );
        if (denom === 0) {
            return; // parallel
        }
        const ua = (
            (p4.x - p3.x) * (p1.y - p3.y)
            - (p4.y - p3.y) * (p1.x - p3.x)
        ) / denom;
        const ub = (
            (p2.x - p1.x) * (p1.y - p3.y)
            - (p2.y - p1.y) * (p1.x - p3.x)
        ) / denom;
        if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
            return {
                x: p1.x + ua * (p2.x - p1.x),
                y: p1.y + ua * (p2.y - p1.y)
            };
        }
    }

    function intersect_line_box(p1, p2, p3, w, h) {
        const tl = {x: p3.x, y: p3.y};
        const tr = {x: p3.x + w, y: p3.y};
        const bl = {x: p3.x, y: p3.y + h};
        const br = {x: p3.x + w, y: p3.y + h};
        return (
            intersect_line_line(p1, p2, tl, tr)     // top
            ?? intersect_line_line(p1, p2, tr, br)  // right
            ?? intersect_line_line(p1, p2, br, bl)  // bottom
            ?? intersect_line_line(p1, p2, bl, tl)  // left
        );
    }

    function clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function draw_edge(edge, p1, p2) {
        const source = layout.graph.get_node(edge.source_id);
        const target = layout.graph.get_node(edge.target_id);

// Draw nothing if either of the nodes is missing.

        if (source === undefined || target === undefined) {
            return;
        }
        const x1 = to_screen(p1).x;
        const y1 = to_screen(p1).y;
        const x2 = to_screen(p2).x;
        const y2 = to_screen(p2).y;
        const direction = {
            x: x2 - x1,
            y: y2 - y1
        };
        const the_normal = normalise(normal(direction));
        const from = layout.graph.edges_between(edge.source_id, edge.target_id);
        const to = layout.graph.edges_between(edge.target_id, edge.source_id);
        const total = from.length + to.length;

// Figure out edge's position in relation to other edges between the same
// nodes.

        const from_nr = from.findIndex(function (an_edge) {
            return an_edge.id === edge.id;
        });

// Change default to 10 to allow text fit between edges.

        const spacing = 12;

// Figure out how far off center the line should be drawn.

        const offset = multiply(the_normal, (
            from_nr * spacing
            - ((total - 1) * spacing) / 2
        ));
        const padding_x = 6;
        const padding_y = 6;
        const s1 = add(to_screen(p1), offset);
        const s2 = add(to_screen(p2), offset);
        const box_width = get_node_width(target) + padding_x;
        const box_height = get_node_height(target) + padding_y;
        const intersection = intersect_line_box(
            s1,
            s2,
            {
                x: x2 - box_width / 2,
                y: y2 - box_height / 2
            },
            box_width,
            box_height
        ) ?? s2;
        const stroke = edge.data.color ?? foreground_color;
        const weight = edge.data.weight ?? scale * 1;
        ctx.lineWidth = Math.max(weight * 2, 0.1);
        const arrow_width = 3 * ctx.lineWidth;
        const arrow_length = 2 * arrow_width;
        const directional = edge.data.directional ?? true;

// Draw line.

        const line_end = (
            directional
            ? subtract(
                intersection,
                multiply(
                    normalise(direction),
                    arrow_length * 0.5
                )
            )
            : s2
        );
        ctx.strokeStyle = stroke;
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(line_end.x, line_end.y);
        ctx.stroke();

// Draw arrow.

        if (directional) {
            ctx.save();
            ctx.fillStyle = stroke;
            ctx.translate(intersection.x, intersection.y);
            ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
            ctx.beginPath();
            ctx.moveTo(-arrow_length, arrow_width);
            ctx.lineTo(0, 0);
            ctx.lineTo(-arrow_length, -arrow_width);
            ctx.lineTo(-arrow_length * 0.8, -0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

// Draw label.

        if (edge.data.label !== undefined) {
            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.font = (
                edge.data.font
                ?? (scale * edge_font_size) + "px system-ui"
            );
            ctx.fillStyle = stroke;
            let angle = Math.atan2(s2.y - s1.y, s2.x - s1.x);
            let displacement = scale * -edge_font_size;
            if (
                edge_labels_upright
                && (angle > Math.PI / 2 || angle < -Math.PI / 2)
            ) {
                displacement *= -1;
                angle += Math.PI;
            }
            const text_position = add(
                divide(add(s1, s2), 2),
                multiply(the_normal, displacement)
            );
            ctx.translate(text_position.x, text_position.y);
            ctx.rotate(angle);
            ctx.fillText(edge.data.label, 0, -2);
            ctx.restore();
        }
    }

    function draw_node(node, p) {
        const s = to_screen(p);
        ctx.save();

// Pulled out the padding aspect so that the size functions could be used in
// multiple places. These should probably be settable by the user (and scoped
// higher) but this suffices for now.

        const padding_x = 6;
        const padding_y = 6;
        const content_width = get_node_width(node);
        const content_height = get_node_height(node);
        const box_width = content_width + padding_x;
        const box_height = content_height + padding_y;

// Clear background.

        ctx.clearRect(
            s.x - box_width / 2,
            s.y - box_height / 2,
            box_width,
            box_height
        );

// Fill background.

        if (selected !== undefined && selected.node?.id === node.id) {
            ctx.fillStyle = translucent(foreground_color, 0.3);
        } else if (nearest !== undefined && nearest.node?.id === node.id) {
            ctx.fillStyle = translucent(foreground_color, 0.15);
        } else {
            ctx.fillStyle = "transparent";
        }
        ctx.fillRect(
            s.x - box_width / 2,
            s.y - box_height / 2,
            box_width,
            box_height
        );
        if (node.data.image === undefined) {
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.font = (
                node.data.font
                ?? (scale * node_font_size) + "px system-ui"
            );
            ctx.fillStyle = node.data.color ?? foreground_color;
            const text = node.data.label ?? node.id;
            ctx.fillText(
                text,
                s.x - content_width / 2,
                s.y - content_height / 2
            );
        } else {

// Currently we just ignore any labels if the image object is set. One might
// want to extend this logic to allow for both, or other composite nodes.

// There should probably be a sanity check here too, but un-src-ed images aren't
// exactly a disaster.

            const src = node.data.image.src;
            if (images[src] !== undefined) {
                if (images[src].loaded) {

// Our image is loaded, so it's safe to draw.

                    ctx.drawImage(
                        images[src].object,
                        s.x - content_width / 2,
                        s.y - content_height / 2,
                        content_width,
                        content_height
                    );
                }
            } else {

// First time seeing an image with this src address, so add it to our set of
// image objects Note: we index images by their src to avoid making too many
// duplicates.

                images[src] = {};
                const img = document.createElement("img");
                images[src].object = img;
                img.addEventListener("load", function () {

// HTMLImageElement objects are very finicky about being used before they are
// loaded, so we set a flag when it is done.

                    images[src].loaded = true;
                });
                img.src = src;
            }
        }
        ctx.restore();
    }

    const renderer = springy.make_renderer({
        layout,
        clear,
        draw_edge,
        draw_node,
        timestep,
        stop_energy
    });
    function on_resize() {
        canvas.width = scale * element.clientWidth;
        canvas.height = scale * element.clientHeight;
        renderer.start();
    }

    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.backgroundColor = background_color;
    canvas.onmousedown = function (e) {
        const p = mouse_point(e);
        dragged = layout.nearest(p);
        nearest = dragged;
        selected = dragged;
        if (selected.node !== undefined) {
            dragged.point.m = 10000;
            if (on_node_select !== undefined) {
                on_node_select(selected.node);
            }
        }
        renderer.start();
    };
    canvas.ondblclick = function (e) {
        const p = mouse_point(e);
        selected = layout.nearest(p);
        const node = selected.node;
        if (node && node.data && node.data.ondoubleclick) {
            node.data.ondoubleclick();
        }
    };
    canvas.onmousemove = function (e) {
        const p = mouse_point(e);
        nearest = layout.nearest(p);
        if (dragged?.node !== undefined) {
            dragged.point.p.x = p.x;
            dragged.point.p.y = p.y;
        }
        renderer.start();
    };
    canvas.onmouseup = function () {
        dragged = undefined;
    };
    element.style.display = "block";
    element.invalidate = function () {
        if (resize_observer !== undefined) {
            renderer.start();
        }
    };
    element.append(canvas);
    return {
        connect() {
            resize_observer = new ResizeObserver(on_resize);
            resize_observer.observe(canvas);
            renderer.start();
        },
        disconnect() {
            resize_observer.disconnect();
            resize_observer = undefined;
            renderer.stop();
        }
    };
});

function demo() {
    document.documentElement.innerHTML = "";
    const graph = springy.make_graph();
    const layout = springy.make_layout({
        graph,
        stiffness: 800,
        repulsion: 300,
        damping: 0.5
    });
    const spruce = springy.make_node(0, {label: "Norway Spruce"});
    const fir = springy.make_node(1, {label: "Sicilian Fir"});
    const beech = springy.make_node(2, {label: "Beech"});
    const spruce_fir = springy.make_edge(0, spruce.id, fir.id, {label: "text"});
    const fir_beech = springy.make_edge(1, fir.id, beech.id, {label: "youwin"});
    graph.add_node(spruce);
    graph.add_node(fir);
    graph.add_node(beech);
    graph.add_edge(spruce_fir);
    const element = springy_ui({
        layout,
        foreground_color: "white",
        background_color: "black"
    });
    element.style.position = "fixed";
    element.style.inset = "0";
    document.body.append(element);
    setTimeout(function () {
        graph.remove_edge(spruce_fir.id);
        graph.add_edge(fir_beech);
        element.invalidate();
    }, 4000);
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze(springy_ui);
