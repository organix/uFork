// uFork Scheme compiler

// Transforms Scheme source code into an intermediate representation
// that is suitable for loading.

// The intermediate representation is described in crlf.md.

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
    return { "kind": "instr", op, imm, k };
}

function new_if_instr(op, t = undef_lit, f = undef_lit) {
    return { "kind": "instr", "op": "if", t, f };
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
        return parse_sexpr(input.next);
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
            name: symbol_to_label(input.token)
        };    
    }
    return input;
}

function symbol_to_label(symbol) {
    // FIXME: translate name to ASM-valid label
    return "$" + symbol;
}

function compile(source) {
    const str_in = string_input(source);
    const lex_in = lex_input(str_in);
    const sexpr = parse_sexpr(lex_in);
    return sexpr;
}

//const sexpr = compile(" `('foo (,bar ,@baz) . quux)\r\n");
//const sexpr = compile("(0 1 -1 #t #f #nil #? () . #unit)");
const sexpr = compile("(if (< n 0) #f #t)");
//console.log(sexpr);
console.log(JSON.stringify(sexpr, undefined, 2));

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
