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

function evaluate_sexpr(ctx, sexpr) {
    if (typeof sexpr === "number") {
        // numeric constant
        return sexpr;
    }
    let kind = sexpr?.kind;
    if (kind === "type"
    ||  kind === "literal") {
        // type constant or literal value
        return sexpr;
    }
    if (kind === "pair") {
        const first = nth_sexpr(sexpr, 1);
        const kind = first?.kind;
        if (kind === "ref") {
            const name = first?.name;
            if (name === "lambda") {
                return compile_lambda(ctx, sexpr);
            }
            if (name === "BEH") {
                return compile_BEH(ctx, sexpr);
            }
        }
    }
    return {
        error: "can't compile sexpr",
        sexpr
    };
}
function compile_sexpr(ctx, sexpr, k) {
    if (k?.error) {
        return k;
    }
    if (typeof sexpr === "number") {
        // numeric constant
        return new_instr("push", sexpr, k);
    }
    let kind = sexpr?.kind;
    if (kind === "type"
    ||  kind === "literal") {
        // constant or literal
        return new_instr("push", sexpr, k);
    }
    if (kind === "ref") {
        // symbolic reference
        const name = sexpr.name;
        if (name === "SELF") {
            return new_instr("my", "self", k);  // SELF reference
        }
        const state_ref = ctx.state_map && ctx.state_map[name];
        if (state_ref) {
            return new_instr("state", state_ref, k);  // state reference
        }
        const msg_ref = ctx.msg_map && ctx.msg_map[name];
        if (msg_ref) {
            return new_instr("msg", msg_ref, k);  // message reference
        }
        return new_instr("push", sexpr, k);  // free variable
    }
    if (kind === "pair") {
        const first = nth_sexpr(sexpr, 1);
        kind = first?.kind;
        if (kind === "ref") {
            const name = first?.name;
            if (name === "define") {
                return compile_define(ctx, sexpr, k);
            }
            if (name === "lambda") {
                return compile_lambda(ctx, sexpr, k);
            }
            if (name === "BEH") {
                return compile_BEH(ctx, sexpr, k);
            }
            if (name === "SEND") {
                return compile_SEND(ctx, sexpr, k);
            }
            if (name === "car") {
                const second = nth_sexpr(sexpr, 2);
                let code =
                    compile_sexpr(ctx, second,      // (head . tail)
                    new_instr("nth", 1, k));        // head
                return code;
            }
            if (name === "cdr") {
                const second = nth_sexpr(sexpr, 2);
                let code =
                    compile_sexpr(ctx, second,      // (head . tail)
                    new_instr("nth", -1, k));       // tail
                return code;
            }
            if (name === "cons") {
                const head = nth_sexpr(sexpr, 2);
                const tail = nth_sexpr(sexpr, 3);
                let code =
                    compile_sexpr(ctx, tail,        // tail
                    compile_sexpr(ctx, head,        // tail head
                    new_instr("pair", 1, k)));      // (head . tail)
                return code;
            }
            if (name === "list") {
                return compile_list(ctx, sexpr, k);
            }
            if (name === "if") {
                return compile_if(ctx, sexpr, k);
            }
        }
    }
    return {
        error: "can't compile sexpr",
        sexpr
    };
}
function compile_list(ctx, sexpr, k) {
    if (k?.error) {
        return k;
    }
    let tail = sexpr?.tail;
    let args = [];
    while (tail?.kind === "pair") {
        const head = tail?.head;
        args.push(head);
        tail = tail?.tail;
    }
    let n = args.length;
    let code = new_instr("pair", n, k);
    while (n > 0) {
        n -= 1;
        code = compile_sexpr(ctx, args[n], code);
    }
    code = new_instr("push", nil_lit, code);
    return code;
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
function compile_body(ctx, body) {
    let code = {
        error: "can't compile body",
        sexpr: body
    };
    if (equal_to(nil_lit, body)) {
        code =
            new_instr("msg", 1,             // msg cust
            new_instr("send", -1,           // --
            new_instr("end", "commit")));
    } else if (body?.kind === "pair") {
        const head = body?.head;
        const tail = body?.tail;
        code = compile_body(ctx, tail);
        if (code.error) {
            return code;
        }
        code = compile_sexpr(ctx, head, code);
    }
    return code;
}
function compile_define(ctx, sexpr, k) {
    if (k?.error) {
        return k;
    }
    const second = nth_sexpr(sexpr, 2);
    if (second?.kind === "ref") {
        const name = second?.name;
        const third = nth_sexpr(sexpr, 3);
        const dfn = evaluate_sexpr(ctx, third);
        if (dfn.error) {
            return dfn;
        }
        console.log("compile_define:", name, "->", to_scheme(dfn));
        ctx.define[name] = dfn;
        return ctx;
    }
    return {
        error: "can't compile `define`",
        sexpr
    };
}
function compile_lambda(ctx, sexpr, k) {
    if (k?.error) {
        return k;
    }
    const second = nth_sexpr(sexpr, 2);
    console.log("compile_lambda:", "ptrn:", to_scheme(second));
    const state_map = pattern_to_map(second);
    console.log("compile_lambda:", "state_map:", state_map);
    const body = nth_sexpr(sexpr, -2);
    console.log("compile_lambda:", "body:", body);
    ctx = {
        state_map: state_map,
        parent: ctx
    };
    let code = compile_body(ctx, body);
    if (code.error) {
        return code;
    }
    code = new_instr("push", unit_lit, code);  // #unit
    console.log("compile_lambda:", "code:", code);
    if (!code.error) {
        return code;
    }
    return {
        error: "can't compile `lambda`",
        sexpr
    };
}
function compile_BEH(ctx, sexpr, k) {
    if (k?.error) {
        return k;
    }
    const second = nth_sexpr(sexpr, 2);
    console.log("compile_BEH:", "ptrn:", to_scheme(second));
    const msg_map = pattern_to_map(second);
    console.log("compile_BEH:", "msg_map:", msg_map);
    const body = nth_sexpr(sexpr, -2);
    console.log("compile_BEH:", "body:", body);
    ctx.msg_map = msg_map;
    let code = compile_body(ctx, body);
    if (code.error) {
        return code;
    }
    console.log("compile_BEH:", "code:", code);
    if (!code.error) {
        return code;
    }
    return {
        error: "can't compile `BEH`",
        sexpr
    };
}
function compile_SEND(ctx, sexpr, k) {
    if (k?.error) {
        return k;
    }
    const second = nth_sexpr(sexpr, 2);
    const third = nth_sexpr(sexpr, 3);
    let code =
        compile_sexpr(ctx, third,       // msg
        compile_sexpr(ctx, second,      // msg target
        new_instr("send", -1, k)));     // --
    console.log("compile_SEND:", "code:", code);
    if (!code.error) {
        return code;
    }
    return {
        error: "can't compile `SEND`",
        sexpr
    };
}
function compile_if(ctx, sexpr, k) {
    if (k?.error) {
        return k;
    }
    const pred = nth_sexpr(sexpr, 2);
    const cnsq = nth_sexpr(sexpr, 3);
    const altn = nth_sexpr(sexpr, 4);
    let code =
        compile_sexpr(ctx, pred,
        new_if_instr(
            compile_sexpr(ctx, cnsq, k),
            compile_sexpr(ctx, altn, k),
        ));
    console.log("compile_if:", "code:", code);
    if (!code.error) {
        return code;
    }
    return {
        error: "can't compile `if`",
        sexpr
    };
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
                let code =
                    new_instr("push", unit_lit,     // #unit
                    interpret_list(child, body,
                    new_instr("msg", 1,             // msg cust
                    new_instr("send", -1,           // --
                    new_instr("end", "commit")))));
                return code;
            }
        }
        return {
            error: "interpretation failure",
            crlf,
            ctx
        };
    },
    env: {}
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
        }
        return {
            error: "interpretation failure",
            crlf,
            ctx
        };
    },
    func: {
        BEH: function(ctx, args, k) {
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
            let code =
                interpret_list(child, body,
                new_instr("end", "commit"));
            return code;
        },
        SEND: function(ctx, args, k) {
            const target = nth_sexpr(args, 1);
            const msg = nth_sexpr(args, 2);
            let code =
                interpret(ctx, msg,             // msg
                interpret(ctx, target,          // msg target
                new_instr("send", -1, k)));     // --
            return code;
        },
        car: function(ctx, args, k) {
            const pair = nth_sexpr(args, 1);
            let code =
                interpret(ctx, pair,            // (head . tail)
                new_instr("nth", 1, k));        // head
            return code;
        },
        cdr: function(ctx, args, k) {
            const pair = nth_sexpr(args, 1);
            let code =
                interpret(ctx, pair,            // (head . tail)
                new_instr("nth", -1, k));       // tail
            return code;
        },
        cons: function(ctx, args, k) {
            const head = nth_sexpr(args, 1);
            const tail = nth_sexpr(args, 2);
            let code =
                interpret(ctx, tail,            // tail
                interpret(ctx, head,            // tail head
                new_instr("pair", 1, k)));      // (head . tail)
            return code;
        },
/*
        if (name === "if") {
            return compile_if(ctx, sexpr, k);
        }
*/
        list: function(ctx, args, k) {
            let arg_stack = [];
            while (args?.kind === "pair") {
                const head = args?.head;
                arg_stack.push(head);
                args = args?.tail;
            }
            let n = arg_stack.length;
            let code = new_instr("pair", n, k);
            while (n > 0) {
                n -= 1;
                code = interpret(ctx, arg_stack[n], code);
            }
            code = new_instr("push", nil_lit, code);
            return code;
        }
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
            const parent = ctx.parent;
            // delegate to enclosing context
            return parent.pair(parent, crlf, k);  // FIXME: which context? `ctx` or `ctx.parent`? (or neither!?)
        }
        return {
            error: "interpretation failure",
            crlf,
            ctx
        };
    },
    func: {
        BECOME: function(ctx, args, k) {
            return {
                error: "not implemented",
                crlf,
                ctx
            };
        }
    },
    state_map: {},
    msg_map: {}
};

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

function interpret_list(ctx, body, k) {
    if (k?.error) {
        return k;
    }
    if (equal_to(nil_lit, body)) {
        console.log("interpret_list () k:", k);
        return k;
    } else if (body?.kind === "pair") {
        const head = body?.head;
        const tail = body?.tail;
        console.log("interpret_list (h . t) h:", head);
        let code =
            interpret(ctx, head,
            interpret_list(ctx, tail, k));
        return code;
    }
    return {
        error: "list expected",
        body
    };
}

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
const module = evaluate("(define fn (lambda (x y z) (list z (cons y x)) (car q) (cdr q) ))");
//const module = evaluate("(define fn (lambda (x y z) (if x (list y z) (cons y z)) ))");
//const module = evaluate(sample_source);
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
            let t_label = "t~" + asm_label;
            let f_label = "f~" + asm_label;
            let j_label = "j~" + asm_label;
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
        } else {
            if (op !== "depth") {
                let imm = to_asm(crlf.imm);
                if (imm?.error) {
                    return imm;
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
