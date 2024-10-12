// uFork Humus compiler

// Transforms Humus source code into an intermediate representation
// that is suitable for loading.

// The intermediate representation is described in `ir.md`.

/*jslint web, long, white, null */

import gen_json from "https://dalnefre.github.io/humus_js/gen_json.js";
import hum_xlat from "https://dalnefre.github.io/humus_js/hum_xlat.js";

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function resolve(value) {
    return (
        typeof value === "function"
        ? value()
        : value
    );
}

function flatten(ast) {
    if (
        ast.kind === "pair_expr"
        || ast.kind === "pair_ptrn"
        || ast.kind === "stmt_pair"
    ) {
        return [ast.head, ...flatten(ast.tail)];
    }
    return [ast];
}

function unflatten(kind, array) {
    return array.reduceRight(function (tail, head) {
        return {kind, head, tail};
    });
}

//debug flatten(unflatten("pair_expr", [1]));
//debug flatten(unflatten("pair_expr", [1, 2, 3]));

// Parsing /////////////////////////////////////////////////////////////////////

function parse(text) {
    let tokens = [];
    try {
        const cfg = Object.create(null);
        const gen = gen_json(cfg);
        const xlat = hum_xlat(gen);
        tokens = clone(xlat.parse(text));
        let prog = [];
        while (true) {
            const stmt = xlat.compile();
            if (stmt === undefined) {
                break;
            }
            prog.push(clone(stmt));
        }
        return {
            lang: "Humus",
            ast: (
                prog.length > 0
                ? unflatten("stmt_pair", prog)
                : {kind: "empty_stmt"}
            ),
            tokens,
            errors: []
        };
    } catch (exception) {
        let error = exception;
        if (exception.subject !== undefined) {
            error = {
                message: exception.message,
                line: exception.subject.lineno,
                column: exception.subject.start + 1,
                start: exception.subject.start_ofs,
                end: exception.subject.end_ofs
            };
        }
        return {tokens, errors: [error]};
    }
}

// Analysis ////////////////////////////////////////////////////////////////////

function visit(ast, visitors) {
    const visitor = visitors[ast?.kind];
    if (visitor) {
        return visitor(ast, visitors);
    }
}

const default_visitors = Object.freeze({

/*
Statements
{ "kind":"create_stmt", "ident":<string>, "expr":<expression> }
{ "kind":"send_stmt", "msg":<expression>, "to":<expression> }
{ "kind":"become_stmt", "expr":<expression> }
{ "kind":"def_stmt", "ptrn":<pattern>, "expr":<expression> }
{ "kind":"let_stmt", "eqtn":{ "kind":"eqtn", "left":<pattern>, "right":<pattern> }}
{ "kind":"stmt_pair", "head":<statement>, "tail":<statement> }
{ "kind":"empty_stmt" }
{ "kind":"expr_stmt", "expr":<expression> }
{ "kind":"throw_stmt", "expr":<expression> }
*/

    create_stmt(ast, visitors) {
        visit(ast.expr, visitors);
    },
    send_stmt(ast, visitors) {
        visit(ast.msg, visitors);
        visit(ast.to, visitors);
    },
    become_stmt(ast, visitors) {
        visit(ast.expr, visitors);
    },
    def_stmt(ast, visitors) {
        visit(ast.ptrn, visitors);
        visit(ast.expr, visitors);
    },
    let_stmt(ast, visitors) {
        visit(ast.eqtn.left, visitors);
        visit(ast.eqtn.right, visitors);
    },
    stmt_pair(ast, visitors) {
        visit(ast.head, visitors);
        visit(ast.tail, visitors);
    },
    expr_stmt(ast, visitors) {
        visit(ast.expr, visitors);
    },
    throw_stmt(ast, visitors) {
        visit(ast.expr, visitors);
    },

/*
Expressions
{ "kind":"const_expr", "value":<value> }
{ "kind":"ident_expr", "ident":<string> }
{ "kind":"pair_expr", "head":<expression>, "tail":<expression> }
{ "kind":"abs_expr", "ptrn":<pattern>, "body":<expression> }
{ "kind":"app_expr", "abs":<expression>, "arg":<expression> }
{ "kind":"case_expr", "expr":<expression>, "next":<choice/end> }
{ "kind":"case_choice", "ptrn":<pattern>, "expr":<expression>, "next":<choice/end> }
{ "kind":"case_end" }
{ "kind":"if_expr", "eqtn":<equation>, "expr":<expression>, "next":<expression> }
{ "kind":"let_expr", "eqtn":<equation>, "expr":<expression> }
{ "kind":"block_expr", "vars":[...<string>], "stmt":<statement> }
{ "kind":"now_expr" }
{ "kind":"self_expr" }
{ "kind":"new_expr", "expr":<expression> }
*/

    pair_expr(ast, visitors) {
        visit(ast.head, visitors);
        visit(ast.tail, visitors);
    },
    abs_expr(ast, visitors) {
        visit(ast.ptrn, visitors);
        visit(ast.body, visitors);
    },
    app_expr(ast, visitors) {
        visit(ast.abs, visitors);
        visit(ast.arg, visitors);
    },
    case_expr(ast, visitors) {
        visit(ast.expr, visitors);
        visit(ast.next, visitors);
    },
    case_choice(ast, visitors) {
        visit(ast.ptrn, visitors);
        visit(ast.expr, visitors);
        visit(ast.next, visitors);
    },
    if_expr(ast, visitors) {
        visit(ast.eqtn.left, visitors);
        visit(ast.eqtn.right, visitors);
        visit(ast.expr, visitors);
        visit(ast.next, visitors);
    },
    let_expr(ast, visitors) {
        visit(ast.eqtn.left, visitors);
        visit(ast.eqtn.right, visitors);
        visit(ast.expr, visitors);
    },
    block_expr(ast, visitors) {
        visit(ast.stmt, visitors);
    },
    new_expr(ast, visitors) {
        visit(ast.expr, visitors);
    },

/*
Patterns
{ "kind":"const_ptrn", "value":<value> }
{ "kind":"ident_ptrn", "ident":<string> }
{ "kind":"any_ptrn" }
{ "kind":"pair_ptrn", "head":<pattern>, "tail":<pattern> }
{ "kind":"value_ptrn", "expr":<expression> }
*/

    pair_ptrn(ast, visitors) {
        visit(ast.head, visitors);
        visit(ast.tail, visitors);
    },
    value_ptrn(ast, visitors) {
        visit(ast.expr, visitors);
    }
});

function analyze_idents(stmt) {
    let scopes = [];

    function enter_scope() {
        scopes.unshift({
            define: Object.create(null),
            free: Object.create(null)
        });
    }

    function exit_scope() {
        return scopes.shift();
    }

    enter_scope();
    visit(stmt, Object.assign({}, default_visitors, {
        ident_expr(ast) {
            scopes.every(function (scope) {
                if (scope.define[ast.ident] === undefined) {
                    scope.free[ast.ident] = true;
                    return true;
                }
                return false;
            });
        },
        ident_ptrn(ast) {
            scopes[0].define[ast.ident] = true;
        },
        create_stmt(ast, visitors) {
            scopes[0].define[ast.ident] = true;
            visit(ast.expr, visitors);
        },
        abs_expr(ast, visitors) {
            enter_scope();
            visit(ast.ptrn, visitors);
            visit(ast.body, visitors);
            exit_scope();
        },
        if_expr(ast, visitors) {
            enter_scope();
            visit(ast.eqtn.left, visitors);
            visit(ast.eqtn.right, visitors);
            visit(ast.expr, visitors);
            exit_scope();
            visit(ast.next, visitors);
        },
        case_choice(ast, visitors) {
            enter_scope();
            visit(ast.ptrn, visitors);
            visit(ast.expr, visitors);
            exit_scope();
            visit(ast.next, visitors);
        }
    }));
    return exit_scope();
}

