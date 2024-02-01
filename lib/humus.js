// uFork Humus compiler

// Transforms Humus source code into an intermediate representation
// that is suitable for loading.

// The intermediate representation is described in `ir.md`.

const ignored = function () {};
let info_log = console.log;  // Low volume, always shown unless all logging is disabled.
let warn_log = ignored;  // Something went wrong, but perhaps it wasn't fatal.
let debug_log = ignored;  // More detail to narrow down the source of a problem.
let trace_log = ignored;  // Extremely detailed, but very high volume.
warn_log = console.log;
//debug debug_log = console.log;
//debug trace_log = console.log;

/*
 * uFork/CRLF (IR) elements
 */

const undef_lit =   { kind: "literal", value: "undef" };
const nil_lit =     { kind: "literal", value: "nil" };
const false_lit =   { kind: "literal", value: "false" };
const true_lit =    { kind: "literal", value: "true" };
const unit_lit =    { kind: "literal", value: "unit" };

const literal_t =   { kind: "type", name: "literal" };
const type_t =      { kind: "type", name: "type" };
const fixnum_t =    { kind: "type", name: "fixnum" };
const actor_t =     { kind: "type", name: "actor" };
const instr_t =     { kind: "type", name: "instr" };
const pair_t =      { kind: "type", name: "pair" };
const dict_t =      { kind: "type", name: "dict" };

function mapping(map, name) {
    if (typeof map === "object" && Object.hasOwn(map, name)) {
        return map[name];
    }
}

/*
 * Humus/CRLF compiler
 */

