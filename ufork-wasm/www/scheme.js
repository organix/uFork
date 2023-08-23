// uFork Scheme compiler

// Transforms Scheme source code into an intermediate representation
// that is suitable for loading.

// The intermediate representation is described in crlf.md.

let asm_label = 0;  // used by `to_asm()`

/*
 * uFork/CRLF elements
 */

const undef_lit =   { "kind": "literal", "value": "undef" };
const nil_lit =     { "kind": "literal", "value": "nil" };
const false_lit =   { "kind": "literal", "value": "false" };
const true_lit =    { "kind": "literal", "value": "true" };
const unit_lit =    { "kind": "literal", "value": "unit" };

const literal_t =   { "kind": "type", "name": "literal" };
const type_t =      { "kind": "type", "name": "type" };
const fixnum_t =    { "kind": "type", "name": "fixnum" };
const actor_t =     { "kind": "type", "name": "actor" };
const instr_t =     { "kind": "type", "name": "instr" };
const pair_t =      { "kind": "type", "name": "pair" };
const dict_t =      { "kind": "type", "name": "dict" };

const quote_ref =   { "kind": "ref", "name": "quote" };  // FIXME: do we need a "module" here?
const qquote_ref =  { "kind": "ref", "name": "quasiquote" };
const unquote_ref = { "kind": "ref", "name": "unquote" };
const qsplice_ref = { "kind": "ref", "name": "unquote-splicing" };

function new_pair(head, tail) {
    return { "kind": "pair", head, tail };
}

function new_dict(key, value, next = nil_lit) {
    return { "kind": "dict", key, value, next };
}

function new_instr(op, imm = undef_lit, k = undef_lit) {
    if (k?.error) {
        return k;
    }
    return { "kind": "instr", op, imm, k };
}

function new_if_instr(t = undef_lit, f = undef_lit) {
    if (t?.error) {
        return t;
    }
    if (f?.error) {
        return f;
    }
    return { "kind": "instr", "op": "if", t, f };
}

// standard instruction-stream tails
const std = {};
std.commit = new_instr("end", "commit");
std.send_msg = new_instr("send", -1, std.commit);
std.cust_send = new_instr("msg", 1, std.send_msg);

function length_of(sexpr) {
    let n = 0;
    while (sexpr?.kind === "pair") {
        n += 1;
        sexpr = sexpr?.tail;
    }
    return n;
}

function equal_to(expect, actual) {
    if (expect === actual) {
        return true;
    }
    if (expect?.kind && (expect?.kind === actual?.kind)) {
        if (expect.kind === "pair") {
            while (expect.tail?.kind === "pair") {
                if (actual?.tail?.kind !== "pair") {
                    return false;
                }
                if (!equal_to(expect.head, actual?.head)) {
                    return false;
                }
                expect = expect.tail;
                actual = actual?.tail;
            }
            return equal_to(expect.tail, actual?.tail);
        } else if (expect.kind === "dict") {
            while (expect.tail?.kind === "dict") {
                if (actual?.tail?.kind !== "dict") {
                    return false;
                }
                // FIXME: dictionaries are unordered...
                if (!equal_to(expect.key, actual?.key)) {
                    return false;
                }
                if (!equal_to(expect.value, actual?.value)) {
                    return false;
                }
                expect = expect.next;
                actual = actual?.next;
            }
            return equal_to(expect.next, actual?.next);
        } else if (expect.kind === "literal") {
            return equal_to(expect?.value, actual?.value);
        } else if (expect.kind === "type") {
            return equal_to(expect?.name, actual?.name);
        } else if (expect.kind === "instr") {
            if (expect?.op !== actual?.op) {
                return false;
            }
            if (expect?.op === "if") {
                return equal_to(expect?.t, actual?.t)
                    && equal_to(expect?.f, actual?.f);
            }
            return equal_to(expect?.imm, actual?.imm)
                && equal_to(expect?.k, actual?.k);
        } else if (expect.kind === "ref") {
            return equal_to(expect?.name, actual?.name)
                && equal_to(expect?.module, actual?.module);
        }
    }
    return false;
}

// Scheme s-expressions (sexprs) are represented by uFork-ASM CRLF objects.
//    * symbol = { "kind": "ref", "name": <string> }
//    * cons = { "kind": "pair", "head": <sexpr>, "tail": <sexpr> }
//    * literal = { "kind": "literal", "name": <string> }
//    * number = <number>
//    * type = { "kind": "type", "name": <string> }

