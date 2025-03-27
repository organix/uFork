// Load modules into ROM.

/*jslint web, global */

import assemble from "https://ufork.org/lib/assemble.js";
import unpromise from "https://ufork.org/lib/rq/unpromise.js";
import ufork from "./ufork.js";
const lib_href = import.meta.resolve("https://ufork.org/lib/");
const eq_href = import.meta.resolve("https://ufork.org/lib/eq.asm");

const {
    fix_to_i32,
    fixnum,
    in_mem,
    is_ptr,
    is_raw,
    print_quad,
    rawofs,
    read_quad,
    romptr,
    write_quad,
    crlf_literals,
    crlf_types,
    imm_labels,
    op_labels,
    NIL_RAW,
    TYPE_T,
    INSTR_T,
    PAIR_T,
    DICT_T,
    VM_DICT,
    VM_ALU,
    VM_CMP,
    VM_ACTOR,
    VM_END,
    VM_SPONSOR,
    VM_DEQUE
} = ufork;

function stringify_error(error) {
    return `[${error.line}:${error.column}] ${error.message}`;
}

function load_module({
    ir,
    imports,
    alloc_quad,
    read_quad,
    write_quad
}) {

// Load a module into ROM. At this point its imports have already been loaded.

    let definitions = Object.create(null);
    let type_checks = [];
    let cyclic_data_checks = [];
    let arity_checks = [];

    function fail(message, ...data) {
        throw new Error(
            message + ": " + data.map(function (the_data) {
                return JSON.stringify(the_data, undefined, 4);
            }).join(" ")
        );
    }

    function definition_raw(name) {
        return (
            definitions[name] !== undefined
            ? definitions[name]
            : fail("Not defined", name)
        );
    }

    function lookup(ref) {
        return (
            ref.module === undefined
            ? definition_raw(ref.name)
            : (
                imports[ref.module] !== undefined
                ? (
                    is_raw(imports[ref.module][ref.name])
                    ? imports[ref.module][ref.name]
                    : fail("Not exported", ref.module + "." + ref.name, ref)
                )
                : fail("Not imported", ref.module, ref)
            )
        );
    }

    function label(name, labels, offset = 0) {
        const index = labels.findIndex(function (label) {
            return label === name;
        });
        return (
            (Number.isSafeInteger(index) && index >= 0)
            ? fixnum(index + offset)
            : fail("Bad label", name)
        );
    }

    function kind(node) {
        return (
            Number.isSafeInteger(node)
            ? "fixnum"
            : node.kind
        );
    }

    function literal(node) {
        const raw = crlf_literals[node.value];
        return (
            is_raw(raw)
            ? raw
            : fail("Not a literal", node)
        );
    }

    function fix(node) {
        return (
            kind(node) === "fixnum"
            ? fixnum(node) // FIXME: check integer bounds?
            : fail("Not a fixnum", node)
        );
    }

    function value(node) {
        const the_kind = kind(node);
        if (the_kind === "literal") {
            return literal(node);
        }
        if (the_kind === "fixnum") {
            return fix(node);
        }
        if (the_kind === "ref") {
            return lookup(node);
        }
        if (
            the_kind === "pair"
            || the_kind === "dict"
            || the_kind === "quad"
            || the_kind === "instr"
        ) {
            return populate(alloc_quad(node.debug), node);
        }
        if (the_kind === "type") {
            const raw = crlf_types[node.name];
            return (
                is_raw(raw)
                ? raw
                : (
                    Number.isSafeInteger(node.arity)
                    ? populate(alloc_quad(node.debug), node)
                    : lookup(node)
                )
            );
        }
        return fail("Not a value", node);
    }

    function instruction(node) {
        const raw = value(node);
        type_checks.push({
            raw,
            t: INSTR_T,
            node,
            msg: "Expected an instruction"
        });
        return raw;
    }

    function populate(ptr, node) {
        const the_kind = kind(node);
        let quad = {};
        if (the_kind === "type") {
            quad.t = TYPE_T;
            quad.x = fix(node.arity);
        } else if (the_kind === "pair") {
            quad.t = PAIR_T;
            quad.x = value(node.head);
            quad.y = value(node.tail);
            if (
                node.tail.kind === "ref"
                && node.tail.module === undefined
            ) {
                cyclic_data_checks.push([quad.y, PAIR_T, "y", node.tail]);
            }
        } else if (the_kind === "dict") {
            quad.t = DICT_T;
            quad.x = value(node.key);
            quad.y = value(node.value);
            quad.z = value(node.next); // dict/nil
            if (quad.z !== NIL_RAW) {
                type_checks.push({
                    raw: quad.z,
                    t: DICT_T,
                    node: node.next,
                    msg: "Expected a dict"
                });
            }
            if (
                node.next.kind === "ref"
                && node.next.module === undefined
            ) {
                cyclic_data_checks.push([quad.z, DICT_T, "z", node.next]);
            }
        } else if (the_kind === "quad") {
            quad.t = value(node.t);
            let arity = 0;
            if (node.x !== undefined) {
                quad.x = value(node.x);
                arity = 1;
            }
            if (node.y !== undefined) {
                quad.y = value(node.y);
                arity = 2;
            }
            if (node.z !== undefined) {
                quad.z = value(node.z);
                arity = 3;
            }
            arity_checks.push([quad.t, arity, node.t]);
        } else if (the_kind === "instr") {
            quad.t = INSTR_T;
            quad.x = label(node.op, op_labels);
            if (node.op === "typeq") {
                const imm_raw = value(node.imm);
                type_checks.push({
                    raw: imm_raw,
                    t: TYPE_T,
                    node: node.imm,
                    msg: "Expected a type"
                });
                quad.y = imm_raw;
                quad.z = instruction(node.k);
            } else if (
                node.op === "quad"
                || node.op === "pair"
                || node.op === "part"
                || node.op === "nth"
                || node.op === "drop"
                || node.op === "pick"
                || node.op === "dup"
                || node.op === "roll"
                || node.op === "msg"
                || node.op === "state"
            ) {
                quad.y = fix(node.imm);
                quad.z = instruction(node.k);
            } else if (
                node.op === "eq"
                || node.op === "push"
                || node.op === "assert"
            ) {
                quad.y = value(node.imm);
                quad.z = instruction(node.k);
            } else if (node.op === "debug") {
                quad.z = instruction(node.k);
            } else if (node.op === "if") {
                quad.y = instruction(node.t);
                quad.z = instruction(node.f);
            } else if (node.op === "dict") {
                quad.y = label(node.imm, imm_labels[VM_DICT]);
                quad.z = instruction(node.k);
            } else if (node.op === "deque") {
                quad.y = label(node.imm, imm_labels[VM_DEQUE]);
                quad.z = instruction(node.k);
            } else if (node.op === "alu") {
                quad.y = label(node.imm, imm_labels[VM_ALU]);
                quad.z = instruction(node.k);
            } else if (node.op === "cmp") {
                quad.y = label(node.imm, imm_labels[VM_CMP]);
                quad.z = instruction(node.k);
            } else if (node.op === "actor") {
                quad.y = label(node.imm, imm_labels[VM_ACTOR]);
                quad.z = instruction(node.k);
            } else if (node.op === "end") {
                quad.y = label(node.imm, imm_labels[VM_END], -1);
            } else if (node.op === "sponsor") {
                quad.y = label(node.imm, imm_labels[VM_SPONSOR]);
                quad.z = instruction(node.k);
            } else if (node.op !== "jump") {

// The 'jump' instruction has no fields.

                return fail("Not an op", node);
            }
        } else {
            return fail("Not a quad", node);
        }
        write_quad(ptr, quad);
        return ptr;
    }

    function is_quad(node) {
        return (
            kind(node) === "pair"
            || kind(node) === "dict"
            || kind(node) === "quad"
            || kind(node) === "instr"
        );
    }

// Allocate a placeholder quad for each definition that requires one, or set the
// raw directly. Only resolve refs that refer to imports, not definitions.

    Object.entries(ir.ast.define).forEach(function ([name, node]) {
        if (is_quad(node)) {
            definitions[name] = alloc_quad(node.debug);
        } else if (kind(node) === "ref") {
            if (node.module !== undefined) {
                definitions[name] = lookup(node);
            }
        } else {
            definitions[name] = value(node);
        }
    });

// Now we resolve any refs that refer to definitions. This is tricky because
// they could be cyclic. If they are not cyclic, we resolve them in order of
// dependency.

    let ref_deps = Object.create(null);
    Object.entries(ir.ast.define).forEach(function ([name, node]) {
        if (kind(node) === "ref" && node.module === undefined) {
            ref_deps[name] = node.name;
        }
    });

    function ref_depth(name, seen = []) {
        const dep_name = ref_deps[name];
        if (seen.includes(name)) {
            return fail("Cyclic refs", ir.ast.define[name]);
        }
        return (
            ref_deps[dep_name] === undefined
            ? 0
            : 1 + ref_depth(dep_name, seen.concat(name))
        );
    }

    Object.keys(ref_deps).sort(function (a, b) {
        return ref_depth(a) - ref_depth(b);
    }).forEach(function (name) {
        definitions[name] = lookup(ir.ast.define[name]);
    });

// Populate each placeholder quad.

    Object.entries(ir.ast.define).forEach(function ([name, node]) {
        if (is_quad(node)) {
            populate(definitions[name], node);
        }
    });

// Check the type of dubious quads now they are fully populated.

    type_checks.forEach(function ({raw, t, node, msg}) {
        if (!is_ptr(raw) || read_quad(raw).t !== t) {
            return fail(msg, node);
        }
    });

// Check for cyclic data structures, which are pathological for some
// instructions.

    cyclic_data_checks.forEach(function ([raw, t, k_field, node]) {
        let seen = [];
        while (is_ptr(raw)) {
            if (seen.includes(raw)) {
                return fail("Cyclic", node);
            }
            const quad = read_quad(raw);
            if (quad.t !== t) {
                break;
            }
            seen.push(raw);
            raw = quad[k_field];
        }
    });

// Check that custom quad have a valid type in the T field, and an arity
// matching the type.

    arity_checks.forEach(function ([type_raw, arity, node]) {
        if (
            !in_mem(type_raw)
            && type_raw !== TYPE_T
            && type_raw !== INSTR_T
            && type_raw !== PAIR_T
            && type_raw !== DICT_T
        ) {
            return fail("Not a type", node);
        }
        const type_quad = read_quad(type_raw);
        if (type_quad.t !== TYPE_T) {
            return fail("Not a type", node);
        }
        if (arity !== fix_to_i32(type_quad.x)) {
            return fail("Wrong arity for type", node);
        }
    });

// Populate the exports object.

    let exports_object = Object.create(null);
    ir.ast.export.forEach(function (name) {
        exports_object[name] = definition_raw(name);
    });
    return exports_object;
}

