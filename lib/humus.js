// uFork Humus compiler

// Transforms Humus source code into an intermediate representation
// that is suitable for loading.

// The intermediate representation is described in `ir.md`.

/*jslint long, white, devel */

import gen_json from "https://dalnefre.github.io/humus_js/gen_json.js";
import hum_xlat from "https://dalnefre.github.io/humus_js/hum_xlat.js";

// Parsing /////////////////////////////////////////////////////////////////////

const rx_parse_error = /^(.*)\u0020\{lineno:(\d+),\u0020start:(\d+),\u0020end:(\d+),.*\}/;

function locate_in(token, text) {
    if (Number.isSafeInteger(token?.lineno)) {
        const lines = text.split("\n");
        const offset = lines.slice(0, token.lineno - 1).reduce(
            function (position, line) {
                return position + line.length + 1;  // add newline
            },
            0
        );
        return {
            line: token.lineno,
            column: token.start + 1,
            start: offset + token.start,
            end: offset + token.end
        };
    }
}

function parse(text) {
    try {
        const cfg = Object.create(null);
        const gen = gen_json(cfg);
        const xlat = hum_xlat(gen);
        xlat.parse(text);
        let prog = [];
        while (true) {
            const stmt = xlat.compile();
            if (stmt === undefined) {
                break;
            }
            prog.push(JSON.parse(JSON.stringify(stmt)));
        }
        return {
            lang: "Humus",
            ast: prog.reduceRight(
                function (tail, statement) {
                    return {
                        kind: "stmt_pair",
                        head: statement,
                        tail
                    };
                },
                {kind: "empty_stmt"}
            ),
            errors: []
        };
    } catch (exception) {
        let error;
        const matches = exception.message.match(rx_parse_error);
        if (matches) {
            const message = matches[1];
            const pseudo_token = {
                lineno: parseInt(matches[2]),
                start: parseInt(matches[3]),
                end: parseInt(matches[4])
            };
            error = Object.assign(
                {message},
                locate_in(pseudo_token, text)
            );
        } else {
            error = exception;
        }
        return {errors: [error]};
    }
}

// Code generation /////////////////////////////////////////////////////////////