function is_independent(node) {
    return node.dependencies.size === 0;
}

function sort_stmts(stmt_array) {

// Eradicate forward references from a sequence of statements by performing
// Kahn's topological sorting algorithm. If this is impossible due to cyclic
// references, return undefined.

    let nodes = stmt_array.map(function (stmt) {
        const analysis = analyze_idents(stmt);
        return {
            stmt,
            define: Object.keys(analysis.define),
            free: Object.keys(analysis.free)
        };
    });
    nodes.forEach(function find_dependencies(a) {
        a.dependencies = new Set(nodes.filter(function (b) {
            return (
                b !== a  // ignore self-reference
                && b.define.some(function (ident) {
                    return a.free.includes(ident);
                })
            );
        }));
    });
    let independents = nodes.filter(is_independent);
    let sorted = [];
    while (independents.length > 0) {
        const a = independents.pop();
        sorted.push(a.stmt);
        let b_nr = 0;
        while (b_nr < nodes.length) {
            const b = nodes[b_nr];
            if (b.dependencies.has(a)) {
                b.dependencies.delete(a);
                if (is_independent(b)) {
                    independents.push(b);
                }
            }
            b_nr += 1;
        }
    }
    if (nodes.every(is_independent)) {
        return sorted;
    }
}

//debug function test_sort_stmts() {
//debug     const text = `
//debug         SEND e TO println
//debug         DEF d AS (
//debug             IF $y = 42 c()
//debug         )
//debug         DEF e AS (
//debug             CASE d OF
//debug             42 : c()
//debug             _ : FALSE
//debug             END
//debug         )
//debug         DEF c AS λ_.b
//debug         DEF b AS a(42)
//debug         DEF a AS λb.b
//debug     `;
//debug     const sorted = sort_stmts(
//debug         flatten(parse(text).ast)
//debug     ).map(function (stmt) {
//debug         return stmt.kind + ":" + stmt.ptrn?.ident;
//debug     });
//debug     if (sorted.join() !== sorted.slice().sort().join()) {
//debug         throw new Error("FAIL sort_stmts\n" + sorted.join("\n"));
//debug     }
//debug }

function to_expr(ptrn) {

// Attempts to convert a pattern to an expression.

    if (ptrn.kind === "const_ptrn") {
        return {
            kind: "const_expr",
            value: ptrn.value,
            debug: ptrn.debug
        };
    }
    if (ptrn.kind === "pair_ptrn") {
        const head_expr = to_expr(ptrn.head);
        const tail_expr = to_expr(ptrn.tail);
        return (
            (head_expr !== undefined && tail_expr !== undefined)
            ? {
                kind: "pair_expr",
                head: head_expr,
                tail: tail_expr,
                debug: ptrn.debug
            }
            : undefined
        );
    }
    if (ptrn.kind === "value_ptrn") {
        return ptrn.expr;
    }
}

function solve(eqtn) {

// Attempts to solve an equation into a pattern and an expression. If
// successful, an array like [ptrn, expr] is returned, otherwise [] is returned.

    const {left, right} = eqtn;
    if (left.kind === "pair_ptrn" && right.kind === "pair_ptrn") {
        const [head_ptrn, head_expr] = solve({
            kind: "eqtn",
            left: left.head,
            right: right.head
        });
        const [tail_ptrn, tail_expr] = solve({
            kind: "eqtn",
            left: left.tail,
            right: right.tail
        });
        return (
            (head_ptrn !== undefined && tail_ptrn !== undefined)
            ? [
                {kind: "pair_ptrn", head: head_ptrn, tail: tail_ptrn},
                {kind: "pair_expr", head: head_expr, tail: tail_expr}
            ]
            : []
        );
    }
    const left_expr = to_expr(left);
    const right_expr = to_expr(right);
    if (right_expr !== undefined) {
        return [left, right_expr];
    }
    if (left_expr !== undefined) {
        return [right, left_expr];
    }
    return [];  // both sides are patterns
}

//debug solve(parse("LET a = 1").ast.eqtn);
//debug solve(parse("LET 1 = a").ast.eqtn);
//debug solve(parse("LET a = b").ast.eqtn);
//debug solve(parse("LET a = 1, 2").ast.eqtn);
//debug solve(parse("LET a, 666 = 777, b").ast.eqtn);
//debug solve(parse("LET a, b, c = 1, $(c, d)").ast.eqtn);
//debug solve(parse("LET a, 2, c = 1, b, 3, 4, 5").ast.eqtn);

// Code generation /////////////////////////////////////////////////////////////

function depths(env) {
    return (
        env.kind === "pair_ptrn"
        ? [env.depth, ...depths(env.tail)]
        : []
    );
}

function nth(ast, n) {
    return (
        n === 0
        ? ast
        : (
            n === 1
            ? ast.head
            : nth(ast.tail, (
                n > 0
                ? n - 1
                : n + 1
            ))
        )
    );
}

function search(ptrn, ident) {
    if (ptrn.kind === "ident_ptrn") {
        if (ptrn.ident === ident) {
            return [];  // found
        }
    } else if (ptrn.kind === "pair_ptrn") {
        const head = search(ptrn.head, ident);
        if (head !== undefined) {
            return [1, ...head];
        }
        if (
            ptrn.def_abs_ptrn?.kind === "ident_ptrn"
            && ptrn.def_abs_ptrn.ident === ident
        ) {
            return [-1];  // found closure env
        }
        const tail = search(ptrn.tail, ident);
        if (tail !== undefined) {
            if (tail.length > 0) {

// Squash eligible instruction sequences into a single instruction, for example:

//      nth -1      nth -1
//      nth -1      nth -1
//      nth -1      nth -1
//      nth 1       nth -1
//        |           |
//        v           v
//      nth 4      nth -4

                if (tail[0] < 0) {
                    tail[0] -= 1;
                    return tail;
                }
                if (tail[0] > 0) {
                    tail[0] += 1;
                    return tail;
                }
            }
            return [-1, ...tail];
        }
    }
}

//debug function test_search() {
//debug     const test_ptrn = {
//debug         kind: "pair_ptrn",
//debug         head: {
//debug             kind: "pair_ptrn",
//debug             head: {kind: "ident_ptrn", ident: "a"},
//debug             tail: {kind: "ident_ptrn", ident: "b"}
//debug         },
//debug         tail: {
//debug             kind: "pair_ptrn",
//debug             head: {kind: "ident_ptrn", ident: "c"},
//debug             tail: {
//debug                 kind: "pair_ptrn",
//debug                 head: {kind: "ident_ptrn", ident: "d"},  // shadowed
//debug                 tail: {kind: "ident_ptrn", ident: "_"}
//debug             },
//debug             def_abs_ptrn: {kind: "ident_ptrn", ident: "d"}
//debug         }
//debug     };
//debug     ["a", "b", "c"].forEach(function (ident) {
//debug         const nth_imms = search(test_ptrn, ident);
//debug         const ptrn = nth_imms.reduce(nth, test_ptrn);
//debug         if (ident !== ptrn.ident) {
//debug             throw new Error("FAIL search " + ident);
//debug         }
//debug     });
//debug     if (search(test_ptrn, "d").join() !== "-2") {
//debug         throw new Error("FAIL search d");
//debug     }
//debug }

function stack_delta(op, imm) {
    if (
        op === "push"
        || op === "pick"
        || op === "msg"
        || (op === "my" && imm === "self")
    ) {
        return 1;
    }
    if (
        (op === "alu" && imm !== "not")
        || op === "assert"
        || op === "cmp"
        || (op === "dict" && imm === "get")
        || (op === "end" && imm === "abort")
        || op === "if"
        || op === "jump"
        || (op === "new" && imm === -1)
    ) {
        return -1;
    }
    if (
        (op === "send" && imm === -1)
        || (op === "beh" && imm === -1)
    ) {
        return -2;
    }
    if (op === "dup" || op === "part") {
        return imm;
    }
    if (op === "drop" || op === "pair") {
        return -imm;
    }
    if (
        op === "debug"
        || op === "eq"
        || op === "nth"
        || op === "roll"
        || op === "typeq"
    ) {
        return 0;
    }
    if (op === "quad") {
        return (
            imm > 0
            ? 1
            : -1
        ) - imm;
    }
    throw new Error("'" + op + " " + imm + "' not supported.");
}