function import_module({
    src,
    content,
    import_map = Object.create(null),
    import_promises = Object.create(null),
    compilers,
    load,
    on_trace,
    on_fetch_text
}) {

// Import and load a module, along with its dependencies. If 'content' (a text
// string or IR object) is provided, the 'src' is used only to resolve relative
// imports.

    function map_src(src) {
        if (src !== undefined) {
            const alias = Object.keys(import_map).find(function (key) {
                return src.startsWith(key);
            });
            if (alias !== undefined) {
                return src.replace(alias, import_map[alias]);
            }
        }
    }

    function import_promise(src, content) {

        function compile(text) {
            const extension = src.split(".").pop();
            if (!Object.hasOwn(compilers, extension)) {
                throw new Error("No compiler for '" + src + "'.");
            }
            const compiler = compilers[extension];
            if (on_fetch_text !== undefined) {
                on_fetch_text(src, text);
            }
            return compiler(text, src);
        }

        if (import_promises[src] === undefined) {
            if (on_trace !== undefined && content === undefined) {
                on_trace("Fetching " + src);
            }
            import_promises[src] = (
                content === undefined
                ? fetch(src).then(function (response) {
                    return response.text();
                }).then(compile)
                : Promise.resolve(
                    typeof content === "string"
                    ? compile(content)
                    : content
                )
            ).then(function (ir) {
                if (ir.errors !== undefined && ir.errors.length > 0) {
                    const error_messages = ir.errors.map(stringify_error);
                    return Promise.reject(new Error(
                        "Failed to load '"
                        + src
                        + "':\n"
                        + error_messages.join("\n")
                    ));
                }

// FIXME: cyclic module dependencies cause a deadlock, but they should instead
// fail with an error.

                return Promise.all(Object.values(ir.ast.import).map(
                    function (import_src) {
                        import_src = map_src(import_src) ?? import_src;
                        return import_promise(

// We need to resolve the import specifier if it is relative.

                            import_src.startsWith(".")
                            ? (

// The URL constructor chokes when 'base' is an absolute path, rather than a
// fully qualified URL. We work around this using a dummy origin so that we can
// produce an absolute path if 'src' is an absolute path.

                                src.startsWith("/")
                                ? new URL(
                                    import_src,
                                    new URL(src, "http://_")
                                ).pathname
                                : new URL(import_src, src).href
                            )
                            : import_src
                        );
                    }
                )).then(function (imported_modules) {
                    const imports = Object.create(null);
                    Object.keys(ir.ast.import).forEach(function (name, nr) {
                        imports[name] = imported_modules[nr];
                    });
                    return load(ir, imports);
                });
            });
        }
        return import_promises[src];
    }

    return unpromise(function () {
        return import_promise(
            map_src(src) ?? src,
            content
        );
    });
}