function visit(ast, visitors) {
    let visitor = visitors[ast?.kind];
    if (visitor) {
        return visitor(ast, visitors);
    }
}
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
function visit_create_stmt(ast, visitors) {
    visit(ast.expr, visitors);
}
function visit_send_stmt(ast, visitors) {
    visit(ast.msg, visitors);
    visit(ast.to, visitors);
}
function visit_become_stmt(ast, visitors) {
    visit(ast.expr, visitors);
}
function visit_def_stmt(ast, visitors) {
    visit(ast.ptrn, visitors);
    visit(ast.expr, visitors);
}
function visit_let_stmt(ast, visitors) {
    visit(ast.eqtn.left, visitors);
    visit(ast.eqtn.right, visitors);
}
function visit_stmt_pair(ast, visitors) {
    visit(ast.head, visitors);
    visit(ast.tail, visitors);
}
function visit_empty_stmt() {
}
function visit_expr_stmt(ast, visitors) {
    visit(ast.expr, visitors);
}
function visit_throw_stmt(ast, visitors) {
    visit(ast.expr, visitors);
}
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
function visit_const_expr() {
}
function visit_ident_expr() {
}
function visit_pair_expr(ast, visitors) {
    visit(ast.head, visitors);
    visit(ast.tail, visitors);
}
function visit_abs_expr(ast, visitors) {
    visit(ast.ptrn, visitors);
    visit(ast.body, visitors);
}
function visit_app_expr(ast, visitors) {
    visit(ast.abs, visitors);
    visit(ast.arg, visitors);
}
function visit_case_expr(ast, visitors) {
    visit(ast.expr, visitors);
    visit(ast.next, visitors);
}
function visit_case_choice(ast, visitors) {
    visit(ast.ptrn, visitors);
    visit(ast.expr, visitors);
    visit(ast.next, visitors);
}
function visit_case_end() {
}
function visit_if_expr(ast, visitors) {
    visit(ast.eqtn.left, visitors);
    visit(ast.eqtn.right, visitors);
    visit(ast.expr, visitors);
    visit(ast.next, visitors);
}
function visit_let_expr(ast, visitors) {
    visit(ast.eqtn.left, visitors);
    visit(ast.eqtn.right, visitors);
    visit(ast.expr, visitors);
}
function visit_block_expr(ast, visitors) {
    visit(ast.stmt, visitors);
}
function visit_now_expr() {
}
function visit_self_expr() {
}
function visit_new_expr(ast, visitors) {
    visit(ast.expr, visitors);
}
/*
Patterns
{ "kind":"const_ptrn", "value":<value> }
{ "kind":"ident_ptrn", "ident":<string> }
{ "kind":"any_ptrn" }
{ "kind":"pair_ptrn", "head":<pattern>, "tail":<pattern> }
{ "kind":"value_ptrn", "expr":<expression> }
*/
function visit_const_ptrn() {
}
function visit_ident_ptrn() {
}
function visit_any_ptrn() {
}
function visit_pair_ptrn(ast, visitors) {
    visit(ast.head, visitors);
    visit(ast.tail, visitors);
}
function visit_value_ptrn(ast, visitors) {
    visit(ast.expr, visitors);
}
let default_visitors = {
    // statements
    create_stmt: visit_create_stmt,
    send_stmt: visit_send_stmt,
    become_stmt: visit_become_stmt,
    def_stmt: visit_def_stmt,
    let_stmt: visit_let_stmt,
    stmt_pair: visit_stmt_pair,
    empty_stmt: visit_empty_stmt,
    expr_stmt: visit_expr_stmt,
    throw_stmt: visit_throw_stmt,
    // expressions
    const_expr: visit_const_expr,
    ident_expr: visit_ident_expr,
    pair_expr: visit_pair_expr,
    abs_expr: visit_abs_expr,
    app_expr: visit_app_expr,
    case_expr: visit_case_expr,
    case_choice: visit_case_choice,
    case_end: visit_case_end,
    if_expr: visit_if_expr,
    let_expr: visit_let_expr,
    block_expr: visit_block_expr,
    now_expr: visit_now_expr,
    self_expr: visit_self_expr,
    new_expr: visit_new_expr,
    // patterns
    const_ptrn: visit_const_ptrn,
    ident_ptrn: visit_ident_ptrn,
    any_ptrn: visit_any_ptrn,
    pair_ptrn: visit_pair_ptrn,
    value_ptrn: visit_value_ptrn
};

function resolve(value) {
    return (
        typeof value === "function"
        ? value()
        : value
    );
}

