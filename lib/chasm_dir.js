//
// chasm_dir - Classic Hewitt Actor Semantic Model for Director
//
// See https://github.com/organix/uFork/blob/main/docs/director.md
//

/*jslint global, long */

import chasm from "./chasm.js";
// export default Object.freeze({
//     sink_beh,
//     println_beh,
//     new_theater
// });

let log = function log(/*...args*/) {
    return undefined;
};

const dir_constant = Object.freeze({
    "?": { kind: "value", type: "Null", value: undefined },
    "True": { kind: "value", type: "Boolean", value: true },
    "False": { kind: "value", type: "Boolean", value: false },
    "Null": { kind: "value", type: "Type", value: "Null" },
    "Boolean": { kind: "value", type: "Type", value: "Boolean" },
    "Number": { kind: "value", type: "Type", value: "Number" },
    "Text": { kind: "value", type: "Type", value: "Text" },
    "Dict": { kind: "value", type: "Type", value: "Dict" },
    "List": { kind: "value", type: "Type", value: "List" },
    "Actor": { kind: "value", type: "Type", value: "Actor" },
    "Script": { kind: "value", type: "Type", value: "Script" },
    "Type": { kind: "value", type: "Type", value: "Type" },
    "by_name": function by_name(name) {
        return dir_constant[name];
    }
});

const dir_literal = {
    "number": function literal_number(significand = 0, base = 10, exponent = 0) {
        return { kind: "value", type: "Number", significand, base, exponent };
    },
    "text": function literal_text(value = "") {
        return { kind: "value", type: "Text", value };
    },
    "list": function literal_list(value = []) {
        return { kind: "value", type: "List", value };
    },
    "dict": function literal_dict(value = {}) {
        return { kind: "value", type: "Dict", value };
    }
};

function dir_actor(address) {
    return { kind: "value", type: "Actor", address };
}

const dir_script = {
    "block": function script_block(block) {
        return { kind: "script", type: "Script", value: block };
    },
    "nothing": function script_nothing() {
        return { kind: "script", type: "Script", value: "nothing" };
    },
    "let": function script_let(name, expr) {
        return { kind: "script", type: "Script", value: "let", name, expr };
    },
    "send": function script_send(message, target) {
        return { kind: "script", type: "Script", value: "send", message, target };
    },
    "become": function script_become(behavior, state) {
        const o = { kind: "script", type: "Script", value: "become", behavior };
        if (state !== undefined) {
            o.state = state;
        }
        return o;
    },
    "if/else": function script_if(condition, consequence, alternative = dir_script.nothing ) {
        return { kind: "script", type: "Script", value: "if/else", condition, consequence, alternative };
    },
    "commit": function script_commit() {
        return { kind: "script", type: "Script", value: "commit" };
    },
    "abort": function script_abort(expr) {
        return { kind: "script", type: "Script", value: "abort", expr };
    },
    "do": function script_do(expr) {
        return { kind: "script", type: "Script", value: "do", expr };
    }
};

const dir_expression = {
    "create": function expr_create(behavior, state) {
        const o = { kind: "expression", type: "Actor", value: "create", behavior };
        if (state !== undefined) {
            o.state = state;
        }
        return o;
    },
    "self": function expr_self() {
        return { kind: "expression", type: "Actor", value: "@@" };
    },
    "message": function expr_message() {
        return { kind: "expression", type: "Dict", value: "@" };
    },
    "index": function expr_index(sequence, index) {
        return { kind: "expression", type: "Any", value: "index", sequence, index };
    },
    "operator": function expr_operator(operator, ...exprs) {
        return { kind: "expression", type: "Any", value: "operator", operator, exprs };
    },
    "variable": function expr_variable(name) {
        return { kind: "expression", type: "Any", value: "variable", name };
    }
};