function compile(crlf, file) {

    function ir_quad(t, x, y, z) {
        const value = { kind: "quad", debug, t };
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
    
    function ir_type(name) {
        return {
            kind: "type",
            name,
            debug
        };
    }
    
    function ir_quad_type(arity) {
        return {
            kind: "type",
            arity,
            debug
        };
    }
    
    function ir_pair(head, tail) {
        return {
            kind: "pair",
            head,
            tail,
            debug
        };
    }
    
    function ir_dict(key, value, next = nil_lit) {
        return {
            kind: "dict",
            key,
            value,
            next,
            debug
        };
    }
    
    function ir_ref(name, module) {
        return {
            kind: "ref",
            module,  // optional
            name,
            debug
        };
    }
    
    function ir_instr(op, imm = undef_lit, k = undef_lit) {
        if (k?.error) {
            return k;
        }
        return {
            kind: "instr",
            op,
            imm,
            k,
            debug
        };
    }
    
    function ir_if_instr(t = undef_lit, f = undef_lit) {
        if (t?.error) {
            return t;
        }
        if (f?.error) {
            return f;
        }
        return {
            kind: "instr",
            op: "if",
            t,
            f,
            debug
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
    const kind_map = {
        "send_stmt": gen_send_stmt,
        "const_expr": gen_const_expr,
        "ident_expr": gen_ident_expr,
    };

    function new_module_ctx() {
        const ctx = {
            kind_map: Object.assign(
                Object.create(null),
                kind_map),
        };
        return ctx;
    }

    function generate(ctx, ast, k) {
        if (k?.error) {
            return k;
        }
        const gen = mapping(ctx.kind_map, ast?.kind);
        if (typeof gen === "function") {
            k = gen(ctx, ast, k);
        } else {
            return {
                error: "bad `kind` of node",
                ast,
                ctx
            };
        }
        return k;
    }

    function gen_send_stmt(ctx, ast, k) {
        if (k?.error) {
            return k;
        }
        k = generate(ctx, ast?.msg,             // ... msg
            generate(ctx, ast?.to,              // ... msg actor
            ir_instr("send", -1,                // ...
            k)));
        return k;
    }

    function gen_const_expr(ctx, ast, k) {
        if (k?.error) {
            return k;
        }
        const value = ast?.value;
        if (typeof value === "number") {
            k = ir_instr("push", value,             // ... value
                k);
        } else if (value === true) {
            k = ir_instr("push", true_lit,          // ... #t
                k);
        } else if (value === false) {
            k = ir_instr("push", false_lit,         // ... #f
                k);
        } else {
            return {
                error: "bad `value` type",
                ast,
                ctx
            };
        }
        return k;
    }

    function gen_ident_expr(ctx, ast, k) {
        if (k?.error) {
            return k;
        }
        const ident = ast?.ident;
        if (ident !== "println") {
            return {
                error: "println expected",
                ast,
                ctx
            };
        }
        // top-level `println` is implemented by the debug device
        k = ir_instr("msg", 0,                  // ... {caps}
            ir_instr("push", 2,                 // ... {caps} dev.debug_key
            ir_instr("dict", "get",             // ... debug_dev
            k)));
        return k;
    }

    const debug = undefined; //{ kind: "debug", file };

    if (crlf?.lang !== "Humus") {
        return {
            error: "Humus/CRLF expected",
            file,
            crlf
        };
    }

    const import_map = {
        "$std": "https://ufork.org/lib/std.asm"
    };
    const module_env = {
        "boot": ir_ref("commit", "$std"),  // replaced by compiler...
    };
    const export_list = [
        "boot",
    ];
    const ctx = new_module_ctx();

    let k =
        generate(ctx, crlf.ast,
        ir_ref("commit", "$std"));
    if (k?.error) {
        return k;
    }

    module_env["boot"] = k;
    return {
        lang: "uFork",
        ast: {
            kind: "module",
            import: import_map,
            define: module_env,
            export: export_list
        }
    };
}

/* FIXME: find a way to encapsulate this "global" state! */
let asm_label = 0;  // used by `to_asm()`
/*
prefixes {a, d, f, i, j, k, n, t, v, x, y}
    if: t, f, j
    instr: i, k
    quad: x, y
    pair: a, d
    dict: v, n
*/
function is_asm_leaf(crlf) {
    if (typeof crlf === "object") {
        const kind = crlf?.kind;
        if (kind === "literal" || kind === "ref") {
            return true;
        }
        if (kind === "type") {
            return (typeof crlf.arity !== "number");
        }
        return false;
    }
    return true;
}
function to_asm(crlf) {
    if (crlf?.error) {
        return JSON.stringify(crlf, undefined, 2);
    }
    if (typeof crlf === "string") {
        return crlf;
    }
    if (typeof crlf === "number") {
        return String(crlf);
    }
    let s = "";
    const kind = crlf?.kind;
    if (kind === "module") {
        let imports = crlf?.import;
        if (imports) {
            const entries = Object.entries(imports);
            if (entries.length > 0) {
                s += ".import\n";
                for (const [name, value] of entries) {
                    s += "    " + name + ": ";
                    s += JSON.stringify(value) + "\n";
                }
            }
        }
        asm_label = 1;
        for (const [name, value] of Object.entries(crlf.define)) {
            s += '"' + name + '"' + ":\n";
            if (is_asm_leaf(value)) {
                s += "    ref " + to_asm(value) + "\n";
            } else {
                s += to_asm(value);
            }
        }
        let exports = crlf?.export;
        if (Array.isArray(exports) && exports.length > 0) {
            s += ".export\n";
            for (const name of exports) {
                s += "    " + '"' + name + '"' + "\n";
            }
        }
    } else if (kind === "instr") {
        s += "    " + crlf.op;
        if (crlf.op === "if") {
            // generate labels for branch targets
            let t_label = "t~" + asm_label;
            let f_label = "f~" + asm_label;
            let j_label = "j~" + asm_label;
            asm_label += 1;
            s += " " + '"' + t_label + '"';
            s += " " + '"' + f_label + '"' + "\n";
            const join = join_instr_chains(crlf.t, crlf.f, j_label);
            s += '"' + t_label + '"' + ":\n";
            s += to_asm(crlf.t);
            s += '"' + f_label + '"' + ":\n";
            s += to_asm(crlf.f);
            if (join) {
                s += '"' + j_label + '"' + ":\n";
                s += to_asm(join);
            }
            return s;
        }
        if (crlf.op !== "debug") {
            if (is_asm_leaf(crlf.imm)) {
                s += " " + to_asm(crlf.imm);
            } else {
                // generate labels for immediate data
                let i_label = "i~" + asm_label;
                let k_label = "k~" + asm_label;
                asm_label += 1;
                s += " " + '"' + i_label + '"';
                s += " " + '"' + k_label + '"' + "\n";
                s += '"' + i_label + '"' + ":\n";
                s += to_asm(crlf.imm);
                s += '"' + k_label + '"' + ":\n";
                s += to_asm(crlf.k);
                return s;
            }
        }
        s += "\n";
        if (crlf.op !== "end") {
            if (is_asm_leaf(crlf.k)) {
                s += "    ref " + to_asm(crlf.k) + "\n";
            } else {
                s += to_asm(crlf.k);
            }
        }
    } else if (kind === "symbol") {
        if (crlf.module) {
            s += crlf.module + ".";
        }
        s += crlf.name;
    } else if (kind === "literal") {
        const name = crlf.value;
        if (name === "undef") {
            return "#?";
        } else if (name === "nil") {
            return "#nil";
        } else if (name === "false") {
            return "#f";
        } else if (name === "true") {
            return "#t";
        } else if (name === "unit") {
            return "#unit";
        } else {
            return "#unknown";
        }
    } else if (kind === "type") {
        const arity = crlf.arity;
        if (typeof arity === "number") {
            s += "    type_t " + arity + "\n";
        } else {
            const name = crlf.name;
            if (typeof name === "string") {
                s += "#" + name + "_t";
            } else {
                s += "#unknown_t";
            }
        }
    } else if (kind === "pair") {
        s += "    pair_t ";
        if (is_asm_leaf(crlf.head)) {
            s += to_asm(crlf.head) + "\n";
            if (is_asm_leaf(crlf.tail)) {
                s += "    ref " + to_asm(crlf.tail) + "\n";
            } else {
                s += to_asm(crlf.tail);
            }
        } else {
            // generate labels for complex data
            let a_label = "a~" + asm_label;
            let d_label = "d~" + asm_label;
            asm_label += 1;
            s += '"' + a_label + '"' + " ";
            s += '"' + d_label + '"' + "\n";
            s += '"' + a_label + '"' + ":\n";
            s += to_asm(crlf.head);
            s += '"' + d_label + '"' + ":\n";
            s += to_asm(crlf.tail);
            return s;
        }
    } else if (kind === "dict") {
        s += "    dict_t ";
        if (!is_asm_leaf(crlf.key)) {
            return {
                error: "dict key must be asm leaf",
                crlf
            };
        }
        s += to_asm(crlf.key) + " ";
        if (is_asm_leaf(crlf.value)) {
            s += to_asm(crlf.value) + "\n";
            if (is_asm_leaf(crlf.next)) {
                s += "    ref " + to_asm(crlf.next) + "\n";
            } else {
                s += to_asm(crlf.next);
            }
        } else {
            // generate labels for complex data
            let v_label = "v~" + asm_label;
            let n_label = "n~" + asm_label;
            asm_label += 1;
            s += '"' + v_label + '"' + " ";
            s += '"' + n_label + '"' + "\n";
            s += '"' + v_label + '"' + ":\n";
            s += to_asm(crlf.value);
            s += '"' + n_label + '"' + ":\n";
            s += to_asm(crlf.next);
            return s;
        }
    } else if (kind === "ref") {
        const name = crlf.name;
        const module = crlf.module;
        if (typeof module === "string") {
            s += module + "." + name;
        } else {
            s += '"' + crlf.name + '"';
        }
    } else if (kind === "quad") {
        let arity = (crlf.z === undefined)
            ? (crlf.y === undefined)
                ? (crlf.x === undefined)
                    ? 0
                    : 1
                : 2
            : 3;
        let x_is_leaf = is_asm_leaf(crlf.x);
        let y_is_leaf = is_asm_leaf(crlf.y);
        let z_is_leaf = is_asm_leaf(crlf.z);
        // generate labels for quad data fields
        let x_label = "x~" + asm_label;
        let y_label = "y~" + asm_label;
        let s = "    quad_" + (arity + 1) + " ";
        s += to_asm(crlf.t);
        let eos = "\n";
        if (arity === 1) {
            if (x_is_leaf) {
                s += " " + to_asm(crlf.x);
            } else {
                eos += to_asm(crlf.x);
                x_is_leaf = true;
            }
        } else if (arity === 2) {
            if (x_is_leaf) {
                s += " " + to_asm(crlf.x);
            } else {
                s += ' "' + x_label + '"';
            }
            if (y_is_leaf) {
                s += " " + to_asm(crlf.y);
            } else {
                eos += to_asm(crlf.y);
                y_is_leaf = true;
            }
        } else if (arity === 3) {
            if (x_is_leaf) {
                s += " " + to_asm(crlf.x);
            } else {
                s += ' "' + x_label + '"';
            }
            if (y_is_leaf) {
                s += " " + to_asm(crlf.y);
            } else {
                s += ' "' + y_label + '"';
            }
            if (z_is_leaf) {
                s += " " + to_asm(crlf.z);
            } else {
                eos += to_asm(crlf.z);
            }
        }
        s += eos;
        if (!x_is_leaf || !y_is_leaf) {  // all leaves? no labels.
            asm_label += 1;
        }
        if (!x_is_leaf) {
            s += '"' + x_label + '"' + ":\n";
            s += to_asm(crlf.x);
        }
        if (!y_is_leaf) {
            s += '"' + y_label + '"' + ":\n";
            s += to_asm(crlf.y);
        }
        return s;
    } else {
        return {
            error: "unknown asm",
            crlf
        }
    }
    return s;
}

export default Object.freeze({compile, to_asm});

/*
SEND -123 TO println
*/
const send_crlf = { lang: "Humus", ast: {
  "kind": "send_stmt",
  "msg": {
    "kind": "const_expr",
    "value": -123
  },
  "to": {
    "kind": "ident_expr",
    "ident": "println"
  }
}};

/*
CREATE log WITH \msg.[
    SEND (#log, msg) TO println
]
SEND 42 TO log
*/
const log_send_crlf = { lang: "Humus", ast: {
"kind": "stmt_pair",
"head": {
  "kind": "create_stmt",
  "ident": "log",
  "expr": {
    "kind": "abs_expr",
    "ptrn": {
      "kind": "ident_ptrn",
      "ident": "msg"
    },
    "body": {
      "kind": "block_expr",
      "vars": [],
      "stmt": {
        "kind": "stmt_pair",
        "head": {
          "kind": "send_stmt",
          "msg": {
            "kind": "pair_expr",
            "head": {
              "kind": "const_expr",
              "value": "log"
            },
            "tail": {
              "kind": "ident_expr",
              "ident": "msg"
            }
          },
          "to": {
            "kind": "ident_expr",
            "ident": "println"
          }
        },
        "tail": {
          "kind": "empty_stmt"
        }
      }
    }
  }
},
"tail": {
  "kind": "send_stmt",
  "msg": {
    "kind": "const_expr",
    "value": 42
  },
  "to": {
    "kind": "ident_expr",
    "ident": "log"
  }
}}};

const sample_source = `
(define sink-beh (BEH _))
(define memo-beh
    (lambda (value)
        (BEH (cust)
            (SEND cust value) )))
(SEND
    (CREATE (memo-beh 42))
    (list (CREATE sink-beh)) )`;
const fact_source = `
(define fact
    (lambda (n)
        (if (> n 1)
            (* n (fact (- n 1)))
            1)))`;
const ifact_source = `
(define ifact  ; fact(n) == ifact(n 1)
    (lambda (n a)
        (if (> n 1)
            (ifact (- n 1) (* a n))
            a)))`;
const fib_source = `
(define fib
    (lambda (n)
        (if (< n 2)
            n
            (+ (fib (- n 1)) (fib (- n 2))) )))`;
const hof2_source = `
(define hof2
    (lambda (x)
        (lambda (y z)
            (list x y z) )))`;
const hof3_source = `
(define hof3
    (lambda (x)
        (lambda (y z)
            (lambda q
                (list x y z q) ))))`;

//debug const crlf = send_crlf;
// const crlf = log_send_crlf;
//debug info_log(JSON.stringify(crlf, undefined, 2));
//debug const module = compile(crlf);
//debug info_log(JSON.stringify(module, undefined, 2));
// if (!module?.error) {
//debug     info_log(to_asm(module.ast));
// }
