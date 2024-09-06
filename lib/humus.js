// uFork Humus compiler

// Transforms Humus source code into an intermediate representation
// that is suitable for loading.

// The intermediate representation is described in `ir.md`.

/*jslint long, white, devel */

import gen_json from "https://dalnefre.github.io/humus_js/gen_json.js";
import hum_xlat from "https://dalnefre.github.io/humus_js/hum_xlat.js";

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

function length(ast) {
    return 1 + (
        ast.kind === "pair_expr"
        ? length(ast.tail)
        : 0
    );
}

const binary_functions = Object.freeze({
    add: {op: "alu", imm: "add"},
    sub: {op: "alu", imm: "sub"},
    mul: {op: "alu", imm: "mul"},
    // div: {op: "alu", imm: "div"},  // reserved
    eq: {op: "cmp", imm: "eq"},
    less: {op: "cmp", imm: "lt"},
    less_equal: {op: "cmp", imm: "le"},
    greater: {op: "cmp", imm: "gt"},
    greater_equal: {op: "cmp", imm: "ge"}
});
const error_bundle = {
    bad_kind: "Bad token kind '{a}'.",
    expected_a_b: "Expected {a} and saw {b}.",
    not_implemented: "Not implemented '{a}'",
    wrong_arity: "Wrong number of arguments. Expected {a}, saw {b}."
};