function ir_debug(ast, src) {
    const first = ast.debug?.first;
    const last = ast.debug?.last;
    if (first !== undefined) {
        let debug = {
            start: first.start_ofs,
            end: last?.start_ofs ?? first.end_ofs
        };
        if (src !== undefined) {
            debug.src = src;
        }
        return debug;
    }
}

function ir_lit(value) {
    return {
        kind: "literal",
        value
    };
}

function ir_pair(head, tail) {
    return {
        kind: "pair",
        head,
        tail
    };
}

function ir_type(name) {
    return {
        kind: "type",
        name
    };
}

function ir_quad(t, x, y, z) {
    let value = {
        kind: "quad",
        t
    };
    if (x !== undefined) {
        value.x = x;
        if (y !== undefined) {
            value.y = y;
            if (z !== undefined) {
                value.z = z;
            }
        }
    }
    return value;
}

function ir_ref(name, module) {
    return {
        kind: "ref",
        module,  // optional
        name
    };
}

const empty_env_ptrn = {kind: "any_ptrn"};
const error_bundle = {
    defined_a: "'{a}' was already defined.",
    bad_eqtn: "Bad equation.",
    bad_kind_a: "Bad token kind '{a}'.",
    bad_ptrn_a: "Bad pattern kind '{a}'.",
    bad_value_a: "Bad value '{a}'.",
    expected_a_b: "Expected {a} and saw {b}.",
    not_expr_a: "'{a}' is not an expression.",
    undefined_a: "'{a}' was not defined."
};

