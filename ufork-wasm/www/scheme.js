// uFork Scheme compiler

// Transforms Scheme source code into an intermediate representation
// that is suitable for loading.

// The intermediate representation is described in crlf.md.

const ignored = function () {};
let info_log = console.log;  // Low volume, always shown unless all logging is disabled.
let warn_log = ignored;  // Something went wrong, but perhaps it wasn't fatal.
let debug_log = ignored;  // More detail to narrow down the source of a problem.
let trace_log = ignored;  // Extremely detailed, but very high volume.
warn_log = console.log;
//debug debug_log = console.log;
//debug trace_log = console.log;

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

/*
 * uFork/CRLF elements
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

function crlf_debug(from, to) {
    if (from === null) {
        return undefined;
    }
    let file = from?.debug?.file ?? from?.file;
    let start = from?.debug?.start ?? from?.start;
    let end = from?.debug?.end ?? from?.end;
    if (to !== null && typeof to === "object") {
        if (file === undefined) {
            file = to.debug?.file ?? to.file;
        }
        if (start === undefined) {
            start = to.debug?.start ?? to.start;
        }
        let span = to.debug?.end ?? to.end;
        if (span !== undefined) {
            end = span;
        }
    }
    return { kind: "debug", file, start, end };
}

function new_quad(debug, t, x, y, z) {
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

function new_literal(debug, value) {
    return {
        kind: "literal",
        value,
        debug
    };
}

function new_number(debug, value) {
    return {
        kind: "number",
        value,
        debug
    };
}

function new_symbol(debug, name) {
    return {
        kind: "symbol",
        name,
        debug
    };
}

function new_type(debug, name) {
    return {
        kind: "type",
        name,
        debug
    };
}

function new_quad_type(debug, arity) {
    //return new_quad(debug, type_t, arity);
    return {
        kind: "type",
        arity,
        debug
    };
}

function new_pair(debug, head, tail) {
    return {
        kind: "pair",
        head,
        tail,
        debug
    };
}

function new_dict(debug, key, value, next = nil_lit) {
    return {
        kind: "dict",
        key,
        value,
        next,
        debug
    };
}

function new_ref(debug, name) {
    return {
        kind: "ref",
        name,
        debug
    };
}

function new_instr(debug, op, imm = undef_lit, k = undef_lit) {
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

function new_if_instr(debug, t = undef_lit, f = undef_lit) {
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
        if (expect.kind === "literal") {
            return equal_to(expect?.value, actual?.value);
        } else if (expect.kind === "number") {
            return equal_to(expect?.value, actual?.value);
        } else if (expect.kind === "symbol") {
            return equal_to(expect?.name, actual?.name);
        } else if (expect.kind === "type") {
            return equal_to(expect?.name, actual?.name);
        } else if (expect.kind === "pair") {
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

// Scheme s-expressions (sexprs) are represented by uFork-ASM CRLF-like objects.
//    * symbol = { "kind": "symbol", "name": <string> }
//    * cons = { "kind": "pair", "head": <sexpr>, "tail": <sexpr> }
//    * literal = { "kind": "literal", "name": <string> }
//    * number = { "kind": "number", "value": <number> }
//    * type = { "kind": "type", "name": <string> }

function to_scheme(crlf) {
    if (typeof crlf !== "object") {
        return String(crlf);
    }
    const kind = crlf?.kind;
    if (kind === "symbol") {
        return crlf.name;
    } else if (kind === "number") {
        return String(crlf.value);
    } else if (kind === "literal") {
        const name = crlf?.value;
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
        const name = crlf?.name;
        if (typeof name === "string") {
            return "#" + name + "_t";
        } else {
            return "#unknown_t";
        }
    } else if (kind === "pair") {
        let s = "(";
        while (true) {
            s += to_scheme(crlf?.head);
            if (crlf?.tail?.kind !== "pair") {
                break;
            }
            crlf = crlf?.tail;
            s += " ";
        }
        if (!equal_to(nil_lit, crlf?.tail)) {
            s += " . ";
            s += to_scheme(crlf?.tail);
        }
        s += ")";
        return s;
    } else if (kind === "dict") {
        let s = "{";
        while (true) {
            s += to_scheme(crlf?.key) + ":" + to_scheme(crlf?.value);
            if (crlf?.next?.kind !== "dict") {
                break;
            }
            crlf = crlf?.next;
            s += ",";
        }
        s += "}";
        return s;
    } else if (kind === "instr") {
        let s = "[#instr_t, ";
        s += to_scheme(crlf?.op);
        s += ", ";
        s += to_scheme(crlf?.imm);
        s += ", ";
        s += to_scheme(crlf?.k);
        s += "]";
        return s;
    } else if (kind === "quad") {
        let s = "[";
        s += to_scheme(crlf?.t);
        s += ", ";
        s += to_scheme(crlf?.x);
        s += ", ";
        s += to_scheme(crlf?.y);
        s += ", ";
        s += to_scheme(crlf?.z);
        s += "]";
        return s;
    } else if (typeof kind === "string") {
        return "#" + kind + "...";
    }
    return "#unknown";
}

/*
 * Scheme language parsing
 */