function codegen(crlf, src, locate) {
    let errors = [];  // error reporting bucket
    let definitions = Object.create(null);
    let kind_maps = [];

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
                the_error.end = last.end;
            }
        }
        if (src !== undefined) {
            the_error.src = src;
        }
        errors.push(the_error);
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

    function ir_instr(op, imm, k) {
        return {
            kind: "instr",
            op,
            imm,
            k
        };
    }

    function ir_if_instr(t, f) {
        return {
            kind: "instr",
            op: "if",
            t,
            f
        };
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

    function gen_app_expr(ast, k) {
        if (ast.abs.kind === "ident_expr") {
            const arity = length(ast.arg);

// TODO perform lookup

// Unary primitive functions.

            if (ast.abs.ident === "neg" || ast.abs.ident === "not") {
                if (arity !== 1) {
                    return error("wrong_arity", ast.arg, 1, arity);
                }
                if (ast.abs.ident === "neg") {
                    k = generate(ast.arg,
                        ir_instr("push", -1,
                        ir_instr("alu", "mul",
                        k)));
                    return k;
                }
                if (ast.abs.ident === "not") {
                    k = intern(k);
                    k = generate(ast.arg,
                        ir_if_instr(
                            ir_instr("push", ir_lit("false"), k),
                            ir_instr("push", ir_lit("true"), k)
                        ));
                    return k;
                }
            }

// Binary primitive functions.

            if (arity !== 2) {
                return error("wrong_arity", ast.arg, 2, arity);
            }
            if (Object.hasOwn(binary_functions, ast.abs.ident)) {
                const {op, imm} = binary_functions[ast.abs.ident];
                k = generate(ast.arg.head,              // ... n
                    generate(ast.arg.tail,              // ... n m
                    ir_instr(op, imm,                   // ... n+m
                    k)));
                return k;
            }

// The logical primitives 'and' and 'or' are short circuiting. Shared tails are
// first interned, avoiding duplication in the IR.

            k = intern(k);
            let k_true = ir_instr("push", ir_lit("true"), k);
            let k_false = ir_instr("push", ir_lit("false"), k);
            if (ast.abs.ident === "and") {
                k_false = intern(k_false);
                k = generate(ast.arg.head,
                    ir_if_instr(
                        generate(ast.arg.tail, ir_if_instr(k_true, k_false)),
                        k_false
                    ));
                return k;
            }
            if (ast.abs.ident === "or") {
                k_true = intern(k_true);
                k = generate(ast.arg.head,
                    ir_if_instr(
                        k_true,
                        generate(ast.arg.tail, ir_if_instr(k_true, k_false))
                    ));
                return k;
            }
        }
        return error("not_implemented", ast.abs, "gen_app_expr");
    }

    function gen_const_expr(ast, k) {
        const value = ast.value;
        if (Number.isSafeInteger(value)) {
            k = ir_instr("push", value,                 // ... value
                k);
        } else if (value === true) {
            k = ir_instr("push", ir_lit("true"),        // ... #t
                k);
        } else if (value === false) {
            k = ir_instr("push", ir_lit("false"),       // ... #f
                k);
        } else {
            return error("not_implemented", ast, "gen_const_expr");
        }
        return k;
    }

    function gen_ident_expr(ast, k) {
        const ident = ast.ident;
        if (ident !== "println") {
            return error("expected_a_b", ast, "println", ident);
        }

// Top-level `println` is implemented by the debug device.

        const debug_key = ir_ref("debug_key", "$dev");
        k = ir_instr("msg", 0,                          // ... {caps}
            ir_instr("push", debug_key,                 // ... {caps} dev.debug_key
            ir_instr("dict", "get",                     // ... debug_dev
            k)));
        return k;
    }

    function gen_def_stmt(ast, k) {
        if (ast.ptrn.kind !== "ident_ptrn") {
            return error("not_implemented", ast.ptrn, "gen_def_stmt");
        }
        return error("not_implemented", ast, "gen_def_stmt"); // TODO
    }

    function gen_empty_stmt(_, k) {
        return k;
    }

    function gen_expr_stmt(ast, k) {

// TODO If the value is a block, execute it. Otherwise drop the value.

        return generate(ast.expr, k);
    }

    function gen_send_stmt(ast, k) {
        k = generate(ast.msg,                           // ... msg
            generate(ast.to,                            // ... msg actor
            ir_instr("send", -1,                        // ...
            k)));
        return k;
    }

    function gen_stmt_pair(ast, k) {
        k = generate(ast.head,
            generate(ast.tail,
            k));
        return k;
    }

    kind_maps.push({
        "app_expr": gen_app_expr,
        "const_expr": gen_const_expr,
        "def_stmt": gen_def_stmt,
        "empty_stmt": gen_empty_stmt,
        "expr_stmt": gen_expr_stmt,
        "ident_expr": gen_ident_expr,
        "send_stmt": gen_send_stmt,
        "stmt_pair": gen_stmt_pair
    });
    if (crlf.lang !== "Humus") {
        error("expected_a_b", crlf, "Humus/CRLF", crlf.lang);
    }
    definitions.boot = generate(crlf.ast, ir_ref("commit", "$std"));
    return {
        lang: "uFork",
        ast: {
            kind: "module",
            import: {
                "$dev": "https://ufork.org/lib/dev.asm",
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
//debug const binary_app_text = `
//debug sub(mul(2, 3), 4)
//debug `;
//debug const unary_app_text = `
//debug not(neg(42))
//debug `;
//debug const logical_app_text = `
//debug and(or(1, 0), 2)
//debug `;
//debug const send_text = `
//debug SEND -123 TO println
//debug `;
//debug const log_send_text = `
//debug CREATE log WITH \\msg.[
//debug     SEND (#log, msg) TO println
//debug ]
//debug SEND 42 TO log
//debug `;
//debug const call_fma_text = `
//debug DEF fma(a, b, c) AS add(mul(a, b), c)
//debug SEND fma(3, 4, 5) TO println
//debug `;
//debug const sample_source = `
//debug (define sink-beh (BEH _))
//debug (define memo-beh
//debug     (lambda (value)
//debug         (BEH (cust)
//debug             (SEND cust value) )))
//debug (SEND
//debug     (CREATE (memo-beh 42))
//debug     (list (CREATE sink-beh)) )`;
//debug const fact_source = `
//debug (define fact
//debug     (lambda (n)
//debug         (if (> n 1)
//debug             (* n (fact (- n 1)))
//debug             1)))`;
//debug const ifact_source = `
//debug (define ifact  ; fact(n) == ifact(n 1)
//debug     (lambda (n a)
//debug         (if (> n 1)
//debug             (ifact (- n 1) (* a n))
//debug             a)))`;
//debug const fib_source = `
//debug (define fib
//debug     (lambda (n)
//debug         (if (< n 2)
//debug             n
//debug             (+ (fib (- n 1)) (fib (- n 2))) )))`;
//debug const hof2_source = `
//debug (define hof2
//debug     (lambda (x)
//debug         (lambda (y z)
//debug             (list x y z) )))`;
//debug const hof3_source = `
//debug (define hof3
//debug     (lambda (p)
//debug         (lambda (q r)
//debug             (lambda s
//debug                 (list p q r s) ))))`;
//debug const module = compile(unary_app_text);
//debug console.log(JSON.stringify(module, undefined, 2));
//debug console.log(disassemble(module));

// Test suite.

//debug function good(description, text) {
//debug     const result = compile(text);
//debug     if (result.errors.length > 0) {
//debug         console.log("FAIL", description);
//debug     }
//debug }
//debug function bad(description, text) {
//debug     const result = compile(text);
//debug     if (result.errors.length === 0) {
//debug         console.log("FAIL", description);
//debug     }
//debug }
//debug good("constant", "TRUE");
//debug bad("unknown constant", "MAYBE");
//debug good("print constant", "SEND 42 TO println");
//debug good("nested primitive calls", "sub(mul(2, 3), not(4))");
//debug bad("two args passed to unary", "not(1, 2)");
//debug bad("one arg passed to binary", "sub(1)");
//debug bad("three args passed to binary", "sub(1, 2, 3)");
//debug good("define and call a function", `
//debug     DEF fma(a, b, c) AS add(mul(a, b), c)
//debug     SEND fma(3, 4, 5) TO println
//debug `);

export default Object.freeze(compile);