function codegen(crlf, src) {
    let counter = -1;
    let definitions = Object.create(null);
    let env = empty_env_ptrn;
    let errors = [];  // error reporting bucket
    let kind_map;
    let symbols = Object.create(null);

    const imports = {
        "$dev": "https://ufork.org/lib/dev.asm",
        "$hum": "https://ufork.org/lib/hum.asm",
        "$std": "https://ufork.org/lib/std.asm"
    };
    const ir_false = ir_lit("false");
    const ir_true = ir_lit("true");
    const ir_nil = ir_lit("nil");
    const ir_undef = ir_lit("undef");
    const ir_pair_t = ir_type("pair");
    const commit = ir_ref("commit", "$std");
    const abs_return = ir_ref("return", "$hum");
    const execute_block = ir_ref("execute_block", "$hum");
    const beh = ir_ref("beh", "$hum");
    const call = ir_ref("call", "$hum");
    const make_block = ir_ref("make_block", "$hum");
    const make_closure = ir_ref("make_closure", "$hum");
    const prepare_env = ir_ref("prepare_env", "$hum");
    const self_tail = ir_ref("self_tail_call", "$hum");
    const symbol_t = ir_ref("symbol_t", "$hum");
    const tail_call = ir_ref("tail_call", "$hum");
    const primitives = {
        eq: ir_ref("eq", "$hum"),
        not: ir_ref("not", "$hum"),
        and: ir_ref("and", "$hum"),
        or: ir_ref("or", "$hum"),
        is_boolean: ir_ref("is_boolean", "$hum"),
        is_number: ir_ref("is_number", "$hum"),
        is_function: ir_ref("is_function", "$hum"),
        is_actor: ir_ref("is_actor", "$hum"),
        is_pair: ir_ref("is_pair", "$hum"),
        neg: ir_ref("neg", "$hum"),
        add: ir_ref("add", "$hum"),
        sub: ir_ref("sub", "$hum"),
        mul: ir_ref("mul", "$hum"),
        div: ir_ref("div", "$hum"),
        mod: ir_ref("mod", "$hum"),
        compare: ir_ref("compare", "$hum"),
        less: ir_ref("less", "$hum"),
        less_equal: ir_ref("less_equal", "$hum"),
        greater: ir_ref("greater", "$hum"),
        greater_equal: ir_ref("greater_equal", "$hum")
    };

    function unique_label() {
        counter += 1;

// The $ character is forbidden in Humus identifiers, so we embed it in
// autogenerated labels to avoid naming conflicts.

        return "$" + counter;
    }

    function intern(ast, hint) {

// Registers the 'ast' as a definition (if necessary) and returns its ref.

        if (ast.kind === "ref") {
            return ast;
        }
        const name = unique_label() + ":" + hint;
        definitions[name] = ast;
        return ir_ref(name);
    }

    function env_at() {
        const n = env.depth;
        if (!Number.isSafeInteger(n) || n <= 0) {
            throw new Error("Bad depth " + n + ".");
        }
        return n;
    }

    function env_to() {
        return -env_at();
    }

    function push_env(ptrn, depth = 0) {
        env = {
            kind: "pair_ptrn",
            head: ptrn,
            tail: env,
            depth
        };
    }

    function pop_env() {
        const ptrn = env.head;
        env = env.tail;
        return ptrn;
    }

    function record_stack_effect(op, imm) {

// Record the change in stack depth caused by execution of the instruction,
// assuming no underflow.

        const delta = stack_delta(op, imm);

// The delta is negated because instructions are generated in reverse order.
// Oddly, this requires us to envision the stack's evolution in reverse.

        env.depth -= delta;

// Enable the following fragment to debug stack depth inconsistencies.

//debug if (false) {
//debug     const imm_summary = resolve(imm)?.kind ?? resolve(imm);
//debug     console.log(depths(env), op, imm_summary, `(${delta})`);
//debug }

    }

    function fudge(delta, k) {
        env.depth -= delta;
        return k;
    }

    function error(code, ast, a, b) {
        let the_error = {
            kind: "error",
            code,
            message: error_bundle[code].replace("{a}", a).replace("{b}", b)
        };
        const first = ast.debug?.first;
        if (first !== undefined) {
            the_error.line = first.line;
            the_error.column = first.start + 1;
            the_error.start = first.start_ofs;
            the_error.end = first.end_ofs;
        }
        const last = ast.debug?.last;
        if (last !== undefined) {
            the_error.end = last.start_ofs;
        }
        if (src !== undefined) {
            the_error.src = src;
        }
        errors.push(the_error);
    }

    function ir_const(ast) {
        const value = ast.value;
        if (Number.isSafeInteger(value)) {
            return value;
        }
        if (value === true) {
            return ir_lit("true");
        }
        if (value === false) {
            return ir_lit("false");
        }
        if (value === null) {
            return ir_lit("undef");
        }
        if (typeof value === "object") {
            return (function stringify(pair) {
                return (
                    Number.isSafeInteger(pair.hd)
                    ? ir_pair(pair.hd, stringify(pair.tl))
                    : ir_lit("nil")
                );
            }(value));
        }
        if (typeof value === "string") {
            if (symbols[value] === undefined) {
                const label = "#" + value;
                const code_points = Array.from(value).map(function (glyph) {
                    return glyph.codePointAt(0);
                });
                const list_of_code_points = unflatten(
                    "pair",
                    code_points.concat(ir_nil)
                );
                definitions[label] = ir_quad(symbol_t, list_of_code_points);
                symbols[value] = ir_ref(label);
            }
            return symbols[value];
        }
        return error("bad_value_a", ast, value);
    }

    function ir_instr(debug_ast, op, imm, k) {
        record_stack_effect(op, imm);
        return {
            kind: "instr",
            op,
            imm: resolve(imm),
            k,
            debug: ir_debug(debug_ast, src)
        };
    }

    function ir_call(debug_ast, nr_args, nr_returns) {
        record_stack_effect("jump");
        const delta = nr_returns - (nr_args + 1);  // ( arg* k -- rv* )
        return fudge(delta, {
            kind: "instr",
            op: "jump",
            debug: ir_debug(debug_ast, src)
        });
    }

    function ir_if_instr(debug_ast, gen_t, gen_f, abort_branch) {

// Both branches of an 'if' instruction must cause the same change in stack
// depth, otherwise our scheme of predicting stack evolution in reverse is
// doomed. To be safe, we compare the stack depths resulting from the
// generation of each branch. Our invariant holds when they are the same, or
// when one branch is known to abort.

        const checkpoint = env.depth;       // store the initial stack depth
        const t = gen_t();                  // generate the true branch
        const t_depth = env.depth;          // store the changed stack depth
        env.depth = checkpoint;             // undo the change
        const f = gen_f();                  // generate the false branch
        const f_depth = env.depth;
        if (typeof abort_branch === "boolean") {
            env.depth = (
                abort_branch
                ? f_depth
                : t_depth
            );
        } else if (t_depth !== f_depth && errors.length === 0) {
            throw new Error("Stack depth mismatch in branches.");
        }
        record_stack_effect("if");
        return {
            kind: "instr",
            op: "if",
            t,
            f,
            debug: ir_debug(debug_ast, src)
        };
    }

    function ir_nth_instrs(debug_ast, nth_imms, k) {
        return nth_imms.reduceRight(function (k, nth_imm) {
            return ir_instr(debug_ast, "nth", nth_imm, k);
        }, k);
    }

    function ir_replace_false(debug_ast, k) {
        k =                                             // value
            ir_instr(debug_ast, "drop", 1,              // --
            ir_instr(debug_ast, "push", ir_false,       // #f
            k));
        return k;
    }

    function redefinition_check(ptrn) {
        let seen = [];
        visit(ptrn, Object.assign({}, default_visitors, {
            ident_ptrn(ast) {
                if (seen.includes(ast.ident)) {
                    error("defined_a", ast, ast.ident);
                }
                seen.push(ast.ident);
            }
        }));
    }

    function generate(ast, k) {
        return (
            Object.hasOwn(kind_map, ast.kind)
            ? kind_map[ast.kind](ast, k)
            : error("bad_kind_a", ast, ast.kind)
        );
    }

    function gen_block_code(ast) {
        const sorted = sort_stmts(flatten(ast));
        if (sorted !== undefined) {
            ast = unflatten("stmt_pair", sorted);
        }
        push_env(empty_env_ptrn, -1);

// Because code for the last statement is generated first, the static
// environment must initially be extended with every definition in the block.

        flatten(ast).forEach(function (stmt) {
            let def_ptrn;
            if (stmt.kind === "def_stmt") {
                def_ptrn = stmt.ptrn;
            } else if (stmt.kind === "let_stmt") {
                def_ptrn = solve(stmt.eqtn)[0];
            } else if (stmt.kind === "create_stmt") {
                def_ptrn = {
                    kind: "ident_ptrn",
                    ident: stmt.ident,
                    debug: stmt.debug
                };
            }
            if (def_ptrn !== undefined) {
                visit(def_ptrn, Object.assign({}, default_visitors, {
                    ident_ptrn(ast) {
                        if (search(env.head, ast.ident) !== undefined) {
                            error("defined_a", ast, ast.ident);
                        }
                    }
                }));
                env.head = {
                    kind: "pair_ptrn",
                    head: def_ptrn,
                    tail: env.head
                };
            }
        });
        const code =                                    // k env
            ir_instr(ast, "push", ir_undef,             // k env #?
            ir_instr(ast, "pair", 1,                    // k env'=(#? . env)
            generate(ast,                               // k env'
            ir_instr(ast, "drop", 1,                    // k
            ir_instr(ast, "jump")))));                  // --
        pop_env();
        return code;
    }

    function gen_block_expr(ast, k) {
        const code = gen_block_code(ast.stmt);
        k =                                             // env ...
            ir_instr(ast, "pick", env_at,               // env ... env
            ir_instr(ast, "push", code,                 // env ... env code
            ir_instr(ast, "push", k,                    // env ... env code k
            ir_instr(ast, "push", make_block,           // env ... env code k make_block
            ir_call(ast, 2, 1)))));                     // env ... block
        return k;
    }

    function gen_ptrn_match(ast, k) {
        if (ast.kind === "any_ptrn" || ast.kind === "ident_ptrn") {
            k =                                         // value
                ir_instr(ast, "drop", 1,                // --
                ir_instr(ast, "push", ir_true,          // #t
                k));
            return k;
        }
        if (ast.kind === "pair_ptrn") {
            k = intern(k, "ptrn_match_k");
            k =                                         // value
                ir_instr(ast, "dup", 1,                 // value value
                ir_instr(ast, "typeq", ir_pair_t,       // value pair?
                ir_if_instr(
                    ast,
                    () =>                               // value=(a . b)
                        ir_instr(ast, "part", 1,        // b a
                        gen_ptrn_match(ast.head,        // b a_ok
                        ir_if_instr(
                            ast,
                            () =>                       // b
                                gen_ptrn_match(ast.tail,// b_ok
                                k),
                            () =>                       // b
                                ir_replace_false(ast,   // #f
                                k)))),
                    () =>                               // value
                        ir_replace_false(ast,           // #f
                        k))));
            return k;
        }
        if (ast.kind === "const_ptrn") {
            k =                                         // value
                ir_instr(ast, "eq", ir_const(ast),      // value==const
                k);
            return k;
        }
        if (ast.kind === "value_ptrn") {
            k =                                         // value
                generate(ast.expr,                      // value $value
                ir_instr(ast, "cmp", "eq",              // value==$value
                k));
            return k;
        }
        return error("bad_ptrn_a", ast, ast.kind);
    }

    function gen_abs_expr(ast, k) {
        redefinition_check(ast.ptrn);

// Prepare a label for the compiled closure's code. Incorporate the closure's
// identifier if it has one.

        const def_ptrn = env.def_ptrn;
        const name = def_ptrn?.ident ?? "?";
        const label = unique_label() + ":" + name;

// Compile the closure's code.

        push_env(ast.ptrn, 2);
        if (def_ptrn?.kind === "ident_ptrn") {
            env.abs_label = label;
        }
        env.def_abs_ptrn = def_ptrn;
        definitions[label] =                            // args k env
            ir_instr(ast.body, "roll", 3,               // k env args
            ir_instr(ast.body, "pair", 1,               // k env'=(args . env)
            ir_instr(ast.body, "dup", 1,                // k env' env'
            ir_instr(ast.body, "nth", 1,                // k env' args
            gen_ptrn_match(ast.ptrn,                    // k env' match?
            ir_if_instr(                                // k env'
                ast.body,
                () =>
                    generate(ast.body,                  // k env' rv
                    abs_return),                        // rv
                () =>
                    ir_instr(ast.body, "push", ir_undef,// k env' #?
                    abs_return)))))));                  // rv=#?
        delete env.def_abs_ptrn;
        delete env.abs_label;
        pop_env();

// A closure is constructed from its compiled code and its environment.

        k =                                             // env ...
            ir_instr(ast.body, "push", ir_ref(label),   // env ... code
            ir_instr(ast.body, "pick", env_at,          // env ... code env
            ir_instr(ast.body, "push", k,               // env ... code env k
            ir_instr(ast.body, "push", make_closure,    // env ... code env k make_closure
            ir_call(ast.body, 2, 1)))));                // env ... closure
        return k;
    }

    function gen_app_expr(ast, k) {

// Optimize tail calls.

        if (k === abs_return) {

// Recursive tail calls are a special case. With the called closure's code known
// in advance, and its environment on the stack, we can skip gen_ident_expr's
// dynamic creation of a closure and jump straight to the code.

            if (ast.abs.kind === "ident_expr") {
                const nth_imms = search(env, ast.abs.ident);
                if (nth_imms !== undefined && nth_imms[0] < 0) {
                    const label = nth(env, nth_imms[0] + 1).abs_label;
                    const code = ir_ref(label);
                    k =                                 // k env
                        ir_instr(ast, "dup", 1,         // k env env
                        ir_nth_instrs(ast, nth_imms,    // k env env'
                        ir_instr(ast, "push", code,     // k env env' code
                        generate(ast.arg,               // k env env' code args
                        fudge(-2, self_tail)))));       // args k env'
                    return k;
                }
            }
            k =                                         // k env
                generate(ast.abs,                       // k env procedure
                generate(ast.arg,                       // k env procedure args
                fudge(-1, tail_call)));                 // rv
            return k;
        }

// Otherwise obtain the procedure (usually a closure) as a value and call it.

        k =
            generate(ast.arg,                           // args
            ir_instr(ast, "push", k,                    // args k
            generate(ast.abs,                           // args k procedure
            fudge(-2, call))));                         // rv
        return k;
    }

    function gen_case_choice_expr(ast, k) {
        push_env(ast.ptrn, 1);
        k =                                                     // env ... value
            ir_instr(ast.ptrn, "pick", () => env.tail.depth,    // env ... value env
            ir_instr(ast.ptrn, "roll", 2,                       // env ... env value
            ir_instr(ast.ptrn, "pair", 1,                       // env ... env'=(value . env)
            generate(ast.expr,                                  // env ... env' result
            ir_instr(ast.ptrn, "roll", 2,                       // env ... result env'
            ir_instr(ast.ptrn, "drop", 1,                       // env ... result
            k))))));
        pop_env();
        return k;
    }

    function gen_case_choice(ast, k) {
        if (ast.kind === "case_end") {
            k =                                         // value
                ir_instr(ast, "drop", 1,                // --
                ir_instr(ast, "push", ir_undef,         // result=#?
                k));
            return k;
        }
        redefinition_check(ast.ptrn);
        k = intern(k, "case_choice_k");
        k =                                             // value
            ir_instr(ast.ptrn, "dup", 1,                // value value
            gen_ptrn_match(ast.ptrn,                    // value match?
            ir_if_instr(
                ast.ptrn,
                () =>                                   // value
                    gen_case_choice_expr(ast,           // result
                    k),
                () =>                                   // value
                    gen_case_choice(ast.next,           // result
                    k))));
        return k;
    }

    function gen_case_expr(ast, k) {
        k =
            generate(ast.expr,                          // value
            gen_case_choice(ast.next,                   // result
            k));
        return k;
    }

    function gen_const_expr(ast, k) {
        k = ir_instr(ast, "push", ir_const(ast),        // value
            k);
        return k;
    }

    function gen_ident_expr(ast, k) {
        if (ast.ident === "_") {
            return error("not_expr_a", ast, ast.ident);
        }

// Search the environment for a match.

        const nth_imms = search(env, ast.ident);
        if (nth_imms === undefined) {
            if (Object.hasOwn(primitives, ast.ident)) {
                k =
                    ir_instr(ast, "push", primitives[ast.ident],    // procedure
                    k);
                return k;
            }
            return error("undefined_a", ast, ast.ident);
        }

// A closure may have referenced itself by name. Due to the immutability of
// quads, a circular reference is impossible. The best we can do is create an
// equivalent closure on demand.

        if (nth_imms[0] < 0) {
            const label = nth(env, nth_imms[0] + 1).abs_label;
            k =                                         // env ...
                ir_instr(ast, "push", ir_ref(label),    // env ... code env
                ir_instr(ast, "pick", env_at,           // env ... code env
                ir_nth_instrs(ast, nth_imms,            // env ... code abs_env
                ir_instr(ast, "push", k,                // env ... code abs_env k
                ir_instr(ast, "push", make_closure,     // env ... code abs_env k make_closure
                ir_call(ast, 2, 1))))));                // env ... closure
            return k;
        }

// Retrieve the value from the environment.

        k =                                             // env ...
            ir_instr(ast, "pick", env_at,               // env ... env
            ir_nth_instrs(ast, nth_imms,                // env ... value
            k));
        return k;
    }

    function gen_if_expr(ast, k) {
        const [ptrn, expr] = solve(ast.eqtn);
        if (ptrn === undefined) {
            return error("bad_eqtn", ast);  // should be ast.eqtn
        }
        redefinition_check(ptrn);
        k =
            ir_instr(ast, "pick", env_at,               // env
            generate(expr,                              // env args
            ir_instr(ast, "dup", 1,                     // env args args
            gen_ptrn_match(ptrn,                        // env args match?
            ir_if_instr(
                ast,
                function gen_t() {
                    const outer_code =
                        ir_instr(ast, "roll", -2,       // value env'
                        ir_instr(ast, "drop", 1,        // value
                        k));
                    push_env(ptrn, 2);
                    const inner_code =                  // env args
                        ir_instr(ast, "pair", 1,        // env'=(args . env)
                        generate(ast.expr,              // env' value
                        outer_code));
                    pop_env();
                    return inner_code;
                },
                function gen_f() {
                    const code =                        // env args
                        ir_instr(ast, "drop", 2,        // --
                        generate(ast.next,              // value
                        k));
                    return code;
                }
            )))));
        return k;
    }


    function gen_new_expr(ast, k) {
        k =
            generate(ast.expr,                          // closure
            ir_instr(ast, "push", beh,                  // closure beh
            ir_instr(ast, "new", -1,                    // actor=beh.closure
            k)));
        return k;
    }

    function gen_pair_expr(ast, k) {
        const elements = flatten(ast);

// If the expression is part of a DEF statement, destructure the pattern in
// tandem with the expression. This lets us associate expressions with
// identifiers.

        const def_ptrn = env.def_ptrn;
        const sub_ptrns = (
            def_ptrn !== undefined
            ? flatten(def_ptrn)
            : []
        );
        k = ir_instr(ast, "pair", elements.length - 1,
            k);
        elements.forEach(function (element, element_nr) {
            env.def_ptrn = sub_ptrns[element_nr];
            k = generate(element, k);
        });
        env.def_ptrn = def_ptrn;
        return k;
    }

    function gen_self_expr(ast, k) {
        k = ir_instr(ast, "my", "self",
            k);
        return k;
    }

    function gen_become_stmt(ast, k) {
        k =
            generate(ast.expr,                          // state=closure
            ir_instr(ast, "push", beh,                  // state beh
            ir_instr(ast, "beh", -1,                    // --
            k)));
        return k;
    }

    function gen_def_stmt(ast, k) {
        redefinition_check(ast.ptrn);

// Let the definition fall out of scope. Remember that we are working our way up
// the AST, building the instruction sequence in reverse. The definition, added
// earlier to the static environment by 'gen_block_code', should be
// inaccessible to preceeding statements.

        env.head = env.head.tail;

// In constrast, execution proceeds in the forward direction. Here we extend the
// dynamic environment, making the definition accessible to succeeding
// statements.

        env.def_ptrn = ast.ptrn;
        k =                                             // env ...
            ir_instr(ast, "pick", env_at,               // env ... env
            ir_instr(ast, "part", 1,                    // env ... rest scope
            generate(ast.expr,                          // env ... rest scope value
            ir_instr(ast, "dup", 1,                     // env ... rest scope value value
            gen_ptrn_match(ast.ptrn,                    // env ... rest scope value match?
            ir_if_instr(
                ast,
                () =>                                   // env ... rest scope value
                    ir_instr(ast, "pair", 1,            // env ... rest (value . scope)
                    ir_instr(ast, "pair", 1,            // env ... env'=((value . scope) . rest)
                    ir_instr(ast, "roll", env_at,       // ... env' env
                    ir_instr(ast, "drop", 1,            // ... env'
                    ir_instr(ast, "roll", env_to,       // env' ...
                    k))))),
                () =>                                   // env ... rest scope value
                    ir_instr(ast, "drop", 3,            // env ...
                    ir_instr(ast, "push", ir_undef,     // env ... reason=#?
                    ir_instr(ast, "end", "abort"))),
                false
            ))))));
        delete env.def_ptrn;
        return k;
    }

    function gen_create_stmt(ast, k) {
        env.head = env.head.tail;
        k =
            ir_instr(ast, "pick", env_at,               // env ... env
            ir_instr(ast, "part", 1,                    // env ... rest scope
            generate(ast.expr,                          // env ... rest scope closure
            ir_instr(ast, "push", beh,                  // env ... rest scope closure beh
            ir_instr(ast, "new", -1,                    // env ... rest scope actor=beh.closure
            ir_instr(ast, "pair", 1,                    // env ... rest (actor . scope)
            ir_instr(ast, "pair", 1,                    // env ... env'=((actor . scope) . rest)
            ir_instr(ast, "roll", env_at,               // ... env' env
            ir_instr(ast, "drop", 1,                    // ... env'
            ir_instr(ast, "roll", env_to,               // env' ...
            k))))))))));
        return k;
    }

    function gen_empty_stmt(_, k) {
        return k;
    }

    function gen_expr_stmt(ast, k) {

// If the value is a block, execute it. Otherwise drop the value.

        k = generate(ast.expr,                          // value
            ir_instr(ast, "push", k,                    // value k
            ir_instr(ast, "push", execute_block,        // value k execute_block
            ir_call(ast, 1, 0))));                      // --
        return k;
    }

    function gen_let_stmt(ast, k) {

// A LET statement is rewritten to its equivalent DEF AS statement.

        const [ptrn, expr] = solve(ast.eqtn);
        if (ptrn === undefined) {
            return error("bad_eqtn", ast);
        }
        ast = {
            kind: "def_stmt",
            ptrn,
            expr,
            debug: ast.debug
        };
        return gen_def_stmt(ast, k);
    }

    function gen_send_stmt(ast, k) {
        k = generate(ast.msg,                           // msg
            generate(ast.to,                            // msg actor
            ir_instr(ast, "send", -1,                   // ...
            k)));
        return k;
    }

    function gen_stmt_pair(ast, k) {
        k = generate(ast.head,
            generate(ast.tail,
            k));
        return k;
    }

    function gen_throw_stmt(ast, _) {
        const code =
            generate(ast.expr,                          // reason
            ir_instr(ast, "end", "abort"));             // --
        return code;
    }

    kind_map = {
        "abs_expr": gen_abs_expr,
        "app_expr": gen_app_expr,
        "block_expr": gen_block_expr,
        "case_expr": gen_case_expr,
        "const_expr": gen_const_expr,
        "if_expr": gen_if_expr,
        "become_stmt": gen_become_stmt,
        "create_stmt": gen_create_stmt,
        "def_stmt": gen_def_stmt,
        "empty_stmt": gen_empty_stmt,
        "expr_stmt": gen_expr_stmt,
        "ident_expr": gen_ident_expr,
        "let_stmt": gen_let_stmt,
        "new_expr": gen_new_expr,
        "pair_expr": gen_pair_expr,
        "self_expr": gen_self_expr,
        "send_stmt": gen_send_stmt,
        "stmt_pair": gen_stmt_pair,
        "throw_stmt": gen_throw_stmt
    };
    if (crlf.lang !== "Humus") {
        error("expected_a_b", crlf, "Humus/CRLF", crlf.lang);
    }

// The top level is compiled as a block capturing builtins in its environment.

    push_env(unflatten("pair_ptrn", [
        {kind: "ident_ptrn", ident: "svgout"},
        {kind: "ident_ptrn", ident: "clock"},
        {kind: "ident_ptrn", ident: "stdio"},
        {kind: "ident_ptrn", ident: "random"},
        {kind: "ident_ptrn", ident: "timer"},
        {kind: "ident_ptrn", ident: "println"}
    ]));
    const block = gen_block_code(crlf.ast);
    definitions.boot =
        ir_instr(crlf.ast, "push", commit,          // commit
        ir_instr(crlf.ast, "push", block,           // commit block
        ir_instr(crlf.ast, "push", prepare_env,     // commit block prepare_env
        ir_call(crlf.ast, 0, 1))));                 // commit env
    pop_env();
    if (env !== empty_env_ptrn) {
        throw new Error("Corrupt env.");
    }
    return {
        lang: "uFork",
        ast: {
            kind: "module",
            import: imports,
            define: definitions,
            export: ["boot"]
        },
        tokens: crlf.tokens,
        errors
    };
}