function to_scheme(sexpr) {
    if (typeof sexpr === "object") {
        const kind = sexpr.kind;
        if (typeof kind === "string") {
            if (kind === "pair") {
                let s = "(";
                while (true) {
                    s += to_scheme(sexpr?.head);
                    if (sexpr?.tail?.kind !== "pair") {
                        break;
                    }
                    sexpr = sexpr?.tail;
                    s += " ";
                }
                if (!equal_to(nil_lit, sexpr?.tail)) {
                    s += " . ";
                    s += to_scheme(sexpr?.tail);
                }
                s += ")";
                return s;
            } else if (kind === "dict") {
                let s = "{";
                while (true) {
                    s += to_scheme(sexpr?.key) + ":" + to_scheme(sexpr?.value);
                    if (sexpr?.next?.kind !== "dict") {
                        break;
                    }
                    sexpr = sexpr?.next;
                    s += ",";
                }
                s += "}";
                return s;
            } else if (kind === "literal") {
                const name = sexpr?.value;
                if (name === "undef") {
                    return "#?";
                } else if (name === "nil") {
                    return "()";
                } else if (name === "false") {
                    return "#f";
                } else if (name === "true") {
                    return "#t";
                } else if (name === "unit") {
                    return "#unit";
                }
            } else if (kind === "type") {
                const name = sexpr?.name;
                if (typeof name === "string") {
                    return "#" + name + "_t";
                } else {
                    return "#unknown_t";
                }
            } else if (kind === "ref") {
                let s = "";
                const module = sexpr?.module;
                if (typeof module === "string") {
                    s += module + ".";
                }
                const name = sexpr?.name;
                if (typeof name === "string") {
                    s += name;
                    return s;
                }
            } else if (kind === "instr") {
                let s = "[#instr_t, ";
                s += to_scheme(sexpr?.op);
                s += ", ";
                s += to_scheme(sexpr?.imm);
                s += ", ";
                s += to_scheme(sexpr?.k);
                s += "]";
                return s;
            } else {
                return "#" + kind + "...";
            }
        }
        return "#unknown";
    }
    if (typeof sexpr === "string") {
        return JSON.stringify(sexpr);  // quoted and escaped
    }
    return String(sexpr);
}

/*
 * Scheme language parsing
 */

function string_input(string, start = 0) {
    if (typeof string !== "string") {
        throw new Error("string required");
    }
    return function next_char() {
        const code = string.codePointAt(start);
        //console.log("next_char", code, "at", start);
        if (code === undefined) {
            return {
                error: "end of input",
                source: string,
                start,
                end: start
            }
        }
        const end = start + (code <= 0xFFFF ? 1 : 2);
        return {
            token: String.fromCodePoint(code),
            code: code,
            source: string,
            start,
            end,
            next: string_input(string, end)
        };
    };
}

function skip_comment(next) {
    while (true) {
        let input = next();
        if (input.error) {
            return next;  // stop on error
        }
        if (input.token === "\r") {
            next = input.next;
            input = next();
            if (input.error) {
                return next;
            }
            if (input.token === "\n") {
                return input.next;
            }
            return next;
        } else if (input.token === "\n") {
            return input.next;
        }
        next = input.next;
    }
}

function skip_whitespace(next) {
    while (true) {
        let input = next();
        if (input.error) {
            return next;  // stop on error
        }
        if (input.token === ";") {
            next = skip_comment(input.next);
        } else if (/[ \t-\r]/.test(input.token)) {
            next = input.next;
        } else {
            return next;  // stop on non-whitespace
        }
    }
}

