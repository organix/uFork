// uFork Humus compiler

// Transforms Humus source code into an intermediate representation
// that is suitable for loading.

// The intermediate representation is described in `ir.md`.

/*jslint long, white, devel */

import gen_json from "https://dalnefre.github.io/humus_js/gen_json.js";
import hum_xlat from "https://dalnefre.github.io/humus_js/hum_xlat.js";

function parse(text) {
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
        )
    };
}

const ignored = function () {
    return;
};
let info_log = console.log;  // Low volume, always shown unless all logging is disabled.
let warn_log = ignored;  // Something went wrong, but perhaps it wasn't fatal.
let debug_log = ignored;  // More detail to narrow down the source of a problem.
let trace_log = ignored;  // Extremely detailed, but very high volume.
warn_log = console.log;
//debug debug_log = console.log;
//debug trace_log = console.log;

/*
 * Humus/CRLF to IR code generator
 */

function codegen(crlf, src) {
    let errors = [];  // error reporting bucket
    let kind_maps = [];

    function error(message) {
        errors.push({
            kind: "error",
            message,
            src
        });
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
Patterns
{ "kind":"const_ptrn", "value":<value> }
{ "kind":"ident_ptrn", "ident":<string> }
{ "kind":"any_ptrn" }
{ "kind":"pair_ptrn", "head":<pattern>, "tail":<pattern> }
{ "kind":"value_ptrn", "expr":<expression> }
*/

    function generate(ast, k) {
        const kind_map = kind_maps.findLast(function (kind_map) {
            return Object.hasOwn(kind_map, ast.kind);
        });
        return (
            kind_map !== undefined
            ? kind_map[ast.kind](ast, k)
            : error("bad kind '" + ast.kind + "'")
        );
    }

    function gen_send_stmt(ast, k) {
        k = generate(ast.msg,                           // ... msg
            generate(ast.to,                            // ... msg actor
            ir_instr("send", -1,                        // ...
            k)));
        return k;
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
            return error("bad value '" + value + "'");
        }
        return k;
    }

    function gen_ident_expr(ast, k) {
        const ident = ast.ident;
        if (ident !== "println") {
            return error("println expected");
        }
        // top-level `println` is implemented by the debug device
        k = ir_instr("msg", 0,                          // ... {caps}
            ir_instr("push", 2,                         // ... {caps} dev.debug_key
            ir_instr("dict", "get",                     // ... debug_dev
            k)));
        return k;
    }

    function gen_empty_stmt(_, k) {
        return k;
    }

    function gen_stmt_pair(ast, k) {
        k = generate(ast.head,
            generate(ast.tail,
            k));
        return k;
    }

    kind_maps.push({
        "const_expr": gen_const_expr,
        "ident_expr": gen_ident_expr,
        "empty_stmt": gen_empty_stmt,
        "send_stmt": gen_send_stmt,
        "stmt_pair": gen_stmt_pair
    });

    if (crlf?.lang !== "Humus") {
        error("Humus/CRLF expected");
    }

    const k =
        generate(crlf.ast,
        ir_ref("commit", "$std"));
    return {
        lang: "uFork",
        ast: {
            kind: "module",
            import: {"$std": "https://ufork.org/lib/std.asm"},
            define: {boot: k},
            export: ["boot"]
        },
        errors
    };
}

function compile(text, src) {
    return codegen(parse(text), src);
}

//debug import disassemble from "./disassemble.js";
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
//debug const module = compile(send_text);
//debug info_log(JSON.stringify(module, undefined, 2));
//debug info_log(disassemble(module));

export default Object.freeze(compile);