function flatten(ast) {
    if (ast.kind === "pair_expr" || ast.kind === "pair_ptrn") {
        return [ast.head, ...flatten(ast.tail)];
    }
    return [ast];
}

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
        || op === "cmp"
        || op === "if"
        || op === "jump"
        || (op === "dict" && imm === "get")
        || (op === "new" && imm === -1)
        || (op === "beh" && imm === -1)
        || op === "assert"
    ) {
        return -1;
    }
    if (op === "send" && imm === -1) {
        return -2;
    }
    if (op === "dup" || op === "part") {
        return imm;
    }
    if (op === "drop" || op === "pair") {
        return -imm;
    }
    if (op === "roll" || op === "nth" || op === "debug") {
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

function ir_debug(ast, src, locate) {
    const first = locate(ast.debug?.first);
    const last = locate(ast.debug?.last);
    if (first !== undefined) {
        let debug = {
            start: first.start,
            end: last?.start ?? first.end
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

function ir_type(name) {
    return {
        kind: "type",
        name
    };
}

function ir_custom_type(arity) {
    return {
        kind: "type",
        arity
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

function ir_pair(head, tail) {
    return {
        kind: "pair",
        head,
        tail
    };
}

function ir_dict(key, value, next = ir_lit("nil")) {
    return {
        kind: "dict",
        key,
        value,
        next
    };
}

function ir_ref(name, module) {
    return {
        kind: "ref",
        module,  // optional
        name
    };
}

const empty_env_ptrn = {kind: "ident_ptrn", ident: "_"};
const error_bundle = {
    bad_kind: "Bad token kind '{a}'.",
    bad_ptrn: "Bad pattern kind '{a}'.",
    expected_a_b: "Expected {a} and saw {b}.",
    not_expr: "'{a}' is not an expression.",
    not_implemented: "Not implemented: {a}",
    undefined_a: "'{a}' was not defined."
};

function codegen(crlf, src, locate) {
    let depths = [];
    let definitions = Object.create(null);
    let env_ptrn = empty_env_ptrn;
    let errors = [];  // error reporting bucket
    let kind_maps = [];

    function env_at() {
        const n = depths[0];
        if (!Number.isSafeInteger(n) || n <= 0) {
            throw new Error("Bad depth " + n + ".");
        }
        return n;
    }

    function push_env(ptrn, final_depth = 0) {
        depths.unshift(final_depth);
        env_ptrn = {
            kind: "pair_ptrn",
            head: ptrn,
            tail: env_ptrn
        };
    }

    function pop_env() {
        const ptrn = env_ptrn.head;
        env_ptrn = env_ptrn.tail;
        depths.shift();
        return ptrn;
    }

    function record_stack_effect(op, imm) {

// Record the change in stack depth caused by execution of the instruction,
// assuming no underflow.

        const delta = stack_delta(op, imm);

// The delta is negated because instructions are generated in reverse order.
// Oddly, this requires us to envision the stack's evolution in reverse.

        depths[0] -= delta;

// Uncomment the below line to debug stack depth inconsistencies.

//debug //imm = resolve(imm);
//debug //console.log(depths, op, imm?.kind ?? imm, `(${delta})`);

    }

    function ir_instr(debug_ast, op, imm, k) {
        record_stack_effect(op, imm);
        return {
            kind: "instr",
            op,
            imm: resolve(imm),
            k,
            debug: ir_debug(debug_ast, src, locate)
        };
    }

    function ir_call(debug_ast, nr_args, nr_returns) {
        depths[0] -= nr_returns - (nr_args + 1);  // ( arg* k -- rv* )
        record_stack_effect("jump");
        return {
            kind: "instr",
            op: "jump",
            debug: ir_debug(debug_ast, src, locate)
        };
    }

    function ir_if_instr(debug_ast, gen_t, gen_f) {

// Both branches of an 'if' instruction must cause the same change in stack
// depth, otherwise our scheme of predicting stack evolution in reverse is
// doomed. To be safe, we compare the change in stack depth resulting from the
// generation of each branch. If they differ, the invariant is broken.

        const checkpoint = depths.slice();  // store the initial stack depths
        const t = gen_t();                  // generate the true branch
        const t_depths = depths.slice();    // store the changed stack depths
        depths = checkpoint;                // undo the change
        const f = gen_f();                  // generate the false branch
        const f_depths = depths.slice();
        if (t_depths.join() !== f_depths.join() && errors.length === 0) {
            throw new Error("Stack depth mismatch in branches.");
        }
        record_stack_effect("if");
        return {
            kind: "instr",
            op: "if",
            t,
            f,
            debug: ir_debug(debug_ast, src, locate)
        };
    }

    function error(code, ast, a, b) {
        let the_error = {
            kind: "error",
            code,
            message: error_bundle[code].replace("{a}", a).replace("{b}", b)
        };
        if (typeof locate === "function") {
            const first = locate(ast.debug?.first);
            if (first !== undefined) {
                the_error.line = first.line;
                the_error.column = first.column;
                the_error.start = first.start;
                the_error.end = first.end;
            }
            const last = locate(ast.debug?.last);
            if (last !== undefined) {
                the_error.end = last.start;
            }
        }
        if (src !== undefined) {
            the_error.src = src;
        }
        errors.push(the_error);
    }

    function intern(ast) {

// Registers the 'ast' as a definition, if it is not already, returning its ref.

        if (ast.kind === "ref") {
            return ast;
        }

// The $ character is forbidden in Humus identifiers, so we embed it in
// autogenerated labels to avoid naming conflicts.

        const name = "$" + Object.keys(definitions).length;
        definitions[name] = ast;
        return ir_ref(name);
    }

    function generate(ast, k) {
        const kind_map = kind_maps.findLast(function (kind_map) {
            return Object.hasOwn(kind_map, ast.kind);
        });
        return (
            kind_map !== undefined
            ? kind_map[ast.kind](ast, k)
            : error("bad_kind", ast, ast.kind)
        );
    }

    function gen_block_code(body) {
        push_env(empty_env_ptrn, -1);
        const code =                                    // k env
            ir_instr(body, "push", ir_lit("undef"),     // k env #?
            ir_instr(body, "pair", 1,                   // k env'=(#? . env)
            generate(body,                              // k env'
            ir_instr(body, "drop", 1,                   // k
            ir_instr(body, "jump")))));                 // --
        pop_env();
        return code;
    }

    function gen_abs_expr(ast, k) {
        push_env(ast.ptrn, 0);
        const code =                                    // args k env
            ir_instr(ast.body, "roll", 3,               // k env args
            ir_instr(ast.body, "pair", 1,               // k env'=(args . env)
            generate(ast.body,                          // k env' rv
            ir_instr(ast.body, "roll", -3,              // rv k env'
            ir_instr(ast.body, "drop", 1,               // rv k
            ir_instr(ast.body, "jump"))))));            // rv
        pop_env();
        const make_closure = ir_ref("make_closure", "$hum");
        k =                                             // env ...
            ir_instr(ast.body, "push", code,            // env ... code
            ir_instr(ast.body, "pick", env_at,          // env ... code env
            ir_instr(ast.body, "push", k,               // env ... code env k
            ir_instr(ast.body, "push", make_closure,    // env ... code env k make_closure
            ir_call(ast.body, 2, 1)))));                // env ... closure
        return k;
    }

    function binary_op(op, imm) {
        return function gen_binary_op(ast, k) {
            k =                                         // (n . m)
                ir_instr(ast, "part", 1,                // m n
                ir_instr(ast, "roll", 2,                // n m
                ir_instr(ast, op, imm,                  // n-m
                k)));
            return k;
        };
    }

    const primitives = {
        add: binary_op("alu", "add"),
        sub: binary_op("alu", "sub"),
        mul: binary_op("alu", "mul"),
        // div: binary_op("alu", "div"),  // reserved
        eq: binary_op("cmp", "eq"),
        less: binary_op("cmp", "lt"),
        less_equal: binary_op("cmp", "le"),
        greater: binary_op("cmp", "gt"),
        greater_equal: binary_op("cmp", "ge"),
        neg(ast, k) {
            k =                                         // n
                ir_instr(ast, "push", -1,               // n -1
                ir_instr(ast, "alu", "mul",             // -n
                k));
            return k;
        },
        not(ast, k) {
            k = intern(k);
            k = ir_if_instr(                                            // value
                    ast,
                    () => ir_instr(ast, "push", ir_lit("false"), k),    // #f
                    () => ir_instr(ast, "push", ir_lit("true"), k)      // #t
                );
            return k;
        },

// The logical primitives 'and' and 'or' are short circuiting. Shared tails are
// first interned, avoiding duplication in the IR.

        and(ast, k) {
            k = intern(k);
            k =                                                             // (a . b)
                ir_instr(ast, "part", 1,                                    // b a
                ir_if_instr(                                                // b
                    ast,
                    () =>
                        ir_if_instr(                                        // --
                            ast,
                            () => ir_instr(ast, "push", ir_lit("true"), k), // #t
                            () => ir_instr(ast, "push", ir_lit("false"), k) // #f
                        ),
                    () =>
                        ir_instr(ast, "drop", 1,                            // --
                        ir_instr(ast, "push", ir_lit("false"), k))));       // #f
            return k;
        },
        or(ast, k) {
            k = intern(k);
            k =                                                             // (a . b)
                ir_instr(ast, "part", 1,                                    // b a
                ir_if_instr(                                                // b
                    ast,
                    () =>
                        ir_instr(ast, "drop", 1,                            // --
                        ir_instr(ast, "push", ir_lit("true"), k)),          // #t
                    () =>
                        ir_if_instr(                                        // --
                            ast,
                            () => ir_instr(ast, "push", ir_lit("true"), k), // #t
                            () => ir_instr(ast, "push", ir_lit("false"), k) // #f
                        )));
            return k;
        }
    };

    function gen_app_expr(ast, k) {
        if (
            ast.abs.kind === "ident_expr"
            && Object.hasOwn(primitives, ast.abs.ident)
        ) {
            const gen_primitive = primitives[ast.abs.ident];
            k =
                generate(ast.arg,                       // args
                gen_primitive(ast,                      // rv
                k));
            return k;
        }

// TODO allow primitives to be shadowed

        k =
            generate(ast.arg,                           // args
            ir_instr(ast, "push", k,                    // args k
            generate(ast.abs,                           // args k closure
            ir_call(ast, 1, 1))));                      // rv
        return k;
    }

    function gen_const_expr(ast, k) {
        const value = ast.value;
        if (Number.isSafeInteger(value)) {
            k = ir_instr(ast, "push", value,            // value
                k);
        } else if (value === true) {
            k = ir_instr(ast, "push", ir_lit("true"),   // #t
                k);
        } else if (value === false) {
            k = ir_instr(ast, "push", ir_lit("false"),  // #f
                k);
        } else {
            return error("not_implemented", ast, "gen_const_expr");
        }
        return k;
    }

    function gen_ident_expr(ast, k) {
        if (ast.ident === "_") {
            return error("not_expr", ast, ast.ident);
        }

// TODO allow primitives to be shadowed

        if (Object.hasOwn(primitives, ast.ident)) {
            const gen_primitive = primitives[ast.ident];
            push_env(empty_env_ptrn);
            const procedure =                           // args k
                ir_instr(ast, "roll", -2,               // k args
                gen_primitive(ast,                      // k rv
                ir_instr(ast, "roll", 2,                // rv k
                ir_instr(ast, "jump"))));               // rv
            pop_env();
            k =
                ir_instr(ast, "push", procedure,        // procedure
                k);
            return k;
        }
        k = (function search(ptrn) {
            if (ptrn.kind === "ident_ptrn") {
                if (ptrn.ident === ast.ident) {
                    return k;  // found
                }
            } else if (ptrn.kind === "pair_ptrn") {
                const head_k = search(ptrn.head);
                if (head_k !== undefined) {
                    return ir_instr(ast, "nth", 1, head_k);
                }
                const tail_k = search(ptrn.tail);
                if (tail_k !== undefined) {
                    if (tail_k !== k) {

// Squash eligible instruction sequences into a single instruction, for example:

//      nth -1      nth -1
//      nth -1      nth -1
//      nth -1      nth -1
//      nth 1       nth -1
//        |           |
//        v           v
//      nth 4      nth -4

                        if (tail_k.imm < 0) {
                            tail_k.imm -= 1;
                            return tail_k;
                        }
                        if (tail_k.imm > 0) {
                            tail_k.imm += 1;
                            return tail_k;
                        }
                    }
                    return ir_instr(ast, "nth", -1, tail_k);
                }
            } else if (ptrn.kind !== "any_ptrn") {
                return error("bad_ptrn", ptrn, ptrn.kind);
            }
        }(env_ptrn));
        if (k === undefined) {
            return error("undefined_a", ast, ast.ident);
        }
        k =                                             // env ...
            ir_instr(ast, "pick", env_at,               // env ... env
            k);                                         // env ... value
        return k;
    }

    function gen_pair_expr(ast, k) {
        const elements = flatten(ast);
        k = ir_instr(ast, "pair", elements.length - 1,
            k);
        elements.forEach(function (element) {
            k = generate(element, k);
        });
        return k;
    }

    function gen_def_stmt(ast, k) {

// Let the definition fall out of scope. Remember that we are working our way up
// the AST, building the instruction sequence in reverse. The definition, added
// earlier to the static environment by 'gen_stmt_pair', should be inaccessible
// to preceeding statements.

        env_ptrn.head = env_ptrn.head.tail;

// In constrast, execution proceeds in the forward direction. Here we extend the
// dynamic environment, making the definition accessible to succeeding
// statements.

        k =                                             // env ...
            ir_instr(ast, "pick", env_at,               // env ... env
            ir_instr(ast, "part", 1,                    // env ... rest scope
            generate(ast.expr,                          // env ... rest scope value
            ir_instr(ast, "pair", 1,                    // env ... rest (value . scope)
            ir_instr(ast, "pair", 1,                    // env ... env'=((value . scope) . rest)
            ir_instr(ast, "roll", env_at,               // ... env' env
            ir_instr(ast, "drop", 1,                    // ... env'
            ir_instr(ast, "roll", () => -env_at(),      // env' ...
            k))))))));
        return k;
    }

    function gen_empty_stmt(_, k) {
        return k;
    }

    function gen_expr_stmt(ast, k) {

// TODO If the value is a block, execute it. Otherwise drop the value.

        k = generate(ast.expr,                          // value
            ir_instr(ast, "drop", 1,                    // ...
            k));
        return k;
    }

    function gen_send_stmt(ast, k) {
        k = generate(ast.msg,                           // msg
            generate(ast.to,                            // msg actor
            ir_instr(ast, "send", -1,                   // ...
            k)));
        return k;
    }

    function gen_stmt_pair(ast, k) {

// Before generating any instructions for the block, its static environment is
// extended with its definitions.

        if (ast.head.kind === "def_stmt") {
            env_ptrn.head = {
                kind: "pair_ptrn",
                head: ast.head.ptrn,
                tail: env_ptrn.head
            };
        }
        k = generate(ast.head,
            generate(ast.tail,
            k));
        return k;
    }

    kind_maps.push({
        "abs_expr": gen_abs_expr,
        "app_expr": gen_app_expr,
        "const_expr": gen_const_expr,
        "def_stmt": gen_def_stmt,
        "empty_stmt": gen_empty_stmt,
        "expr_stmt": gen_expr_stmt,
        "ident_expr": gen_ident_expr,
        "pair_expr": gen_pair_expr,
        "send_stmt": gen_send_stmt,
        "stmt_pair": gen_stmt_pair
    });
    if (crlf.lang !== "Humus") {
        error("expected_a_b", crlf, "Humus/CRLF", crlf.lang);
    }

// The top level is compiled as a block that captures builtins
// (such as 'println') in its environment.

    const commit = ir_ref("commit", "$std");
    const debug_key = ir_ref("debug_key", "$dev");
    push_env({kind: "ident_ptrn", ident: "println"});
    definitions.boot =
        ir_instr(crlf.ast, "push", commit,          // k=std.commit
        ir_instr(crlf.ast, "push", ir_lit("nil"),   // k ()
        ir_instr(crlf.ast, "msg", 0,                // k () {caps}
        ir_instr(crlf.ast, "push", debug_key,       // k () {caps} dev.debug_key
        ir_instr(crlf.ast, "dict", "get",           // k () println
        ir_instr(crlf.ast, "pair", 1,               // k env=(println)
        gen_block_code(crlf.ast)))))));
    pop_env();
    if (flatten(env_ptrn).length !== 1 || depths.length !== 0) {
        throw new Error("Corrupt env.");
    }
    return {
        lang: "uFork",
        ast: {
            kind: "module",
            import: {
                "$dev": "https://ufork.org/lib/dev.asm",
                "$hum": "https://ufork.org/lib/hum.asm",
                "$std": "https://ufork.org/lib/std.asm"
            },
            define: definitions,
            export: ["boot"]
        },
        errors
    };
}

function compile(text, src) {
    const ast = parse(text);
    if (ast.errors.length > 0) {
        return ast;
    }
    return codegen(ast, src, function locate(token) {
        return locate_in(token, text);
    });
}

//debug import disassemble from "./disassemble.js";
//debug function log_ir(ir) {
//debug     console.log(JSON.stringify(ir, undefined, 4));
//debug }
//debug function log_asm(ir) {
//debug     console.log(disassemble(ir));
//debug }
//debug function good(description, text) {
//debug     const ir = compile(text);
//debug     if (ir.errors.length > 0) {
//debug         console.log("FAIL", description);
//debug     }
//debug     //log_ir(ir);
//debug     //log_asm(ir);
//debug }
//debug function bad(description, text) {
//debug     const ir = compile(text);
//debug     if (ir.errors.length === 0) {
//debug         console.log("FAIL", description);
//debug     }
//debug     //console.log(ir.errors);
//debug }
//debug good("constant", "TRUE");
//debug bad("unknown constant", "MAYBE");
//debug good("print constant", "SEND 42 TO println");
//debug good("nested primitive calls", "sub(mul(2, 3), not(4))");
//debug good("pair expression", "SEND 1, 2, 3 TO println");
//debug bad("capture non-existant variable", "DEF oops AS neg(x)");
//debug bad("circular reference", "DEF x AS x");
//debug good("define constants", `
//debug     DEF x AS 666
//debug     DEF y AS 777
//debug     SEND x, y TO println
//debug `);
//debug bad("forward reference", `
//debug     SEND y TO println
//debug     DEF y AS 777
//debug `);
//debug good("destructured definition", `
//debug     DEF (a, b), c AS (1, 2), 3
//debug     SEND a, b, c TO println
//debug `);
//debug bad("dereference _", `
//debug     DEF _ AS 1
//debug     SEND _ TO println
//debug `);
//debug good("define unbound", "DEF _ AS 1");
//debug bad("define constant pattern", "DEF 1 AS 2");
//debug good("forward a message", `
//debug     CREATE log WITH \\msg.[
//debug         SEND (1729, msg) TO println
//debug     ]
//debug     SEND 42 TO log
//debug `);
//debug good("nested 'if' branches", `
//debug     DEF t AS TRUE
//debug     DEF f AS FALSE
//debug     SEND and(t, or(f, or(f, t))) TO println
//debug `);
//debug good("identity", `
//debug     DEF identity(x) AS x
//debug     SEND identity(42) TO println
//debug `);
//debug good("capture value in closure", `
//debug     DEF x AS 3
//debug     DEF triple(n) AS mul(x, n)
//debug     SEND triple(2) TO println
//debug `);
//debug good("calling returned closures", `
//debug     DEF hof3 AS \\a.\\(b, c).\\d.(a, b, c, d)
//debug     SEND ((hof3(1))(2, 3))(4) TO println
//debug `);
//debug good("recursion", `
//debug     DEF loop(a) AS loop(a)
//debug     loop(42)  # never terminates
//debug `);
//debug good("first class primitive", `
//debug     DEF plus AS add
//debug     SEND plus(1, 2) TO println
//debug `);

//debug const text = `
//debug     DEF subtract AS sub
//debug     SEND subtract(3, 2) TO println
//debug `;
//debug const ir = compile(text);
//debug //log_ir(ir);
//debug //log_asm(ir);

export default Object.freeze(compile);