function compile(text, src) {
    const ast = parse(text);
    if (ast.errors.length > 0) {
        return ast;
    }
    return codegen(ast, src);
}

//debug import ufork from "https://ufork.org/js/ufork.js";
//debug import random_dev from "https://ufork.org/js/random_dev.js";
//debug import timer_dev from "https://ufork.org/js/timer_dev.js";
//debug import base64 from "./base64.js";
//debug import gzip from "./gzip.js";
//debug import parseq from "./parseq.js";
//debug import requestorize from "./rq/requestorize.js";
//debug import unpromise from "./rq/unpromise.js";
//debug import assemble from "./assemble.js";
//debug import disassemble from "./disassemble.js";
//debug const wasm = import.meta.resolve("https://ufork.org/wasm/ufork.wasm");
//debug const lib_href = import.meta.resolve("./");
//debug const debug_href = import.meta.resolve("../apps/debugger/index.html");
//debug const src_href = lib_href + "humus.js.hum";
//debug function run(text) {
//debug     let logs = [];
//debug     let prints = [];
//debug     const core = ufork.make_core({
//debug         wasm_url: wasm,
//debug         log_level: ufork.LOG_DEBUG,
//debug         on_log(log_level, value) {
//debug             logs.push(["LOG:", log_level, value]);
//debug             if (log_level === ufork.LOG_DEBUG) {
//debug                 prints.push(value);
//debug             }
//debug         },
//debug         import_map: {"https://ufork.org/lib/": lib_href},
//debug         compilers: {asm: assemble, hum: compile}
//debug     });
//debug     return parseq.sequence([
//debug         core.h_initialize(),
//debug         core.h_import(src_href, compile(text)),
//debug         requestorize(function (imported_module) {
//debug             random_dev(core);
//debug             timer_dev(core, 1);
//debug             core.h_boot(imported_module.boot);
//debug             while (true) {
//debug                 const status = core.h_run_loop(1);
//debug                 if (
//debug                     status !== ufork.UNDEF_RAW // step limit not reached
//debug                     && status !== core.u_fixnum(ufork.E_MEM_LIM)
//debug                     && status !== core.u_fixnum(ufork.E_CPU_LIM)
//debug                     && status !== core.u_fixnum(ufork.E_MSG_LIM)
//debug                 ) {
//debug                     const message = core.u_fault_msg(
//debug                         core.u_fix_to_i32(status)
//debug                     );
//debug                     if (status === core.u_fixnum(ufork.E_OK)) {
//debug                         logs.push(["IDLE:", message]);
//debug                     } else {
//debug                         logs.push(["FAULT:", message]);
//debug                     }
//debug                     break;
//debug                 }
//debug             }
//debug             return {logs, prints};
//debug         })
//debug     ]);
//debug }
//debug function generate_debug_url(text) {
//debug     return unpromise(function () {
//debug         return gzip.encode(
//debug             text
//debug         ).then(
//debug             base64.encode
//debug         ).then(function (compressed_text) {
//debug             const debug_url = new URL(debug_href);
//debug             debug_url.searchParams.set("src", src_href);
//debug             debug_url.searchParams.set("text", compressed_text);
//debug             return debug_url.href;
//debug         });
//debug     });
//debug }
//debug function log_ir(text) {
//debug     const ir = compile(text);
//debug     console.log(JSON.stringify(ir, undefined, 4));
//debug }
//debug function log_asm(text) {
//debug     const ir = compile(text);
//debug     console.log(disassemble(ir));
//debug }
//debug function good(log_level, description, text, expected_prints) {
//debug     if (log_level >= ufork.LOG_TRACE) {
//debug         log_ir(text);
//debug         log_asm(text);
//debug     }
//debug     const ir = compile(text);
//debug     if (ir.errors.length > 0) {
//debug         console.log("FAIL", description);
//debug         if (log_level >= ufork.LOG_DEBUG) {
//debug             ir.errors.forEach(function (error) {
//debug                 console.log("  - " + error.message);
//debug             });
//debug         }
//debug         if (log_level >= ufork.LOG_TRACE) {
//debug             log_ir(text);
//debug             log_asm(text);
//debug         }
//debug     } else if (expected_prints !== undefined) {
//debug         const time_limit = 1000;
//debug         let timeout = setTimeout(function () {
//debug             console.log("LOST", description);
//debug             timeout = undefined;
//debug         }, time_limit);
//debug         parseq.parallel(
//debug             [generate_debug_url(text)],
//debug             [run(text)],
//debug             time_limit,
//debug             true
//debug         )(function (value, reason) {
//debug             if (value === undefined) {
//debug                 return console.log(reason);
//debug             }
//debug             if (timeout === undefined) {
//debug                 return;  // too late
//debug             }
//debug             clearTimeout(timeout);
//debug             const [debug_url, report] = value;
//debug             if (log_level >= ufork.LOG_TRACE) {
//debug                 console.log("DEBUG:", debug_url);
//debug             }
//debug             if (!Array.isArray(expected_prints)) {
//debug                 expected_prints = [expected_prints];
//debug             }
//debug             if (
//debug                 report === undefined
//debug                 || report.prints.length !== expected_prints.length
//debug                 || !report.prints.every(function (print, print_nr) {
//debug                     return print.endsWith(expected_prints[print_nr]);
//debug                 })
//debug             ) {
//debug                 console.log("FAIL", description);
//debug                 if (
//debug                     log_level >= ufork.LOG_DEBUG
//debug                     && report !== undefined
//debug                 ) {
//debug                     report.logs.forEach(function (entry) {
//debug                         console.log("  -", ...entry);
//debug                     });
//debug                 }
//debug             } else {
//debug                 if (log_level >= ufork.LOG_WARN) {
//debug                     console.log("OK", description);
//debug                 }
//debug             }
//debug         });
//debug     } else if (log_level >= ufork.LOG_WARN) {
//debug         console.log("OK", description);
//debug     }
//debug }
//debug function bad(log_level, description, text) {
//debug     if (log_level >= ufork.LOG_TRACE) {
//debug         log_ir(text);
//debug         log_asm(text);
//debug     }
//debug     const ir = compile(text);
//debug     if (ir.errors.length > 0) {
//debug         if (log_level >= ufork.LOG_WARN) {
//debug             console.log("OK", description);
//debug         }
//debug     } else {
//debug         console.log("FAIL", description);
//debug     }
//debug }
//debug function TRACE(runner, ...args) {
//debug     runner(ufork.LOG_TRACE, ...args);
//debug }
//debug let claims = [];
//debug function claim(runner, ...args) {
//debug     claims.push([runner, ...args]);
//debug }
//debug function check(log_level) {
//debug     claims.forEach(function (claim) {
//debug         const [runner, ...args] = claim;
//debug         runner(log_level, ...args);
//debug     });
//debug }
//debug claim(good, "empty", "", []);
//debug claim(good, "constant", "TRUE", []);
//debug claim(good, "? constant", "SEND ? TO println", "#?");
//debug claim(bad, "unknown constant", "MAYBE");
//debug claim(good, "print constant", "SEND 42 TO println", "+42");
//debug claim(good, "nested primitive calls", `
//debug     SEND sub(mul(2, 3), not(4)) TO println
//debug `, "#?");
//debug claim(good, "pair expression", `
//debug     SEND 1, 2, 3 TO println
//debug `, "(+1 +2 . +3)");
//debug claim(bad, "capture non-existant variable", "DEF oops AS neg(x)");
//debug claim(bad, "circular reference", "DEF x AS x");
//debug claim(good, "define constants", `
//debug     DEF x AS 666
//debug     DEF y AS 777
//debug     SEND x, y TO println
//debug `, "(+666 . +777)");
//debug claim(bad, "cyclic reference", `
//debug     DEF a AS b
//debug     DEF b AS a
//debug `);
//debug claim(good, "forward reference", `
//debug     SEND d TO println
//debug     DEF c AS (
//debug         IF y = 42 b()
//debug     )
//debug     DEF d AS (
//debug         CASE c OF
//debug         42 : b()
//debug         _ : FALSE
//debug         END
//debug     )
//debug     DEF b AS λ_.y
//debug     DEF y AS a(42)
//debug     DEF a AS λy.y
//debug `, "+42");
//debug claim(good, "destructured definition", `
//debug     DEF (a, b), c AS (1, 2), 3
//debug     SEND a, b, c TO println
//debug `, "(+1 +2 . +3)");
//debug claim(bad, "dereference _", `
//debug     DEF _ AS 1
//debug     SEND _ TO println
//debug `);
//debug claim(good,"define unbound", "DEF _ AS 1");
//debug claim(good, "define constant match", `
//debug     DEF 1 AS 1
//debug     SEND 42 TO println
//debug `, "+42");
//debug claim(good, "define constant mismatch", `
//debug     DEF 1 AS 2
//debug     SEND 42 TO println
//debug `, []);
//debug claim(good, "forward a message", `
//debug     CREATE log WITH λmsg.[
//debug         DEF ramanujan AS 1729
//debug         SEND (ramanujan, msg) TO println
//debug     ]
//debug     SEND 42 TO log
//debug `, "(+1729 . +42)");
//debug claim(good, "nested 'if' branches", `
//debug     DEF t AS TRUE
//debug     DEF f AS FALSE
//debug     SEND and(t, or(f, or(f, t))) TO println
//debug `, "#t");
//debug claim(good, "identity", `
//debug     DEF identity(x) AS x
//debug     SEND identity(42) TO println
//debug `, "+42");
//debug claim(good, "capture value in closure", `
//debug     DEF x AS 3
//debug     DEF triple(n) AS mul(x, n)
//debug     SEND triple(2) TO println
//debug `, "+6");
//debug claim(good, "calling returned closures", `
//debug     DEF hof3 AS λa.λ(b, c).λd.(a, b, c, d)
//debug     SEND ((hof3(1))(2, 3))(4) TO println
//debug `, "(+1 +2 +3 . +4)");
//debug claim(good, "recursion", `
//debug     DEF loop(a) AS loop(a)
//debug     loop(42)
//debug `);
//debug claim(good, "closure self-reference shadowed by inner variable", `
//debug     DEF x AS λx.x
//debug     SEND x(42) TO println
//debug `, "+42");
//debug claim(good, "closure self-reference shadows outer variable", `
//debug     DEF x AS FALSE
//debug     [
//debug         DEF x AS λ_.not(x)
//debug         SEND x() TO println
//debug     ]
//debug `, "#?");
//debug claim(good, "primitive alias", `
//debug     DEF plus AS add
//debug     SEND plus(1, 2) TO println
//debug `, "+3");
//debug claim(good, "non-tail call", `
//debug     DEF meaning() AS 41
//debug     DEF ask() AS add(1, meaning())
//debug     SEND ask() TO println
//debug `, "+42");
//debug claim(good, "tail call", `
//debug     DEF meaning(n) AS add(41, n)
//debug     DEF ask() AS meaning(1)
//debug     SEND ask() TO println
//debug `, "+42");
//debug claim(good, "recursive non-tail call", `
//debug     DEF rfact(n) AS (
//debug         CASE greater(n, 1) OF
//debug         TRUE : mul(n, rfact(sub(n, 1)))
//debug         _ : 1
//debug         END
//debug     )
//debug     SEND rfact(6) TO println
//debug `, "+720");
//debug claim(good, "recursive tail call", `
//debug     DEF ifact(n, a) AS (
//debug         CASE greater(n, 1) OF
//debug         TRUE : ifact(sub(n, 1), mul(n, a))
//debug         _ : a
//debug         END
//debug     )
//debug     SEND ifact(6, 1) TO println
//debug `, "+720");
//debug claim(good, "pair arg mismatch", `
//debug     DEF func(a, b) AS 42
//debug     SEND func(42) TO println
//debug `, "#?");
//debug claim(good, "const arg match", `
//debug     DEF func(1) AS 2
//debug     SEND func(1) TO println
//debug `, "+2");
//debug claim(good, "const arg mismatch", `
//debug     DEF func(1) AS 3
//debug     SEND func(2) TO println
//debug `, "#?");
//debug claim(good, "value arg match", `
//debug     DEF x AS 1
//debug     DEF func($x) AS 2
//debug     SEND func(x) TO println
//debug `, "+2");
//debug claim(good, "value arg mismatch", `
//debug     DEF x AS 1
//debug     DEF func($x) AS 2
//debug     SEND func(3) TO println
//debug `, "#?");
//debug claim(good, "primitive binary arg arity mismatch", `
//debug     SEND and(TRUE) TO println
//debug `, "#?");
//debug claim(good, "primitive binary arg type mismatch", `
//debug     SEND and(FALSE, 1) TO println
//debug `, "#?");
//debug claim(good, "primitive unary arg type mismatch", `
//debug     SEND not(1) TO println
//debug `, "#?");
//debug claim(good, "bind CASE pattern variable", `
//debug     DEF y AS 1
//debug     SEND (
//debug         CASE 41, y OF
//debug         x, $y : add(x, y)
//debug         END
//debug     ) TO println
//debug `, "+42");
//debug claim(good, "evaluate a block", `
//debug     DEF not_a_block AS 777
//debug     DEF make_block(n) AS [
//debug         not_a_block
//debug         DEF local AS 888
//debug         SEND (not_a_block, local, n) TO println
//debug     ]
//debug     make_block(999)
//debug     not_a_block
//debug `, "(+777 +888 . +999)");
//debug claim(good, "become", `
//debug     DEF fib_beh(m) AS λ(cust, n).[
//debug         CASE less(n, m) OF
//debug         FALSE : [
//debug             CREATE k_fib WITH λa.[
//debug                 BECOME λb.[
//debug                     SEND add(a, b) TO cust
//debug                 ]
//debug             ]
//debug             SEND (k_fib, sub(n, 1)) TO SELF
//debug             SEND (k_fib, sub(n, 2)) TO SELF
//debug         ]
//debug         _ : [ SEND n TO cust ]
//debug         END
//debug     ]
//debug     CREATE fib WITH fib_beh(2)
//debug     SEND (println, 6) TO fib
//debug `, "+8");
//debug claim(good, "symbol equality", `
//debug     SEND and(eq(#foo, #foo), not(eq(#foo, #bar))) TO println
//debug `, "#t");
//debug claim(good, "shadow primitive", `
//debug     DEF neg(n) AS n
//debug     SEND neg(42) TO println
//debug `, "+42");
//debug claim(good, "compare", `
//debug     DEF lt AS compare(1, 2)
//debug     DEF eq AS compare(2, 2)
//debug     DEF gt AS compare(3, 2)
//debug     DEF bad AS compare(3, #f)
//debug     SEND lt, eq, gt, bad TO println
//debug `, "(-1 +0 +1 . #?)");
//debug claim(bad, "redefinition", `
//debug     DEF x AS 1
//debug     DEF x AS 2
//debug `);
//debug claim(bad, "redefinition within DEF pattern", `
//debug     DEF x, x AS 1, 2
//debug `);
//debug claim(bad, "redefinition within parameters", `
//debug     DEF foo(a, b, a) AS 1
//debug `);
//debug claim(bad, "redefinition within CASE pattern", `
//debug     CASE 123 OF
//debug     x, x : 1
//debug     END
//debug `);
//debug claim(bad, "redefinition of CREATE", `
//debug     DEF a AS 1
//debug     CREATE a WITH 1
//debug `);
//debug claim(good, "THROW", `
//debug     DEF reason AS 42
//debug     SEND TRUE TO println  # never sent
//debug     THROW reason
//debug     DEF unused AS 1729
//debug `, []);
//debug claim(good, "DEF pattern failure", `
//debug     SEND TRUE TO println  # never sent
//debug     DEF a, b AS 42  # throws
//debug `, []);
//debug claim(good, "NEW", `
//debug     DEF fwd AS NEW λmsg.[ SEND msg TO println ]
//debug     SEND 42 TO fwd
//debug `, "+42");
//debug claim(good, "timer", `
//debug     SEND (10, 42, println) TO timer
//debug `);
//debug claim(good, "random", `
//debug     SEND (println, 1) TO random
//debug `, "+0");
//debug claim(good, "LET", `
//debug     LET x = 4
//debug     LET a, 2, c = 1, b, 3, $(x, 5)
//debug     SEND c, b, a TO println
//debug `, "((+3 +4 . +5) +2 . +1)");
//debug claim(bad, "bad equation", `
//debug     LET x = y
//debug `);
//debug claim(good, "IF pattern match", `
//debug     DEF y AS 666
//debug     IF x = 777 [
//debug         SEND y, x TO println
//debug     ] ELSE [
//debug         SEND FALSE TO println
//debug     ]
//debug `, "(+666 . +777)");
//debug claim(good, "IF pattern mismatch", `
//debug     DEF x AS 111
//debug     IF x, 222 = 333, 444 [
//debug         SEND TRUE TO println
//debug     ] ELSE [
//debug         SEND x TO println
//debug     ]
//debug `, "+111");
//debug claim(good, "string literal", `
//debug     SEND "hi" TO println
//debug `, "(+104 +105)");
//debug claim(good, "apply non-function", `
//debug     DEF f AS 0
//debug     SEND f(1) TO println
//debug `, "#?");
//debug claim(good, "apply non-function via tail call", `
//debug     DEF f AS 0
//debug     DEF g(x) AS f(x)
//debug     SEND g(2) TO println
//debug `, "#?");
//debug claim(good, "deep equality", `
//debug     SEND eq((1, 2), (1, 2)) TO println
//debug `, "#t");
//debug claim(good, "deep inequality", `
//debug     SEND eq((1, 2), (1, 2, 3)) TO println
//debug `, "#f");
//debug claim(good, "div mod", `
//debug     SEND (div(17, 5), mod(17, 5)) TO println
//debug `, "(+3 . +2)");
//debug claim(good, "type predicates", `
//debug     SEND (
//debug         is_boolean(TRUE),
//debug         is_boolean(42),
//debug         is_number(42),
//debug         is_number(#f),
//debug         is_function(is_function),
//debug         is_function(42),
//debug         is_actor(println),
//debug         is_actor(is_actor),
//debug         is_pair(TRUE, FALSE),
//debug         is_pair(TRUE)
//debug     ) TO println
//debug `, "(#t #f #t #f #t #f #t #f #t . #f)");
//debug claim(good, "match ? in pattern", `
//debug     SEND (
//debug         CASE ? OF
//debug         ? : TRUE
//debug         _ : FALSE
//debug         END
//debug     ) TO println
//debug `, "#t");

// To run a test case in isolation, comment out check(...) below and rewrite
// claim(...) as TRACE(...).

//debug test_sort_stmts();
//debug test_search();
//debug check(ufork.LOG_INFO); // LOG_INFO | LOG_WARN | LOG_DEBUG | LOG_TRACE

export default Object.freeze(compile);