//
// Create an actor behavior to execute a Director script.
//
function new_behavior(ast, block, state = Object.create(null)) {
    // state = state || Object.create(null);

    function interpret_expression(expr, event, effect) {
        if (expr.kind === "value") {
            return expr;
        }
        if (expr.kind === "expression") {
            if (expr.value === "@@") {
                return event.target;
            }
            if (expr.value === "@") {
                return event.message;
            }
            if (expr.value === "create") {
                const beh = interpret_expression(expr.behavior, event, effect);
                let actor;
                if (expr.state === undefined) {
                    actor = effect.actor_create(new_behavior(ast, beh));
                } else {
                    actor = effect.actor_create(new_behavior(
                        ast,
                        beh,
                        interpret_expression(expr.state, event, effect)
                    ));
                }
                return actor;
            }
            if (expr.value === "index") {
                const seq = interpret_expression(expr.sequence, event, effect);
                const idx = interpret_expression(expr.index, event, effect);
                return seq.value[idx.value];
            }
            if (expr.value === "variable") {
                let key = expr.name.value;
                let value = state[key];
                if (value === undefined) {
                    value = ast.define[key];
                    if (value === undefined) {
                        value = dir_constant["?"];
                    }
                }
                return value;
            }
        }
        return dir_constant["?"];
    }

    function interpret_script(event, effect) {
        const script = block.value;
        if (typeof(script.length) !== "number" || script.length < 1) {
            return false;  // block script must be an array
        }
        script.forEach(function interpret(stmt) {
            if (stmt.kind !== "script") {
                return false;  // script element required
            }
            if (stmt.value === "commit") {
                return true;
            }
            if (stmt.value === "abort") {
                return false;  // transaction abort
            }
            if (stmt.value === "nothing") {
                /* no effect */
            } else if (stmt.value === "let") {
                /* assign to actor state */
                const value = interpret_expression(stmt.expr, event, effect);
                let key = stmt.name.value;
                state[key] = value;
            } else if (stmt.value === "send") {
                const message = interpret_expression(stmt.message, event, effect);
                const target = interpret_expression(stmt.target, event, effect);
                if (target.kind !== "value" || target.type !== "Actor") {
                    return false;  // target must be an actor
                }
                effect.actor_send(target.address, message);
            } else if (stmt.value === "become") {
                const beh = interpret_expression(stmt.behavior, event, effect);
                let actor;
                if (stmt.state === undefined) {
                    effect.actor_become(new_behavior(ast, beh));
                } else {
                    effect.actor_become(new_behavior(
                        ast,
                        beh,
                        interpret_expression(stmt.state, event, effect)
                    ));
                }
            } else {
                return false;  // unknown script element
            }
        });
        return true;
    }

    return interpret_script;
}

function event_loop(config, limit) {
    while (true) {
        if (typeof(limit) === "number") {
            if (limit > 0) {
                limit -= 1;
            } else {
                break;
            }
        }
        debugger;
        if (!config.step()) {
            break;
        }
    }
    return limit;
}

function debug_beh(event, _) {
    log(event.message);
    return true;
}

// boot:  // {} <- {dev_caps}
//     let debug_dev be @["debug"]
//     send {"answer": 42} to debug_dev
//
// export[boot]
const boot_dir = {
    lang: "Director",
    ast: {
        kind: "module",
        import: {},
        define: {
            "boot": dir_script.block([
                dir_script.let(
                    dir_literal.text("debug_dev"),
                    dir_expression.index(
                        dir_expression.message(),
                        dir_literal.text("debug")
                    )
                ),
                dir_script.send(
                    dir_literal.dict({
                        "answer": dir_literal.number(42)
                    }),
                    dir_expression.variable(
                        dir_literal.text("debug_dev")
                    )
                )
            ])
        },
        export: []
    }
};

function test_boot() {
    function boot_beh(event, effect) {
        const ast = boot_dir.ast;
        const name = "boot";
        const block = ast.define[name];
        const beh = new_behavior(ast, block);
        return beh(event, effect);
    }

    const theater = chasm.new_theater();
    const config = theater.new_config();
    const a_boot = config.actor_create(boot_beh);
    const a_debug = config.actor_create(debug_beh);
    const message = dir_literal.dict({
        "debug": dir_actor(a_debug)
    });
    config.actor_send(a_boot, message);
    event_loop(config);
    log(config);
}

if (import.meta.main) {
    log = function log(...args) {
        globalThis.console.log(...args);
    };

    test_boot();
}