function lex_input(next_char) {
    if (typeof next_char !== "function") {
        throw new Error("function required");
    }
    return function next_token() {
        let next = skip_whitespace(next_char);
        const input = next();
        //console.log("next_token", input);
        if (input.error) {
            return input;  // report error
        }
        if (/[().'`]/.test(input.token)) {
            input.next = lex_input(input.next);
            return input;  // single-character token
        } else if (input.token === ",") {
            const peek = input.next();
            if (peek.error) {
                return peek;  // report error
            }
            if (peek.token === "@") {
                // extend token
                input.token += peek.token;
                input.end = peek.end;
                input.next = peek.next;
            }
            input.next = lex_input(input.next);
            return input;
        }
        let scan = input;
        delete input.code;
        while (true) {
            next = scan.next;
            scan = next();
            if (scan.error) {
                break;  // stop on error
            }
            if (/[-+a-zA-Z0-9!$%&*./:<=>?@\\^_|~]/.test(scan.token)) {
                // accumulate token characters
                input.token += scan.token;
                input.end = scan.end;
            } else {
                break;
            }
        }
        if (input.token === "#?") {
            input.token = undef_lit;
        } else if (input.token === "#nil") {
            input.token = nil_lit;
        } else if (input.token === "#f") {
            input.token = false_lit;
        } else if (input.token === "#t") {
            input.token = true_lit;
        } else if (input.token === "#unit") {
            input.token = unit_lit;
        } else if (input.token.startsWith("#")) {
            input.error = "unknown literal";  // convert to error
        } else {
            const number = Number(input.token);  // FIXME: implement better conversion method
            if (Number.isSafeInteger(number)) {
                input.token = number;
            }
        }
        input.next = lex_input(next);
        return input;
    }
}

function parse_tail(next) {
    let input = next();
    console.log("parse_tail", input);
    if (input.error) {
        return input;  // report error
    }
    if (input.token === ")") {
        input.token = nil_lit;
        return input;
    }
    if (input.token === ".") {
        let tail = parse_sexpr(input.next);
        let scan = tail.next();
        if (scan.token !== ')') {
            scan.error = "expected ')'";
            return scan;
        }
        tail.end = scan.end;
        tail.next = scan.next;
        return tail;
    }
    let scan = parse_sexpr(next);
    if (scan.error) {
        return scan;  // report error
    }
    let tail = parse_tail(scan.next);
    if (tail.error) {
        return tail;  // report error
    }
    input.token = new_pair(scan.token, tail.token);
    input.end = tail.end;
    input.next = tail.next;
    return input;
}

function parse_list(input) {
    let next = input.next;
    let scan = next();
    console.log("parse_list", scan);
    if (scan.error) {
        return scan;  // report error
    }
    if (scan.token === ")") {
        input.token = nil_lit;
        input.end = scan.end;
        input.next = scan.next;
        return input;
    }
    if (scan.token === ".") {
        return {
            error: "unexpected dot",
            start: input.start,
            end: scan.end
        };            
    }
    scan = parse_sexpr(next);
    if (scan.error) {
        return scan;  // report error
    }
    let tail = parse_tail(scan.next);
    if (tail.error) {
        return tail;  // report error
    }
    input.token = new_pair(scan.token, tail.token);
    input.end = tail.end;
    input.next = tail.next;
    return input;
}

function parse_quote(input, quote) {
    let scan = parse_sexpr(input.next);
    console.log("parse_quote", scan);
    if (scan.error) {
        return scan;  // report error
    }
    input.token = new_pair(quote, new_pair(scan.token, nil_lit));
    input.end = scan.end;
    input.next = scan.next;
    return input;
}

function parse_sexpr(next) {
    const input = next();
    console.log("parse_sexpr", input);
    if (input.error) {
        return input;  // report error
    }
    if (typeof input.token === "number") {
        return input;  // number sexpr
    }
    if (input.token === ".") {
        return {
            error: "unexpected dot",
            start: input.start,
            end: input.end
        };            
    }
    if (input.token === "(") {
        return parse_list(input);
    }
    if (input.token === "'") {
        return parse_quote(input, quote_ref);
    }
    if (input.token === "`") {
        return parse_quote(input, qquote_ref);
    }
    if (input.token === ",") {
        return parse_quote(input, unquote_ref);
    }
    if (input.token === ",@") {
        return parse_quote(input, qsplice_ref);
    }
    if (typeof input.token === "string") {
        // symbol sexpr
        input.token = {
            kind: "ref",
            name: input.token
        };    
    }
    return input;
}

/*
 * Scheme interpreter/compiler
 */

const cont_ref =    { "kind": "ref", "name": "cont_beh" };
const cont_beh =                // (msg cont sp) <- rv
    new_instr("state", 1,       // msg
    new_instr("my", "self",     // msg SELF
    new_instr("send", -1,       // --
    new_instr("state", 3,       // sp
    new_instr("msg", 0,         // sp rv
    new_instr("pair", 1,        // sp'=(rv . sp)
    new_instr("state", 2,       // sp' cont
    new_instr("beh", 1,         // --
    std.commit))))))));

// Return the 'nth' item from a list of pairs, if defined.
//
//           0          -1          -2          -3
//      lst -->[car,cdr]-->[car,cdr]-->[car,cdr]-->...
//            +1 |        +2 |        +3 |
//               V           V           V
//
function nth_sexpr(sexpr, n) {
    while (true) {
        if (n === 0) {
            return sexpr;
        }
        if (sexpr?.kind !== "pair") {
            return undefined;
        }
        if (n === 1) {
            return sexpr?.head;
        }
        sexpr = sexpr?.tail;
        n += (n < 0) ? 1 : -1;
    }
}

function pattern_to_map(pattern, n = 0) {
    const map = {};
    while (pattern?.kind === "pair") {
        n += 1;
        const head = pattern?.head;
        if (head?.kind === "ref") {
            const name = head?.name;
            if (name !== "_") {
                map[name] = n;
            }
        }
        pattern = pattern?.tail;
    }
    if (pattern?.kind === "ref") {
        const name = pattern?.name;
        if (name !== "_") {
            map[name] = -n;
        }
    }
    return map;
}

function parse(source) {
    const str_in = string_input(source);
    const lex_in = lex_input(str_in);
    const sexpr = parse_sexpr(lex_in);
    console.log("parse", JSON.stringify(sexpr, undefined, 2));
    return sexpr;
}
function compile(source) {
    const sexpr = parse(source);
    const ctx = {
        kind: "module",
        define: {}
    };
    console.log("compile", to_scheme(sexpr.token));
    const module = compile_sexpr(ctx, sexpr.token);
    return module;
}

function literal_value(ctx, crlf, k) {
    return crlf;
}

const module_ctx = {
    number: literal_value,
    type: literal_value,
    literal: literal_value,
    ref: function(ctx, crlf) {
        const name = crlf.name;
        const value = ctx.env[name];
        if (value !== undefined) {
            return value;
        }
        return {
            error: "undefined variable",
            name
        };
    },
    pair: function(ctx, crlf, k) {
        const func = nth_sexpr(crlf, 1);
        const args = nth_sexpr(crlf, -1);
        const kind = func?.kind;
        if (kind === "ref") {
            const name = func?.name;
            if (name === "define") {
                const symbol = nth_sexpr(args, 1);
                if (symbol?.kind === "ref") {
                    const expr = nth_sexpr(args, 2);
                    const value = interpret(ctx, expr);
                    if (value?.error) {
                        return value;
                    }
                    ctx.env[symbol.name] = value;
                    return unit_lit;
                }
            } else if (name === "lambda") {
                const ptrn = nth_sexpr(args, 1);
                const body = nth_sexpr(args, -1);
                console.log("lambda:", "ptrn:", to_scheme(ptrn));
                console.log("lambda:", "body:", to_scheme(body));
                const child = Object.assign({}, lambda_ctx);
                child.parent = ctx;
                child.msg_map = pattern_to_map(ptrn, 1);  // skip implicit customer
                console.log("lambda:", "msg_map:", child.msg_map);
                if (body?.kind === "pair") {
                    let code =
                        interpret_list(child, body,
                        std.cust_send);
                    return code;
                } else {
                    let code =
                        new_instr("push", unit_lit,
                        std.cust_send);
                    return code;
                }
            }
        }
        return {
            error: "no interpretation",
            crlf,
            ctx
        };
    },
    env: {
        cont_beh: cont_beh
    }
};

function push_literal(ctx, crlf, k) {
    let code = new_instr("push", crlf, k);
    return code;
}

const lambda_ctx = {
    number: push_literal,
    type: push_literal,
    literal: push_literal,
    ref: function(ctx, crlf, k) {
        const name = crlf.name;
        const msg_n = ctx.msg_map[name];
        if (typeof msg_n === "number") {
            // message variable
            let code = new_instr("msg", msg_n, k);
            return code;
        }
        // free variable
        let code = new_instr("push", crlf, k);
        return code;
    },
    pair: function(ctx, crlf, k) {
        const func = crlf.head;
        const args = crlf.tail;
        const kind = func?.kind;
        if (kind === "ref") {
            const name = func?.name;
            const xlat = ctx.func[name];
            if (typeof xlat === "function") {
                return xlat(ctx, args, k);
            }
            return interpret_cont(ctx, crlf, k);
        }
        return {
            error: "no translation",
            crlf,
            ctx
        };
    },
    func: {
        BEH: xlat_BEH,
        SEND: xlat_SEND,
        car: xlat_car,
        cdr: xlat_cdr,
        cons: xlat_cons,
        list: xlat_list,
        "eq?": xlat_eq,
        "<": xlat_lt_num,
        "<=": xlat_le_num,
        "=": xlat_eq_num,
        ">=": xlat_ge_num,
        ">": xlat_gt_num,
        "+": xlat_add_num,
        "-": xlat_sub_num,
        "*": xlat_mul_num,
        if: xlat_if,
        id: xlat_id
    },
    state_map: {},
    msg_map: {}
};

const BEH_ctx = {
    number: push_literal,
    type: push_literal,
    literal: push_literal,
    ref: function(ctx, crlf, k) {
        const name = crlf.name;
        if (name === "SELF") {
            return new_instr("my", "self", k);  // SELF reference
        }
        const msg_n = ctx.msg_map[name];
        if (typeof msg_n === "number") {
            return new_instr("msg", msg_n, k);  // message variable
        }
        const state_n = ctx.state_map[name];
        if (typeof state_n === "number") {
            return new_instr("state", state_n, k);  // state variable
        }
        return new_instr("push", crlf, k);  // free variable
    },
    pair: function(ctx, crlf, k) {
        const func = crlf.head;
        const args = crlf.tail;
        const kind = func?.kind;
        if (kind === "ref") {
            const name = func?.name;
            const xlat = ctx.func[name];
            if (typeof xlat === "function") {
                return xlat(ctx, args, k);
            }
        }
        return {
            error: "no translation",
            crlf,
            ctx
        };
    },
    func: {
        BECOME: xlat_not_implemented
    },
    state_map: {},
    msg_map: {}
};

function xlat_BEH(ctx, args, k) {
    const ptrn = nth_sexpr(args, 1);
    const body = nth_sexpr(args, -1);
    console.log("BEH:", "ptrn:", to_scheme(ptrn));
    console.log("BEH:", "body:", to_scheme(body));
    const child = Object.assign({}, BEH_ctx);
    child.parent = ctx;
    child.state_map = ctx.msg_map;
    console.log("BEH:", "state_map:", child.state_map);
    child.msg_map = pattern_to_map(ptrn);
    console.log("BEH:", "msg_map:", child.msg_map);
    const func = Object.assign({}, ctx.func);
    child.func = Object.assign(func, child.func);
    let code =
        interpret_list(child, body,
        std.commit);
    return code;
}

function xlat_SEND(ctx, args, k) {
    const target = nth_sexpr(args, 1);
    const msg = nth_sexpr(args, 2);
    let code =
        interpret(ctx, msg,             // msg
        interpret(ctx, target,          // msg target
        new_instr("send", -1, k)));     // --
    return code;
}

function xlat_car(ctx, args, k) {
    const pair = nth_sexpr(args, 1);
    let code =
        interpret(ctx, pair,            // (head . tail)
        new_instr("nth", 1, k));        // head
    return code;
}

function xlat_cdr(ctx, args, k) {
    const pair = nth_sexpr(args, 1);
    let code =
        interpret(ctx, pair,            // (head . tail)
        new_instr("nth", -1, k));       // tail
    return code;
}

function xlat_cons(ctx, args, k) {
    const head = nth_sexpr(args, 1);
    const tail = nth_sexpr(args, 2);
    let code =
        interpret(ctx, tail,            // tail
        interpret(ctx, head,            // tail head
        new_instr("pair", 1, k)));      // (head . tail)
    return code;
}

function xlat_list(ctx, args, k) {
    let arg_stack = [];
    while (args?.kind === "pair") {
        const head = args?.head;
        arg_stack.push(head);
        args = args?.tail;
    }
    let n = arg_stack.length;
    console.log("list:", arg_stack);
    let code = new_instr("pair", n, k);
    arg_stack.forEach(function (expr) {
        code = interpret(ctx, expr, code);
    });
    code = new_instr("push", nil_lit, code);
    return code;
}

function xlat_eq(ctx, args, k) {
    const expect = nth_sexpr(args, 1);
    const actual = nth_sexpr(args, 2);
    let code =
        interpret(ctx, expect,          // expect
        interpret(ctx, actual,          // expect actual
        new_instr("cmp", "eq", k)));    // expect==actual
    return code;
}

function xlat_lt_num(ctx, args, k) {
    const n = nth_sexpr(args, 1);
    const m = nth_sexpr(args, 2);
    let code =
        interpret(ctx, n,               // n
        interpret(ctx, m,               // n m
        new_instr("cmp", "lt", k)));    // n<m
    return code;
}

function xlat_le_num(ctx, args, k) {
    const n = nth_sexpr(args, 1);
    const m = nth_sexpr(args, 2);
    let code =
        interpret(ctx, n,               // n
        interpret(ctx, m,               // n m
        new_instr("cmp", "le", k)));    // n<=m
    return code;
}

function xlat_eq_num(ctx, args, k) {
    const n = nth_sexpr(args, 1);
    const m = nth_sexpr(args, 2);
    let code =
        interpret(ctx, n,               // n
        interpret(ctx, m,               // n m
        new_instr("cmp", "eq", k)));    // n==m
    return code;
}

function xlat_ge_num(ctx, args, k) {
    const n = nth_sexpr(args, 1);
    const m = nth_sexpr(args, 2);
    let code =
        interpret(ctx, n,               // n
        interpret(ctx, m,               // n m
        new_instr("cmp", "ge", k)));    // n>=m
    return code;
}

function xlat_gt_num(ctx, args, k) {
    const n = nth_sexpr(args, 1);
    const m = nth_sexpr(args, 2);
    let code =
        interpret(ctx, n,               // n
        interpret(ctx, m,               // n m
        new_instr("cmp", "gt", k)));    // n>m
    return code;
}

function xlat_add_num(ctx, args, k) {
    const n = nth_sexpr(args, 1);
    const m = nth_sexpr(args, 2);
    let code =
        interpret(ctx, n,               // n
        interpret(ctx, m,               // n m
        new_instr("alu", "add", k)));   // n+m
    return code;
}

function xlat_sub_num(ctx, args, k) {
    const n = nth_sexpr(args, 1);
    const m = nth_sexpr(args, 2);
    let code =
        interpret(ctx, n,               // n
        interpret(ctx, m,               // n m
        new_instr("alu", "sub", k)));   // n-m
    return code;
}

function xlat_mul_num(ctx, args, k) {
    const n = nth_sexpr(args, 1);
    const m = nth_sexpr(args, 2);
    let code =
        interpret(ctx, n,               // n
        interpret(ctx, m,               // n m
        new_instr("alu", "mul", k)));   // n*m
    return code;
}

function xlat_if(ctx, args, k) {
    const pred = nth_sexpr(args, 1);
    const cnsq = nth_sexpr(args, 2);
    const altn = nth_sexpr(args, 3);
    let code =
        interpret(ctx, pred,
        new_if_instr(
            interpret(ctx, cnsq, k),
            interpret(ctx, altn, k),
        ));
    return code;
}

function xlat_id(ctx, args, k) {
    const value = nth_sexpr(args, 1);
    let code =
        interpret(ctx, value,           // value
        new_instr("dup", 0, k));        // value
    return code;
}

function xlat_not_implemented(ctx, args, k) {
    return {
        error: "not implemented",
        crlf,
        ctx
    };
}

function interpret(ctx, crlf, k) {
    if (k?.error) {
        return k;
    }
    let transform;
    const type = typeof crlf;
    if (type !== "object") {
        transform = ctx[type];
    } else {
        const kind = crlf.kind;
        transform = ctx[kind];
    }
    if (typeof transform === "function") {
        // FIXME: this = ctx?
        return transform(ctx, crlf, k);
    }
    return {
        error: "no interpreter",
        crlf,
        ctx
    };
}

function interpret_list(ctx, list, k) {
    if (k?.error) {
        return k;
    }
    if (equal_to(nil_lit, list)) {
        console.log("interpret_list () k:", k);
        return k;
    } else if (list?.kind === "pair") {
        const head = list?.head;
        const tail = list?.tail;
        console.log("interpret_list (h . t) h:", head);
        let code =
            interpret(ctx, head,
            interpret_list(ctx, tail, k));
        return code;
    }
    return {
        error: "list expected",
        body: list
    };
}

function interpret_cont(ctx, crlf, k) {
    if (k?.error) {
        return k;
    }
    const func = crlf.head;
    const args = crlf.tail;
    const kind = func?.kind;
    console.log("interpret_cont:", crlf);
    if (kind === "ref") {
        const nargs = length_of(args) + 1;
        k = new_instr("state", 1,       // sp=(...)
            new_instr("part", -1, k));  // ...
        let code =
            interpret_list(ctx, args,   // ... args...
            new_instr("my", "self",     // ... args... SELF
            new_instr("push", func,     // ... args... SELF beh
            new_instr("new", 0,         // ... args... SELF beh.()
            new_instr("send", nargs,    // ...
            new_instr("pair", -1,       // sp=(...)
            new_instr("push", k,        // sp beh=k
            new_instr("msg", 0,         // sp beh msg
            new_instr("push", cont_ref, // sp beh msg cont_beh
            new_instr("beh", 3,         // --
            std.commit))))))))));
        return code;
    }
    return {
        error: "function-call expected",
        crlf,
        ctx
    };
};

function evaluate(source) {
    const sexpr = parse(source);
    const crlf = sexpr?.token;
    console.log("evaluate crlf:", to_scheme(crlf));
    const value = interpret(module_ctx, crlf);
    if (value?.error) {
        return value;
    }
    return {
        kind: "module",
        define: module_ctx.env
    };
}

const sample_source = `
(define memo_beh
    (lambda (value)
        (BEH (cust)
            (SEND cust value) )))`;
const fact_source = `
(define fact
    (lambda (n)
        (if (> n 1)
            (* n (fact (- n 1)))
            1)))`;
const fib_source = `
(define fib
    (lambda (n)
        (if (< n 2)
            n
            (+ (fib (- n 1)) (fib (- n 2))) )))`;
const test_source = "(define fn (lambda (n) (* (fn (+ n 1)) (fn (- n 2))) ))";
/*
//const sexpr = parse(" `('foo (,bar ,@baz) . quux)\r\n");
//const sexpr = parse("(0 1 -1 #t #f #nil #? () . #unit)");
//const sexpr = parse("(if (< n 0) #f #t)");
const sexpr = parse("(lambda (x . y) x)");
console.log(to_scheme(sexpr?.token));
*/
//const module = evaluate("(define z 0)");
//const module = evaluate("(define nop (lambda _))");
//const module = evaluate("(define list (lambda x x))");
//const module = evaluate("(define id (lambda (x) x))");
//const module = evaluate("(define id (lambda (x . y) x))");
//const module = evaluate("(define id (lambda (x y) y))");
//const module = evaluate("(define fn (lambda (x) 0 x y q.z))");
//const module = evaluate("(define fn (lambda (x y z) (list z (cons y x)) (car q) (cdr q) ))");
//const module = evaluate("(define fn (lambda (x y z) (if (eq? x -1) (list z y x) (cons y z)) ))");
//const module = evaluate(sample_source);
//const module = evaluate(fact_source);
const module = evaluate(fib_source);
//const module = evaluate(test_source);
console.log(JSON.stringify(module, undefined, 2));
if (!module?.error) {
    console.log(to_asm(module));
}

/*
 * Translation tools
 */

function chain_to_list(chain) {
    let list = [];
    while (chain?.kind === "instr") {
        if (chain.op === "if") {
            return;  // branching breaks the chain
        }
        list.push(chain);
        chain = chain.k;
    }
    return list;
}

function join_instr_chains(t_chain, f_chain, j_label) {
    let t_list = chain_to_list(t_chain);
    if (!t_list) {
        return;
    }
    let f_list = chain_to_list(f_chain);
    if (!f_list) {
        return;
    }
    while (t_list.length > 0 && f_list.length > 0) {
        t_chain = t_list.pop();
        f_chain = f_list.pop();
        if (t_chain.op !== f_chain.op
        || !equal_to(t_chain.imm, f_chain.imm)) {
            break;
        }
    }
    const join = t_chain.k;
    const j_ref = { "kind": "ref", "name": j_label };
    t_chain.k = j_ref;
    f_chain.k = j_ref;
    return join;
}

function to_asm(crlf) {
    if (typeof crlf === "string") {
        return crlf;
    }
    if (typeof crlf === "number") {
        return String(crlf);
    }
    let s = "";
    const kind = crlf?.kind;
    if (kind === "module") {
        asm_label = 1;
        for (const [name, value] of Object.entries(crlf.define)) {
            s += name + ":\n";
            if (value?.kind !== "instr") {
                s += "    ref ";  // indent
            }
            s += to_asm(value);
        }
    } else if (kind === "instr") {
        let op = to_asm(crlf.op);
        if (op?.error) {
            return op;
        }
        s += "    " + op;
        if (op === "if") {
            // generate labels for branch targets
            let t_label = "t~" + asm_label;
            let f_label = "f~" + asm_label;
            let j_label = "j~" + asm_label;
            asm_label += 1;
            s += " " + t_label + " " + f_label + "\n";
            const join = join_instr_chains(crlf.t, crlf.f, j_label);
            s += t_label + ":\n";
            s += to_asm(crlf.t);
            s += f_label + ":\n";
            s += to_asm(crlf.f);
            if (join) {
                s += j_label + ":\n";
                s += to_asm(join);
            }
            return s;
        }
        if (op !== "debug") {
            let imm = to_asm(crlf.imm);
            if (imm?.error) {
                return imm;
            }
            if (crlf.imm?.kind === "instr") {
                // generate labels for continuation targets
                let i_label = "i~" + asm_label;
                let k_label = "k~" + asm_label;
                asm_label += 1;
                s += " " + i_label + " " + k_label + "\n";
                s += i_label + ":\n";
                s += imm;
                s += k_label + ":\n";
                s += to_asm(crlf.k);
                return s;
            }
            s += " " + imm;
        }
        s += "\n";
        if (op !== "end") {
            if (crlf.k?.kind === "ref") {
                s += "    ref " + to_asm(crlf.k) + "\n";
            } else {
                s += to_asm(crlf.k);
            }
        }
    } else if (kind === "literal") {
        const name = crlf.value;
        if (name === "undef") {
            s = "#?";
        } else if (name === "nil") {
            s = "()";
        } else if (name === "false") {
            s = "#f";
        } else if (name === "true") {
            s = "#t";
        } else if (name === "unit") {
            s = "#unit";
        }
    } else if (kind === "type") {
        const name = crlf.name;
        if (typeof name === "string") {
            s = "#" + name + "_t";
        } else {
            s = "#unknown_t";
        }
    } else if (kind === "ref") {
        const module = crlf?.module;
        if (typeof module === "string") {
            s += module + ".";
        }
        s += crlf.name;
    } else {
        return {
            error: "unknown asm",
            crlf
        }
    }
    return s;
}

// Tokenizer ///////////////////////////////////////////////////////////////////

function tag_regexp(strings) {

// A tag function that creates a RegExp from a template literal string. Any
// whitespace in the string is ignored, and so can be injected into the pattern
// to improve readability.

    return new RegExp(strings.raw[0].replace(/\s/g, ""), "");
}

const rx_token_raw = tag_regexp `
    (
        [ \u0020 \t-\r ]+
      | ; .*
    )
  | (
      [ - + a-z A-Z 0-9 ! # $ % & * . / : < = > ? @ \\ ^ _ | ~ ]+
    )
  | (
        [ ( ) ' \u0060 ]
      | , @?
    )
`;

// Capturing groups:
//  [1] Space
//  [2] Name
//  [3] Punctuator

function tokenize(source) {
    let rx_token = new RegExp(rx_token_raw, "yu"); // sticky, unicode aware
    let line_nr = 1;
    let column_to = 1;
    return function token_generator() {

        function error() {
            source = undefined;
            return {
                id: "error",
                line_nr,
                column_nr: column_to
            };
        }

        if (source === undefined) {
            return error();
        }
        if (rx_token.lastIndex >= source.length) {
            return;
        }
        let captives = rx_token.exec(source);
        if (!captives) {
            return error();
        }
        let column_nr = column_to;
        column_to = column_nr + captives[0].length;
        if (captives[1]) {
            return {
                id: "space",
                line_nr,
                column_nr,
                column_to
            };
        }
        if (captives[2]) {
            return {
                id: "name",
                name: captives[2],
                line_nr,
                column_nr,
                column_to
            };
        }
        if (captives[3]) {
            return {
                id: captives[3],
                line_nr,
                column_nr,
                column_to
            };
        }
    };
}

export default Object.freeze(compile);