function parse(source, file) {

    function string_input(string, start = 0) {
        if (typeof string !== "string") {
            throw new Error("string required");
        }
        return function next_char() {
            const code = string.codePointAt(start);
            //trace_log("next_char", code, "at", start);
            if (code === undefined) {
                return {
                    error: "end of input",
                    file,
                    source: string,
                    start,
                    end: start
                }
            }
            const end = start + (code <= 0xFFFF ? 1 : 2);
            return {
                token: String.fromCodePoint(code),
                code: code,
                file,
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
            //trace_log("next_token", input);
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
            const number = Number(input.token);  // FIXME: implement better conversion method
            if (Number.isSafeInteger(number)) {
                input.token = number;
            }
            input.next = lex_input(next);
            return input;
        }
    }

    function parse_tail(next) {
        let input = next();
        trace_log("parse_tail", input);
        if (input.error) {
            return input;  // report error
        }
        if (input.token === ")") {
            const debug = crlf_debug(input);
            input.token = new_literal(debug, "nil");
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
        const debug = crlf_debug(input, tail);
        input.token = new_pair(debug, scan.token, tail.token);
        input.end = tail.end;
        input.next = tail.next;
        return input;
    }

    function parse_list(input) {
        let next = input.next;
        let scan = next();
        trace_log("parse_list", scan);
        if (scan.error) {
            return scan;  // report error
        }
        if (scan.token === ")") {
            const debug = crlf_debug(input, scan);
            input.token = new_literal(debug, "nil");
            input.end = scan.end;
            input.next = scan.next;
            return input;
        }
        if (scan.token === ".") {
            return {
                error: "unexpected dot",
                file,
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
        const debug = crlf_debug(input, tail);
        input.token = new_pair(debug, scan.token, tail.token);
        input.end = tail.end;
        input.next = tail.next;
        return input;
    }

    function parse_quote(input, quote) {
        let scan = parse_sexpr(input.next);
        trace_log("parse_quote", scan);
        if (scan.error) {
            return scan;  // report error
        }
        const debug = crlf_debug(input, scan);
        input.token =
            new_pair(debug, quote,
            new_pair(debug, scan.token,
            new_literal(debug, "nil")));
        input.end = scan.end;
        input.next = scan.next;
        return input;
    }

    function parse_sexpr(next) {
        const input = next();
        trace_log("parse_sexpr", input);
        if (input.error) {
            return input;  // report error
        }
        const debug = crlf_debug(input);
        if (typeof input.token === "number") {
            input.token = new_number(debug, input.token);
            return input;  // number sexpr
        }
        if (input.token === ".") {
            return {
                error: "unexpected dot",
                file,
                start: input.start,
                end: input.end
            };            
        }
        if (input.token === "(") {
            return parse_list(input);
        }
        if (input.token === "'") {
            const quote = new_symbol(debug, "quote");
            return parse_quote(input, quote);
        }
        if (input.token === "`") {
            const quote = new_symbol(debug, "quasiquote");
            return parse_quote(input, quote);
        }
        if (input.token === ",") {
            const quote = new_symbol(debug, "unquote");
            return parse_quote(input, quote);
        }
        if (input.token === ",@") {
            const quote = new_symbol(debug, "unquote-splicing");
            return parse_quote(input, quote);
        }
        if (input.token === "#?") {
            input.token = new_literal(debug, "undef");
            return input;
        } else if (input.token === "#nil") {
            input.token = new_literal(debug, "nil");
            return input;
        } else if (input.token === "#f") {
            input.token = new_literal(debug, "false");
            return input;
        } else if (input.token === "#t") {
            input.token = new_literal(debug, "true");
            return input;
        } else if (input.token === "#unit") {
            input.token = new_literal(debug, "unit");
            return input;
        } else if (input.token === "#literal_t") {
            input.token = new_type(debug, "literal");
            return input;
        } else if (input.token === "#fixnum_t") {
            input.token = new_type(debug, "fixnum");
            return input;
        } else if (input.token === "#type_t") {
            input.token = new_type(debug, "type");
            return input;
        } else if (input.token === "#pair_t") {
            input.token = new_type(debug, "pair");
            return input;
        } else if (input.token === "#dict_t") {
            input.token = new_type(debug, "dict");
            return input;
        } else if (input.token === "#instr_t") {
            input.token = new_type(debug, "instr");
            return input;
        } else if (input.token === "#actor_t") {
            input.token = new_type(debug, "actor");
            return input;
        } else if (input.token.startsWith("#")) {
            return {
                error: "unknown literal",
                token: input.token,
                file,
                start: input.start,
                end: input.end
            };
        } else if (typeof input.token === "string") {
            input.token = new_symbol(debug, input.token);
            return input;  // symbol sexpr
        }
        return {
            error: "unexpected token",
            file,
            token: input.token,
            start: input.start,
            end: input.end
        };
    }

    const str_in = string_input(source);
    let lex_in = lex_input(str_in);
    let sexprs = [];

    while (true) {
        const parse = parse_sexpr(lex_in);
        trace_log("parse:", JSON.stringify(parse, undefined, 2));
        if (parse?.error) {
            if (parse.error === "end of input") {
                break;
            }
            return parse;
        }
        sexprs.push(parse.token);
        lex_in = parse.next;
    }

    return sexprs;
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

/*
 * Scheme interpreter/compiler
 */

function compile(source, file) {
    const debug_file = { kind: "debug", file };

    // standard instruction-stream tails
    function std_sink_beh(debug) {
        return new_instr(debug, "end", "commit");
    }
    function std_commit(debug) {
        return std_sink_beh(debug);
    }
    function std_send_msg(debug) {
        return new_instr(debug, "send", -1, std_commit(debug));
    }
    function std_cust_send(debug) {
        return new_instr(debug, "msg", 1, std_send_msg(debug));
    }

    const module_env = {
        "symbol_t": new_quad_type(debug_file, 1),
        "closure_t": new_quad_type(debug_file, 2),
        "behavior_t": new_quad_type(debug_file, 2),
        "~empty_env": new_pair(debug_file, nil_lit, nil_lit), // (())  ; NOTE: this is the same value as EMPTY_DQ
        "~cont_beh":
            new_instr(debug_file, "state", 1,   // msg
            new_instr(debug_file, "my", "self", // msg SELF
            new_instr(debug_file, "send", -1,   // --
            new_instr(debug_file, "state", 3,   // env
            new_instr(debug_file, "state", 4,   // env sp
            new_instr(debug_file, "msg", 0,     // env sp rv
            new_instr(debug_file, "pair", 1,    // env sp'=(rv . sp)
            new_instr(debug_file, "pair", 1,    // (sp' . env)
            new_instr(debug_file, "state", 2,   // (sp' . env) cont
            new_instr(debug_file, "beh", -1,    // --
            new_instr(debug_file, "end", "commit")))))))))))
    };

    const symbol_t = new_ref(debug_file, "symbol_t");
    const closure_t = new_ref(debug_file, "closure_t");
    const behavior_t = new_ref(debug_file, "behavior_t");
    const empty_env = new_ref(debug_file, "~empty_env");
    const cont_beh = new_ref(debug_file, "~cont_beh");

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
            if (head?.kind === "symbol") {
                const name = head.name;
                if (name !== "_") {
                    map[name] = n;
                }
            }
            pattern = pattern?.tail;
        }
        if (pattern?.kind === "symbol") {
            const name = pattern.name;
            if (name !== "_") {
                map[name] = -n;
            }
        }
        return map;
    }

    function string_to_list(str, ofs = 0) {
        const code = str.codePointAt(ofs);
        if (code === undefined) {
            return nil_lit;
        }
        ofs += (code <= 0xFFFF ? 1 : 2);
        return new_pair(debug_file, code, string_to_list(str, ofs));
    }

    function sexpr_to_crlf(sexpr) {
        let debug = crlf_debug(sexpr, debug_file);
        const kind = sexpr?.kind;
        if (kind === "literal" || kind === "type") {
            return sexpr;
        }
        if (kind === "number") {
            return sexpr.value;
        }
        if (kind === "symbol") {
            const name = sexpr.name;
            const label = "'" + name;
            let symbol = module_env[label];
            if (!symbol) {
                symbol = new_quad(debug_file, symbol_t, string_to_list(name));
                module_env[label] = symbol;
            }
            return new_ref(debug, label);
        }
        if (kind === "pair") {
            const head = sexpr_to_crlf(sexpr.head);
            if (head.error) {
                return head;
            }
            const tail = sexpr_to_crlf(sexpr.tail);
            if (head.error) {
                return head;
            }
            debug = crlf_debug(head, tail);
            return new_pair(debug, head, tail);
        }
        return {
            error: "unknown sexpr",
            file,
            sexpr
        };
    }

    function constant_value(crlf) {  // return constant value for crlf, if it has one
        if (typeof crlf === "number") {
            return crlf;
        }
        const kind = crlf?.kind;
        if (kind === "number") {
            return crlf.value;
        }
        if (kind === "literal" || kind === "type") {
            return crlf;
        }
        if (kind === "pair") {
            const head = nth_sexpr(crlf, 1);
            if (head.kind === "symbol" && head.name === "quote") {
                const sexpr = nth_sexpr(crlf, 2);
                return sexpr_to_crlf(sexpr);
            }
        }
        return undefined;  // not a constant
    }

    const prim_map = {
        "quote": xlat_quote,
        "lambda": xlat_lambda,
        "let": rewrite_let,
        "seq": xlat_seq,
        "list": xlat_list,
        "cons": xlat_cons,
        "car": xlat_car,
        "cdr": xlat_cdr,
        "cadr": xlat_cadr,
        "caar": xlat_caar,
        "cdar": xlat_cdar,
        "cddr": xlat_cddr,
        "caddr": xlat_caddr,
        "cadar": xlat_cadar,
        "cdddr": xlat_cdddr,
        "cadddr": xlat_cadddr,
        "eq?": xlat_eq_p,
        "null?": xlat_null_p,
        "pair?": xlat_pair_p,
        "boolean?": xlat_boolean_p,
        "number?": xlat_number_p,
        "actor?": xlat_actor_p,
        "symbol?": xlat_symbol_p,
        "procedure?": xlat_procedure_p,
        "behavior?": xlat_behavior_p,
        "<": xlat_lt_num,
        "<=": xlat_le_num,
        "=": xlat_eq_num,
        ">=": xlat_ge_num,
        ">": xlat_gt_num,
        "+": xlat_add_num,
        "-": xlat_sub_num,
        "*": xlat_mul_num,
        "if": xlat_if,
        "cond": xlat_cond,
        "not": xlat_not,
        "BEH": xlat_BEH,
        "CREATE": xlat_CREATE,
        "SEND": xlat_SEND,
    };

    function new_module_ctx() {
        const ctx = {
            interpret_literal: xlat_literal,
            interpret_variable: xlat_variable,
            interpret_invoke: xlat_invoke,
            func_map: Object.assign(
                {},  // FIXME: should this be `Object.create(null)`?
                prim_map,
                {
                    "DEVICE": xlat_DEVICE,
                    "define": eval_define,
                })
        };
        return ctx;
    }

    function xlat_DEVICE(ctx, crlf, k) {
        // WARNING! this code only works at the top level of a module (boot code)
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const id = nth_sexpr(args, 1);
        let code =
            new_instr(debug, "msg", 0,          // {caps}
            interpret(ctx, id,                  // {caps} id
            new_instr(debug, "dict", "get",     // device
            k)));
        return code;
    }

    function eval_define(ctx, crlf, k) {
        const args = crlf.tail;
        const symbol = nth_sexpr(args, 1);
        debug_log("define:", "symbol:", to_scheme(symbol));
        let name = symbol;
        if (symbol?.kind === "symbol") {
            name = symbol.name;
        }
        if (typeof name !== "string") {
            return {
                error: "symbol name (string) expected",
                symbol,
                file,
                ctx
            };
        }
        const expr = nth_sexpr(args, 2);
        debug_log("define:", "expr:", to_scheme(expr));
        const child = new_define_ctx(ctx);
        const value = interpret(child, expr);  // evaluate expression
        if (value?.error) {
            return value;
        }
        module_env[name] = value;  // bind symbol in top-level environment
        return k;  // no code produced
    }

    function new_define_ctx(parent) {
        const ctx = {
            parent,
            interpret_literal: eval_literal,
            interpret_variable: eval_variable,
            interpret_invoke: eval_invoke,
            func_map: {
                "quote": eval_quote,
                "lambda": eval_lambda,
                //"let": rewrite_let, -- FIXME: need full interpreter...
                "BEH": eval_BEH,
            }
        };
        return ctx;
    }

    function eval_literal(ctx, crlf) {
        if (crlf?.kind === "number") {
            return crlf.value;
        }
        return crlf;
    }

    function eval_variable(ctx, crlf) {
        const debug = crlf_debug(crlf);
        const name = crlf?.name;
        if (typeof name !== "string") {
            return {
                error: "bad variable",
                crlf,
                file,
                ctx
            };
        }
        const xlat = ctx.func_map && ctx.func_map[name];
        if (typeof xlat === "function") {
            // operative function
            return xlat;
        }
        // symbolic reference
        return new_ref(debug, name);
    }

    function eval_invoke(ctx, crlf) {
        const func = crlf.head;
        //const args = crlf.tail;
        let xlat = interpret(ctx, func);
        if (typeof xlat === "function") {
            return xlat(ctx, crlf);
        }
        return {
            error: "unable to invoke",
            xlat,
            crlf,
            file,
            ctx
        };
    }

    function eval_quote(ctx, crlf) {
        const args = crlf.tail;
        const sexpr = nth_sexpr(args, 1);
        return sexpr_to_crlf(sexpr);
    }

    function eval_BEH(ctx, crlf) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const code = compile_behavior(ctx, args);
        if (code.error) {
            return code;
        }
        const data = empty_env;
        return new_quad(debug, behavior_t, code, data);
    }

    function eval_lambda(ctx, crlf) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const code = compile_closure(ctx, args);
        if (code.error) {
            return code;
        }
        const data = empty_env;
        return new_quad(debug, closure_t, code, data);
    }

    function compile_closure(ctx, args) {
        const ptrn = nth_sexpr(args, 1);
        const body = nth_sexpr(args, -1);
        debug_log("closure:", "ptrn:", to_scheme(ptrn));
        debug_log("closure:", "body:", to_scheme(body));
        const child = new_lambda_ctx(ctx, ptrn);
        const debug = crlf_debug(body);
        let code =
            interpret_seq(child, body,
            std_cust_send(debug));
        return code;
    }

    function unzip_bindings(bindings) {
        if (bindings?.kind === "pair") {
            const binding = bindings.head;
            const debug = crlf_debug(binding);
            const form = nth_sexpr(binding, 1);
            const expr = nth_sexpr(binding, 2);
            const [forms, exprs] = unzip_bindings(bindings.tail);
            return [
                new_pair(debug, form, forms),
                new_pair(debug, expr, exprs),
            ];
        }
        return [bindings, bindings];
    }
    /*
    The expression
        (let ((<form_1> <expr_1>) ... (<form_n> <expr_n>)) . <body>)
    is equivalent to
        ((lambda (<form_1> ... <form_n>) . <body>) <expr_1> ... <expr_n>)
    */
    function rewrite_let(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const bindings = nth_sexpr(args, 1);
        const body = nth_sexpr(args, -1);
        const [forms, exprs] = unzip_bindings(bindings);
        const lambda = new_pair(debug,
            new_symbol(debug, "lambda"),
            new_pair(debug, forms, body)
        );
        const sexpr = new_pair(debug, lambda, exprs);
        let code = interpret(ctx, sexpr, k);
        return code;
    }

    function inherit_state_maps(parent) {
        let state_maps = [];
        if (parent.state_maps) {
            state_maps = parent.state_maps.slice();
        }
        if (parent.msg_map) {
            state_maps.unshift(parent.msg_map);  // add msg to lexically-captured state
        }
        return state_maps;
    }

    function new_lambda_ctx(parent, ptrn = undef_lit) {
        const ctx = {
            parent,
            interpret_literal: xlat_literal,
            interpret_variable: xlat_variable,
            interpret_invoke: xlat_invoke,
            func_map: Object.assign(
                {},
                prim_map),
            state_maps: inherit_state_maps(parent),
            msg_map: pattern_to_map(ptrn, 1)  // skip implicit customer
        };
        debug_log("lambda:", "state_maps:", ctx.state_maps);
        debug_log("lambda:", "msg_map:", ctx.msg_map);
        return ctx;
    }

    function xlat_literal(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const value = (crlf?.kind === "number" ? crlf.value : crlf);
        let code = new_instr(debug, "push", value, k);
        return code;
    }

    function xlat_variable(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const name = crlf?.name;
        if (typeof name !== "string") {
            return {
                error: "bad variable",
                crlf,
                file,
                ctx
            };
        }
        const msg_n = ctx.msg_map && ctx.msg_map[name];
        if (typeof msg_n === "number") {
            // message variable
            return new_instr(debug, "msg", msg_n, k);
        }
        if (ctx.state_maps) {
            // search lexical scope(s)
            const index = ctx.state_maps.findIndex((map) => (typeof map[name] === "number"));
            if (index >= 0) {
                // state variable
                const offset = ctx.state_maps[index][name];
                const code =
                    new_instr(debug, "state", index + 2,
                    new_instr(debug, "nth", offset, k));
                return code;
            }
        }
        // free variable
        const xlat = ctx.func_map && ctx.func_map[name];
        if (typeof xlat === "function") {
            // operative function
            return xlat;
        }
        // module environment
        let ref = new_ref(debug, name);
        return new_instr(debug, "push", ref, k);
    }

    const tail_call_k = std_cust_send(debug_file);
    function xlat_invoke(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const func = crlf.head;
        const args = crlf.tail;
        let xlat = interpret(ctx, func);
        if (typeof xlat === "function") {
            // apply operative immediately
            return xlat(ctx, crlf, k);
        }
        const nargs = length_of(args) + 1;  // account for customer
        if (equal_to(tail_call_k, k)) {
            // tail-call optimization
            let code =
                interpret_args(ctx, args,       // args...
                new_instr(debug, "msg", 1,      // args... cust
                interpret(ctx, func,            // args... cust closure
                new_instr(debug, "new", -2,     // args... cust beh.(state)
                new_instr(debug, "send", nargs, // --
                std_commit(debug))))));
            return code;
        } else {
            // construct continuation
            let beh =
                new_instr(debug, "state", 1,    // sp=(...)
                new_instr(debug, "part", -1, k));// ...
            let code =
                interpret_args(ctx, args,       // ... args...
                new_instr(debug, "my", "self",  // ... args... SELF
                interpret(ctx, func,            // ... args... cust closure
                new_instr(debug, "new", -2,     // ... args... SELF beh.(state)
                new_instr(debug, "send", nargs, // ...
                new_instr(debug, "pair", -1,    // sp=(...)
                new_instr(debug, "state", -1,   // sp env
                new_instr(debug, "push", beh,   // sp env beh
                new_instr(debug, "msg", 0,      // sp env beh msg
                new_instr(debug, "push", cont_beh,// sp env beh msg cont_beh
                new_instr(debug, "beh", 4,      // --
                std_commit(debug))))))))))));
            return code;
        }
    }

    function xlat_quote(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const sexpr = nth_sexpr(args, 1);
        const value = sexpr_to_crlf(sexpr);
        let code = new_instr(debug, "push", value, k);
        return code;
    }

    function xlat_lambda(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        let code = compile_closure(ctx, args);
        if (code.error) {
            return code;
        }
        code =
            new_instr(debug, "state", -1,       // env
            new_instr(debug, "msg", 0,          // env msg
            new_instr(debug, "push", nil_lit,   // env msg sp=()
            new_instr(debug, "pair", 2,         // data=(() msg . env)
            new_instr(debug, "push", code,      // data code
            new_instr(debug, "push", closure_t, // data code #closure_t
            new_instr(debug, "quad", 3,         // [#closure_t, code, data, #?]
            k)))))));
        return code;
    }

    function xlat_seq(ctx, crlf, k) {
        const body = crlf.tail;  // sequential body
        let code = interpret_seq(ctx, body, k);
        return code;
    }

    function xlat_list(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        let n = length_of(args);
        let code =
            new_instr(debug, "push", nil_lit,   // ()
            interpret_args(ctx, args,           // () args...
            new_instr(debug, "pair", n, k)));   // (args...)
        return code;
    }

    function xlat_cons(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const head = nth_sexpr(args, 1);
        const tail = nth_sexpr(args, 2);
        let code =
            interpret(ctx, tail,                // tail
            interpret(ctx, head,                // tail head
            new_instr(debug, "pair", 1, k)));   // (head . tail)
        return code;
    }

    function xlat_car(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const pair = nth_sexpr(args, 1);
        let code =
            interpret(ctx, pair,                // (head . tail)
            new_instr(debug, "nth", 1, k));     // head
        return code;
    }

    function xlat_cdr(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const pair = nth_sexpr(args, 1);
        let code =
            interpret(ctx, pair,                // (head . tail)
            new_instr(debug, "nth", -1, k));    // tail
        return code;
    }

    function xlat_cadr(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const pair = nth_sexpr(args, 1);
        let code =
            interpret(ctx, pair,                // pair=(head . tail)
            new_instr(debug, "nth", 2, k));     // car(cdr(pair))
        return code;
    }

    function xlat_caar(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const pair = nth_sexpr(args, 1);
        let code =
            interpret(ctx, pair,                // pair=(head . tail)
            new_instr(debug, "nth", 1,          // car(pair)
            new_instr(debug, "nth", 1, k)));    // car(car(pair))
        return code;
    }

    function xlat_cdar(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const pair = nth_sexpr(args, 1);
        let code =
            interpret(ctx, pair,                // pair=(head . tail)
            new_instr(debug, "nth", 1,          // car(pair)
            new_instr(debug, "nth", -1, k)));   // cdr(car(pair))
        return code;
    }

    function xlat_cddr(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const pair = nth_sexpr(args, 1);
        let code =
            interpret(ctx, pair,                // pair=(head . tail)
            new_instr(debug, "nth", -2, k));    // cdr(cdr(pair))
        return code;
    }

    function xlat_caddr(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const pair = nth_sexpr(args, 1);
        let code =
            interpret(ctx, pair,                // pair=(head . tail)
            new_instr(debug, "nth", 3, k));     // car(cdr(cdr(pair)))
        return code;
    }

    function xlat_cadar(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const pair = nth_sexpr(args, 1);
        let code =
            interpret(ctx, pair,                // pair=(head . tail)
            new_instr(debug, "nth", 1,          // car(pair)
            new_instr(debug, "nth", -1,         // cdr(car(pair))
            new_instr(debug, "nth", 1, k))));   // car(cdr(car(pair)))
        return code;
    }

    function xlat_cdddr(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const pair = nth_sexpr(args, 1);
        let code =
            interpret(ctx, pair,                // pair=(head . tail)
            new_instr(debug, "nth", -3, k));    // cdr(cdr(cdr(pair)))
        return code;
    }

    function xlat_cadddr(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const pair = nth_sexpr(args, 1);
        let code =
            interpret(ctx, pair,                // pair=(head . tail)
            new_instr(debug, "nth", 4, k));     // car(cdr(cdr(cdr(pair))))
        return code;
    }

    function xlat_eq_p(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const expect = nth_sexpr(args, 1);
        const actual = nth_sexpr(args, 2);
        const e_const = constant_value(expect);
        const a_const = constant_value(actual);
        if (e_const !== undefined) {
            if (a_const !== undefined) {
                if (equal_to(e_const, a_const)) {
                    return new_instr(debug, "push", true_lit, k);
                }
                return new_instr(debug, "push", false_lit, k);
            }
            let code =
                interpret(ctx, actual,              // actual
                new_instr(debug, "eq", e_const, k));// actual==expect
            return code;
        }
        if (a_const !== undefined) {
            let code =
                interpret(ctx, expect,              // expect
                new_instr(debug, "eq", a_const, k));// expect==actual
            return code;
        }
        let code =
            interpret(ctx, expect,              // expect
            interpret(ctx, actual,              // expect actual
            new_instr(debug, "cmp", "eq", k))); // expect==actual
        return code;
    }

    function xlat_null_p(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const value = nth_sexpr(args, 1);
        let code =
            interpret(ctx, value,               // value
            new_instr(debug, "eq", nil_lit, k));// value==()
        return code;
    }

    function xlat_pair_p(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const value = nth_sexpr(args, 1);
        let code =
            interpret(ctx, value,               // value
            new_instr(debug, "typeq", pair_t,   // is_pair(value)
            k));
        return code;
    }

    function xlat_boolean_p(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const value = nth_sexpr(args, 1);
        let k_t = new_instr(debug, "push", true_lit, k);
        let k_f = new_instr(debug, "push", false_lit, k);
        let code =
            interpret(ctx, value,               // value
            new_instr(debug, "dup", 1,          // value value
            new_instr(debug, "eq", true_lit,    // value value==#t
            new_if_instr(debug, k,              // value
            new_instr(debug, "eq", false_lit,   // value==#f
            new_if_instr(debug, k_t, k_f))))));
        return code;
    }

    function xlat_number_p(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const value = nth_sexpr(args, 1);
        let code =
            interpret(ctx, value,               // value
            new_instr(debug, "typeq", fixnum_t, // is_number(value)
            k));
        return code;
    }

    function xlat_actor_p(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const value = nth_sexpr(args, 1);
        let code =
            interpret(ctx, value,               // value
            new_instr(debug, "typeq", actor_t,  // is_actor(value)
            k));
        return code;
    }

    function xlat_symbol_p(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const value = nth_sexpr(args, 1);
        let code =
            interpret(ctx, value,               // value
            new_instr(debug, "typeq", symbol_t, // is_symbol(value)
            k));
        return code;
    }

    function xlat_procedure_p(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const value = nth_sexpr(args, 1);
        let code =
            interpret(ctx, value,               // value
            new_instr(debug, "typeq", closure_t,// is_closure(value)
            k));
        return code;
    }

    function xlat_behavior_p(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const value = nth_sexpr(args, 1);
        let code =
            interpret(ctx, value,               // value
            new_instr(debug, "typeq", behavior_t,// is_behavior(value)
            k));
        return code;
    }

    function xlat_lt_num(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const n = nth_sexpr(args, 1);
        const m = nth_sexpr(args, 2);
        let code =
            interpret(ctx, n,                   // n
            interpret(ctx, m,                   // n m
            new_instr(debug, "cmp", "lt", k))); // n<m
        return code;
    }

    function xlat_le_num(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const n = nth_sexpr(args, 1);
        const m = nth_sexpr(args, 2);
        let code =
            interpret(ctx, n,                   // n
            interpret(ctx, m,                   // n m
            new_instr(debug, "cmp", "le", k))); // n<=m
        return code;
    }

    function xlat_eq_num(ctx, crlf, k) {
        return xlat_eq_p(ctx, crlf, k);    // FIXME: add numeric type-checks?
        /*
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const n = nth_sexpr(args, 1);
        const m = nth_sexpr(args, 2);
        let code =
            interpret(ctx, n,                   // n
            interpret(ctx, m,                   // n m
            new_instr(debug, "cmp", "eq", k))); // n==m
        return code;
        */
    }

    function xlat_ge_num(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const n = nth_sexpr(args, 1);
        const m = nth_sexpr(args, 2);
        let code =
            interpret(ctx, n,                   // n
            interpret(ctx, m,                   // n m
            new_instr(debug, "cmp", "ge", k))); // n>=m
        return code;
    }

    function xlat_gt_num(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const n = nth_sexpr(args, 1);
        const m = nth_sexpr(args, 2);
        let code =
            interpret(ctx, n,                   // n
            interpret(ctx, m,                   // n m
            new_instr(debug, "cmp", "gt", k))); // n>m
        return code;
    }

    function xlat_add_num(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const n = nth_sexpr(args, 1);
        const m = nth_sexpr(args, 2);
        const n_const = constant_value(n);
        const m_const = constant_value(m);
        if (typeof n_const === "number" && typeof m_const === "number") {
            const value = n_const + m_const;
            return new_instr(debug, "push", value);
        }
        if (n_const === 0) {
            return interpret(ctx, m, k);
        }
        if (m_const === 0) {
            return interpret(ctx, n, k);
        }
        let code =
            interpret(ctx, n,                   // n
            interpret(ctx, m,                   // n m
            new_instr(debug, "alu", "add",      // n+m
            k)));
        return code;
    }

    function xlat_sub_num(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const n = nth_sexpr(args, 1);
        const m = nth_sexpr(args, 2);
        const n_const = constant_value(n);
        const m_const = constant_value(m);
        if (typeof n_const === "number" && typeof m_const === "number") {
            const value = n_const - m_const;
            return new_instr(debug, "push", value);
        }
        if (m_const === 0) {
            return interpret(ctx, n, k);
        }
        let code =
            interpret(ctx, n,                   // n
            interpret(ctx, m,                   // n m
            new_instr(debug, "alu", "sub",      // n-m
            k)));
        return code;
    }

    function xlat_mul_num(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const n = nth_sexpr(args, 1);
        const m = nth_sexpr(args, 2);
        const n_const = constant_value(n);
        const m_const = constant_value(m);
        if (typeof n_const === "number" && typeof m_const === "number") {
            const value = n_const * m_const;
            return new_instr(debug, "push", value);
        }
        if (n_const === 1) {
            return interpret(ctx, m, k);
        }
        if (m_const === 1) {
            return interpret(ctx, n, k);
        }
        let code =
            interpret(ctx, n,                   // n
            interpret(ctx, m,                   // n m
            new_instr(debug, "alu", "mul",      // n*m
            k)));
        return code;
    }

    function xlat_if(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const pred = nth_sexpr(args, 1);
        const cnsq = nth_sexpr(args, 2);
        const altn = nth_sexpr(args, 3);
        let code =
            interpret(ctx, pred,
            new_if_instr(debug,
                interpret(ctx, cnsq, k),
                interpret(ctx, altn, k),
            ));
        return code;
    }

    function xlat_cond(ctx, crlf, k) {
        const args = crlf.tail;
        if (args?.kind === "pair") {
            const clause = args.head;
            if (clause?.kind === "pair") {
                const test = clause.head;
                const body = clause.tail;
                const test_const = constant_value(test);
                if (equal_to(true_lit, test_const)) {
                    let code = interpret_seq(ctx, body, k);
                    return code;
                }
                if (equal_to(false_lit, test_const)) {
                    let code = xlat_cond(ctx, args, k);
                    return code;
                }
                const debug = crlf_debug(clause);
                let code =
                    interpret(ctx, test,
                    new_if_instr(debug,
                        interpret_seq(ctx, body, k),
                        xlat_cond(ctx, args, k),
                    ));
                return code;
            }
            // skip bad clause
            let code = xlat_cond(ctx, args, k);
            return code;
        }
        // empty case
        const debug = crlf_debug(args);
        let code = new_instr(debug, "push", unit_lit, k);
        return code;
    }

    function xlat_not(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const value = nth_sexpr(args, 1);
        let code =
            interpret(ctx, value,               // value
            new_if_instr(debug,
                new_instr(debug, "push", true_lit, k),
                new_instr(debug, "push", false_lit, k),
            ));
        return code;
    }

    function compile_behavior(ctx, args) {
        const ptrn = nth_sexpr(args, 1);
        const body = nth_sexpr(args, -1);
        debug_log("behavior:", "ptrn:", to_scheme(ptrn));
        debug_log("behavior:", "body:", to_scheme(body));
        const child = new_BEH_ctx(ctx, ptrn);
        const debug = crlf_debug(body);
        let code =
            interpret_seq(child, body,
            std_commit(debug));
        return code;
    }

    function new_BEH_ctx(parent, ptrn = undef_lit) {
        const ctx = {
            parent,
            interpret_literal: xlat_literal,
            interpret_variable: function(ctx, crlf, k) {
                if (crlf.name === "SELF") {
                    const debug = crlf_debug(crlf);
                    return new_instr(debug, "my", "self", k);  // SELF reference
                }
                return xlat_variable(ctx, crlf, k);
            },
            interpret_invoke: xlat_invoke,
            func_map: Object.assign(
                {},
                prim_map,
                {
                    "BECOME": xlat_not_implemented,
                }),
            state_maps: inherit_state_maps(parent),
            msg_map: pattern_to_map(ptrn)  // no implicit customer
        };
        debug_log("BEH:", "state_maps:", ctx.state_maps);
        debug_log("BEH:", "msg_map:", ctx.msg_map);
        return ctx;
    }

    function xlat_BEH(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        let code = compile_behavior(ctx, args);
        if (code.error) {
            return code;
        }
        code =
            new_instr(debug, "state", -1,       // env
            new_instr(debug, "msg", 0,          // env msg
            new_instr(debug, "push", nil_lit,   // env msg sp=()
            new_instr(debug, "pair", 2,         // data=(() msg . env)
            new_instr(debug, "push", code,      // data code
            new_instr(debug, "push", behavior_t,// data code #behavior_t
            new_instr(debug, "quad", 3,         // [#behavior_t, code, data]
            k)))))));
        return code;
    }

    function xlat_CREATE(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const beh = nth_sexpr(args, 1);
        let code =
            interpret(ctx, beh,                 // [#behavior_t, code, data]
            new_instr(debug, "new", -2, k));    // actor
        return code;
    }

    function xlat_SEND(ctx, crlf, k) {
        const debug = crlf_debug(crlf);
        const args = crlf.tail;
        const target = nth_sexpr(args, 1);
        const msg = nth_sexpr(args, 2);
        let code =
            interpret(ctx, msg,                 // msg
            interpret(ctx, target,              // msg target
            new_instr(debug, "send", -1,        // --
            new_instr(debug, "push", unit_lit,  // #unit
            k))));
        return code;
    }

    function xlat_not_implemented(ctx, crlf, k) {
        return {
            error: "not implemented",
            crlf,
            file,
            ctx
        };
    }

    function interpret(ctx, crlf, k) {
        if (k?.error) {
            return k;
        }
        if (typeof crlf === "string") {
            return {
                error: "raw String not supported",
                crlf,
                file,
                ctx
            };
        }
        if (crlf?.kind === "symbol") {
            return ctx.interpret_variable(ctx, crlf, k);
        }
        if (crlf?.kind === "pair") {
            return ctx.interpret_invoke(ctx, crlf, k);
        }
        return ctx.interpret_literal(ctx, crlf, k);
    }

    function interpret_seq(ctx, list, k) {
        if (k?.error) {
            return k;
        }
        const debug = crlf_debug(list);
        if (list?.kind === "pair") {
            const head = list?.head;
            const tail = list?.tail;
            if (tail?.kind === "pair") {
                trace_log("interpret_seq (h . t) h:", head);
                let code =
                    interpret(ctx, head,
                    new_instr(debug, "drop", 1,     // drop intermediate result
                    interpret_seq(ctx, tail, k)));
                return code;
            } else {
                trace_log("interpret_seq (h) h:", head);
                let code =
                    interpret(ctx, head,            // retain final result
                    k);
                return code;
            }
        } else {
            // empty body
            trace_log("interpret_seq () k:", k);
            let code =
                new_instr(debug, "push", unit_lit,
                k);
            return code;
        }
    }

    function interpret_args(ctx, list, k) {
        if (k?.error) {
            return k;
        }
        if (equal_to(nil_lit, list)) {
            trace_log("interpret_args () k:", k);
            return k;
        }
        if (list?.kind === "pair") {
            const head = list?.head;
            const tail = list?.tail;
            trace_log("interpret_args (h . t) h:", head);
            k = interpret(ctx, head, k);
            let code = interpret_args(ctx, tail, k);
            return code;
        }
        return {
            error: "list expected",
            body: list,
            file,
            ctx
        };
    }

    const sexprs = parse(source, file);
    if (sexprs.error) {
        warn_log("parse:", sexprs);
        return sexprs;
    }
    const ctx = new_module_ctx();
    let debug = debug_file;
    sexprs.forEach(function (sexpr) {
        debug = crlf_debug(debug, sexpr);
    });
    let k =
        new_instr(debug, "msg", 0,              // {caps}
        new_instr(debug, "push", 2,             // {caps} dev.debug_key
        new_instr(debug, "dict", "get",         // debug_dev
        std_send_msg(debug))));
    while (sexprs.length > 0) {
        const crlf = sexprs.pop(); //sexprs.shift();
        debug_log("compile:", to_scheme(crlf));
        k = interpret(ctx, crlf, k);
        if (k?.error) {
            warn_log("compile:", k);
            return k;
        }
    }
    module_env["boot"] = k;
    const ast = {
        kind: "module",
        import: {},
        define: module_env,
        export: [
            "boot"
        ]
    };
    return {
        lang: "uFork",
        ast
    };
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
    const j_ref = new_ref(undefined, j_label);
    t_chain.k = j_ref;
    f_chain.k = j_ref;
    return join;
}

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
        if (exports) {
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
        return crlf.name;
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
        const module = crlf.module;
        s += '"';
        if (typeof module === "string") {
            s += module + ".";
        }
        s += crlf.name;
        s += '"';
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
        if (arity > 0) {
            if (x_is_leaf) {
                s += " " + to_asm(crlf.x);
            } else if (arity === 1) {
                eos += to_asm(crlf.x);
                x_is_leaf = true;
            } else {
                s += ' "' + x_label + '"';
                if (y_is_leaf) {
                    s += " " + to_asm(crlf.y);
                } else if (arity === 2) {
                    eos += to_asm(crlf.y);
                    y_is_leaf = true;
                } else {
                    s += ' "' + y_label + '"';
                    if (z_is_leaf) {
                        s += " " + to_asm(crlf.z);
                    } else {
                        asm_label += 1;
                        eos += to_asm(crlf.z);
                    }
                }
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

export default Object.freeze({parse, compile, to_asm});

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
const cond_source = `
(define fn
    (lambda (n)
        (cond
            ((< n 0) 1)
            ((> n 0) -1)
            (#f #?)
            (#t 1 -1 0)
        )))
(list (fn -1) (fn 0) (fn 1) (fn))`;
const let_source = `
(let ((a 1) (b 2) (c 3)) (list a b c))
;((lambda (a b c) (list a b c)) 1 2 3)
;(let (  ; requires "letrec"
;        (odd (lambda (n) (if (= n 0) #f (even (- n 1)))))
;        (even (lambda (n) (if (= n 0) #t (odd (- n 1)))))
;    )
;    (list (odd 3) (even 3)))  ; ==> (#t #f)`;
const test_source = `
f n z
0
(define z 0)
1
(define n '(1 2 3))
2
(define f (lambda (x y) y))
3
(define length
    (lambda (x)
        (if (pair? x)
            (+ (length (cdr x)) 1)
            0) ))
z n f 'a 'foo
(length n)
(not z n)
(f n z)
'((a b) c)
`;

// const sexprs = parse(" `('foo (,bar ,@baz) . quux)\r\n");
// const sexprs = parse("'(0 1 -1 #t #f #nil #? () . #unit)");
// const sexprs = parse("(if (< n 0) #f #t)");
// const sexprs = parse("(lambda (x . y) x)");
//debug const sexprs = parse("(define f (lambda (x y) y))\n(f 0)\n");
//debug info_log("sexprs:", sexprs);
//debug if (!sexprs.error) {
//debug     sexprs.forEach(function (sexpr) {
//debug         info_log("sexpr:", to_scheme(sexpr));
//debug     });
//debug }

// const module = compile("(define z 0)");
// const module = compile("(define foo 'bar)");
// const module = compile("(define foo '(bar baz . quux))");
// const module = compile("(define nop (lambda _))");
// const module = compile("(define list (lambda x x))");
// const module = compile("(define id (lambda (x) x))");
// const module = compile("(define id (lambda (x . y) x))");
// const module = compile("(define f (lambda (x y) y))");
// const module = compile("(define fn (lambda (x) 0 x y q.z))");  // NOTE: "q.z" is _not_ a valid identifier!
// const module = compile("(define w (lambda (f) (f f)))");
// const module = compile("(define Omega (lambda _ ((lambda (f) (f f)) (lambda (f) (f f))) ))");
// const module = compile("(define fn (lambda (x y z) (list z (cons y x)) (car q) (cdr q) ))");
// const module = compile("(define fn (lambda (x y z) (if (eq? 'x x) (list z y x) (cons y z)) ))");
// const module = compile("(define fn (lambda (x y) (list (cons 'x x) (cons 'y y)) '(x y z) ))");
// const module = compile("(define f (lambda (x) (+ 1 (if x 42 69)) )) (list (f -1) (f 0) (f 1))");
// const module = compile("(define f (lambda (x y) y))\n(f 0)\n");
// const module = compile("(define hof (lambda (foo) (lambda (bar) (lambda (baz) (list 'foo foo 'bar bar 'baz baz) )))) (((hof 'a) '(b c)) '(#t . #f))");
// const module = compile("(define inc ((lambda (a) (lambda (b) (+ a b))) 1))");
// const module = compile("(define sink_beh (BEH _))");
// const module = compile("(define zero_beh (BEH (cust) (SEND cust 0)))");
// const module = compile("(define true_beh (BEH (cust) (SEND cust #t)))");
// const module = compile(sample_source);
// const module = compile(ifact_source);
// const module = compile(fact_source);
// const module = compile(fib_source);
// const module = compile(hof2_source);
// const module = compile(hof3_source);
// const module = compile(cond_source);
// const module = compile(let_source);
//debug const module = compile(test_source);
//debug info_log(JSON.stringify(module, undefined, 2));
//debug if (!module?.error) {
//debug     info_log(to_asm(module.ast));
//debug }