function demo(log) {
    let rom_words = new Uint32Array(ufork.QUAD_ROM_MAX * 4);
    let rom_top = ufork.reserved_rom.length / 4;
    let rom_debugs = Object.create(null);
    let texts = Object.create(null);
    rom_words.set(ufork.reserved_rom);
    import_module({
        src: eq_href,
        import_map: {"https://ufork.org/lib/": lib_href},
        compilers: {asm: assemble},
        load(ir, imports) {
            return load_module({
                ir,
                imports,
                alloc_quad(debug_info) {
                    const ptr = romptr(rom_top);
                    rom_top += 1;
                    rom_debugs[ptr] = debug_info;
                    return ptr;
                },
                read_quad(ptr) {
                    return read_quad(rom_words, rawofs(ptr));
                },
                write_quad(ptr, quad) {
                    write_quad(rom_words, rawofs(ptr), quad);
                }
            });
        },
        on_trace: log,
        on_fetch_text(src, text) {
            texts[src] = text;
        }
    })(function callback(module, reason) {
        log(module ?? reason);
        new Array(rom_top).fill().forEach(function (_, ofs) {
            const ptr = romptr(ofs);
            log(
                print_quad(read_quad(rom_words, ofs)),
                rom_debugs[ptr]?.label ?? ""
            );
        });
    });
}

if (import.meta.main) {
    demo(globalThis.console.log);
}

export default Object.freeze({
    import: import_module,
    load: load_module
});
