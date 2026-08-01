//
// Parser for Director (Actor Scripting Language)
//

/*jslint global, long, bitwise */

import tokenize from "./dir_tokenize.js";

// Produce an abstract syntax tree from a `text` String.
// The optional `src` parameter describes where `text` came from.
//
// This algorithm was inspired by
// https://github.com/douglascrockford/Misty/blob/38d82d789950f684c3ec32e6c57a42806f779349/js/parse.js
// which is in turn based on https://www.crockford.com/javascript/tdop/tdop.html

function parse(text, src, top) {
    const ast = {};
    const tokens = tokenize(text, src);
    const end_token = tokens.at(-1);
    let token;
    let at = 0;

    function peek() {
        token = tokens.at(at);
        if (token === undefined) {
            token = end_token;
        }
        return token;
    }

    function advance() {
        if (token.kind !== "end") {
            at += 1;
        }
        return peek();
    }

    function mark() {
        return {at};
    }

    function reset(memo) {
        // {at} = memo;
        at = memo.at;
        return peek();
    }

    function error(message) {
        token.context = "error";
        token.message = message;
        token.src = src;
        return token;
    }

    function empty() {
        return;
    }

    const heads = {};
    function head(t) {  // prefix operator
        if (
            (t.kind === "name")
            || (t.kind === "number")
            || (t.kind === "text")
        ) {
            return t;  // these tokens evaluate to themselves
        }
        if (t.kind === "operator") {
            const fn = heads[t.text];
            if (fn) {
                return fn(t);
            }
        }
        return error("unknown expression");
    }

    const tails = {};
    function tail(t, left) {  // infix/suffix operator
        if (t.kind === "operator") {
            const fn = tails[t.text];
            if (fn) {
                return fn(t, left);
            }
        }
        return error("unknown operator");
    }

    const lbps = {  // applies only to infix/suffix operators
        "||": 20,
        "&&": 30,
        "==": 40,
        "!=": 40,
        "<": 40,
        "<=": 40,
        ">": 40,
        ">=": 40,
        "+": 50,
        "-": 50,
        "*": 60,
        "/": 60,
        "^": 70,
        // "!": 80,  // prefix
        ".": 90,
        "[": 90
    };
    function lbp(t) {  // operator precedence (left-binding power)
        if (t.kind === "operator") {
            const p = lbps[t.text];
            if (p) {
                return p;
            }
        }
        return 0;
    }

    function xsp(t) {  // required space around operator
        if (t.kind === "operator") {
            if (t.text === "." || t.text === "[") {
                return 0;
            }
            return 1;
        }
        return 0;
    }

    function expression(rbp = 0) {
        let right = token;
        advance();
        let lsp = 0;
        if (token.kind === "space") {
            lsp = token.text.length;
            advance();
        }
        let left = head(right);  // Pratt: "nud"
        while (rbp < lbp(token)) {
            const sp = xsp(token);
            if (sp !== lsp) {
                return error("required " + sp + " space, got " + lsp);
            }
            right = token;
            advance();
            let rsp = 0;
            if (token.kind === "space") {
                rsp = token.text.length;
                advance();
            }
            if (sp !== rsp) {
                return error("required " + sp + " space, got " + rsp);
            }
            left = tail(right, left);  // Pratt: "led"
            lsp = rsp;
        }
        return left;

        // var left;
        // var t = token;
        // advance();
        // left = t.nud();
        // while (rbp < token.lbp) {
        //     t = token;
        //     advance();
        //     left = t.led(left);
        // }
        // return left;
    }

    function list_op(t) {
        const args = [];
        const is_empty = ((token.kind === "operator") && (token.text === "]"));
        let sp = 0;
        while (!is_empty) {
            // parse item
            const item = expression();
            if (item.kind === "error") {
                return item;
            }
            args.push(item);
            // closing or separator
            if ((token.kind === "operator") && (token.text === "]")) {
                break;
            }
            if ((token.kind !== "operator") || (token.text !== ",")) {
                return error("',' required");
            }
            advance();
            sp = 0;
            if (token.kind === "space") {
                sp = token.text.length;
                advance();
            }
            if (sp !== 1) {
                return error("required 1 space, got " + sp);
            }
        }
        advance();
        t.args = args;
        return t;
    }
    function prefix_op(t) {
        const expr = expression(80);
        t.args = [expr];
        return t;
    }
    heads["!"] = prefix_op;
    heads["-"] = prefix_op;
    heads["("] = function nud(/*t*/) {
        const expr = expression(0);
        if ((token.kind === "operator") && (token.text === ")")) {
            advance();
            return expr;
        }
        return error("')' required");
    };
    heads["["] = list_op;
    heads["{"] = function nud(t) {
        const args = [];
        const is_empty = ((token.kind === "operator") && (token.text === "}"));
        let sp = 0;
        while (!is_empty) {
            // parse key
            const key = expression();
            if (key.kind === "error") {
                return key;
            }
            if ((token.kind !== "operator") || (token.text !== ":")) {
                return error("':' required");
            }
            const key_value = token;
            advance();
            sp = 0;
            if (token.kind === "space") {
                sp = token.text.length;
                advance();
            }
            if (sp !== 1) {
                return error("required 1 space, got " + sp);
            }
            // parse value
            const val = expression();
            if (val.kind === "error") {
                return val;
            }
            key_value.args = [key, val];
            args.push(key_value);
            // closing or separator
            if ((token.kind === "operator") && (token.text === "}")) {
                break;
            }
            if ((token.kind !== "operator") || (token.text !== ",")) {
                return error("',' required");
            }
            advance();
            sp = 0;
            if (token.kind === "space") {
                sp = token.text.length;
                advance();
            }
            if (sp !== 1) {
                return error("required 1 space, got " + sp);
            }
        }
        advance();
        t.args = args;
        return t;
    };

    function infix_op(t, left) {
        const right = expression(lbp(t));
        t.args = [left, right];
        return t;
    }
    tails["||"] = infix_op;
    tails["&&"] = infix_op;
    tails["=="] = infix_op;
    tails["!="] = infix_op;
    tails["<"] = infix_op;
    tails["<="] = infix_op;
    tails[">"] = infix_op;
    tails[">="] = infix_op;
    tails["+"] = infix_op;
    tails["-"] = infix_op;
    tails["*"] = infix_op;
    tails["/"] = infix_op;
    tails["^"] = infix_op;
    tails["."] = infix_op;
    tails["["] = function led(t, left) {
        const right = list_op(t);
        // synthesize a `.` operator from the `[` token
        t = Object.assign({}, t, {text: ".", args: [left, right]});
        return t;
    };

    function module() {
        empty();
    }

    function strip_ast(from) {
        if (from === undefined) {
            return undefined;
        }
        let to = {};
        to.kind = from.kind;
        if (from.context) {
            to.context = from.context;
        }
        if (from.message) {
            to.message = from.message;
        }
        to.text = from.text;
        if (to.kind === "operator") {
            if (from.args) {
                to.args = from.args.map(strip_ast);
            }
        }
        return to;
    }

    let parser = module;  // default top-level parser
    if (top === "empty") {
        parser = empty;
    } else if (top === "expression") {
        parser = expression;
    }
    peek();
    const root = parser();
    ast.root = strip_ast(root);
    ast.tokens = tokens;
    return ast;
}

function assert_parse(top, text, expect) {
    const s_expect = JSON.stringify(expect);
    const actual = parse(text, "", top);
    const s_actual = JSON.stringify(actual);
    if (s_actual !== s_expect) {
        throw new Error("Expect: " + s_expect + ", Actual: " + s_actual);
    }
}

function assert_parse_expression(text, expect) {
    const s_expect = JSON.stringify(expect);
    const actual = parse(text, "", "expression");
    const s_actual = JSON.stringify(actual.root);
    if (s_actual !== s_expect) {
        throw new Error("Expect: " + s_expect + ", Actual: " + s_actual);
    }
}

function test_parse() {
    assert_parse(
        "empty",
        "",
        {tokens: [
            {kind: "end", line: 1, column: 1, start: 0, end: 0, text: ""}
        ]}
    );
    assert_parse(
        "module",
        "",
        {tokens: [
            {kind: "end", line: 1, column: 1, start: 0, end: 0, text: ""}
        ]}
    );
    assert_parse(
        "expression",
        "42",
        {
            root: {kind: "number", text: "42"},
            tokens: [
                {kind: "number", line: 1, column: 1, base: 10, exponent: 0, significand: 42, start: 0, end: 2, text: "42"},
                {kind: "end", line: 1, column: 3, start: 2, end: 2, text: ""}
            ]
        }
    );
    // assert_parse(
    //     "expression",
    //     "1 + 2",
    //     {
    //         root: {
    //             kind: "operator",
    //             text: "+",
    //             args: [
    //                 {kind: "number", text: "1"},
    //                 {kind: "number", text: "2"}
    //             ]
    //         },
    //         tokens: [
    //             {kind: "number", line: 1, column: 1, base: 10, exponent: 0, significand: 1, start: 0, end: 1, text: "1"},
    //             {kind: "space", line: 1, column: 2, start: 1, end: 2, text: " "},
    //             {kind: "operator", line: 1, column: 3, start: 2, end: 3, text: "+", lsp: 1, rsp: 1, lbp: 50, args: [
    //                 {kind: "number", line: 1, column: 1, base: 10, exponent: 0, significand: 1, start: 0, end: 1, text: "1"},
    //                 {kind: "number", line: 1, column: 5, base: 10, exponent: 0, significand: 2, start: 4, end: 5, text: "2"}
    //             ]},
    //             {kind: "space", line: 1, column: 4, start: 3, end: 4, text: " "},
    //             {kind: "number", line: 1, column: 5, base: 10, exponent: 0, significand: 2, start: 4, end: 5, text: "2"},
    //             {kind: "end", line: 1, column: 6, start: 5, end: 5, text: ""}
    //         ]
    //     }
    // );
    assert_parse_expression(
        "-0.5",
        {kind: "number", text: "-0.5"}
    );
    assert_parse_expression(
        "3 + 5",
        {kind: "operator", text: "+", args: [
            {kind: "number", text: "3"},
            {kind: "number", text: "5"}
        ]}
    );
    assert_parse_expression(
        "7 - 5 - 3",
        {kind: "operator", text: "-", args: [
            {kind: "operator", text: "-", args: [
                {kind: "number", text: "7"},
                {kind: "number", text: "5"}
            ]},
            {kind: "number", text: "3"}
        ]}
    );
    assert_parse_expression(
        "3 * 5 + 7",
        {kind: "operator", text: "+", args: [
            {kind: "operator", text: "*", args: [
                {kind: "number", text: "3"},
                {kind: "number", text: "5"}
            ]},
            {kind: "number", text: "7"}
        ]}
    );
    assert_parse_expression(
        "3 + 5 * 7",
        {kind: "operator", text: "+", args: [
            {kind: "number", text: "3"},
            {kind: "operator", text: "*", args: [
                {kind: "number", text: "5"},
                {kind: "number", text: "7"}
            ]}
        ]}
    );
    assert_parse_expression(
        "3 * (5 + 7)",
        {kind: "operator", text: "*", args: [
            {kind: "number", text: "3"},
            {kind: "operator", text: "+", args: [
                {kind: "number", text: "5"},
                {kind: "number", text: "7"}
            ]}
        ]}
    );
    assert_parse_expression(
        "3 + 5 * 10 ^ -2",
        {kind: "operator", text: "+", args: [
            {kind: "number", text: "3"},
            {kind: "operator", text: "*", args: [
                {kind: "number", text: "5"},
                {kind: "operator", text: "^", args: [
                    {kind: "number", text: "10"},
                    {kind: "number", text: "-2"}
                ]}
            ]}
        ]}
    );
    assert_parse_expression(
        "x + -y",
        {kind: "operator", text: "+", args: [
            {kind: "name", text: "x"},
            {kind: "operator", text: "-", args: [
                {kind: "name", text: "y"}
            ]}
        ]}
    );
    assert_parse_expression(
        "x - -y - z",
        {kind: "operator", text: "-", args: [
            {kind: "operator", text: "-", args: [
                {kind: "name", text: "x"},
                {kind: "operator", text: "-", args: [
                    {kind: "name", text: "y"}
                ]}
            ]},
            {kind: "name", text: "z"}
        ]}
    );
    assert_parse_expression(
        "True && False || True",
        {kind: "operator", text: "||", args: [
            {kind: "operator", text: "&&", args: [
                {kind: "name", context: "literal", text: "True"},
                {kind: "name", context: "literal", text: "False"}
            ]},
            {kind: "name", context: "literal", text: "True"}
        ]}
    );
    assert_parse_expression(
        "False || True && False",
        {kind: "operator", text: "||", args: [
            {kind: "name", context: "literal", text: "False"},
            {kind: "operator", text: "&&", args: [
                {kind: "name", context: "literal", text: "True"},
                {kind: "name", context: "literal", text: "False"}
            ]}
        ]}
    );
    assert_parse_expression(
        "{}",
        {kind: "operator", text: "{", args: []}
    );
    assert_parse_expression(
        "{\"first\": 3}",
        {kind: "operator", text: "{", args: [
            {kind: "operator", text: ":", args: [
                {kind: "text", text: "\"first\""},
                {kind: "number", text: "3"}
            ]}
        ]}
    );
    assert_parse_expression(
        "{\"first\": 3, \"second\": 5}",
        {kind: "operator", text: "{", args: [
            {kind: "operator", text: ":", args: [
                {kind: "text", text: "\"first\""},
                {kind: "number", text: "3"}
            ]},
            {kind: "operator", text: ":", args: [
                {kind: "text", text: "\"second\""},
                {kind: "number", text: "5"}
            ]}
        ]}
    );
    assert_parse_expression(
        "{\"first\": 3, \"second\": 5, \"third\": 7}",
        {kind: "operator", text: "{", args: [
            {kind: "operator", text: ":", args: [
                {kind: "text", text: "\"first\""},
                {kind: "number", text: "3"}
            ]},
            {kind: "operator", text: ":", args: [
                {kind: "text", text: "\"second\""},
                {kind: "number", text: "5"}
            ]},
            {kind: "operator", text: ":", args: [
                {kind: "text", text: "\"third\""},
                {kind: "number", text: "7"}
            ]}
        ]}
    );
    assert_parse_expression(
        "[]",
        {kind: "operator", text: "[", args: []}
    );
    assert_parse_expression(
        "[?]",
        {kind: "operator", text: "[", args: [
            {kind: "name", context: "literal", text: "?"}
        ]}
    );
    assert_parse_expression(
        "[?, False]",
        {kind: "operator", text: "[", args: [
            {kind: "name", context: "literal", text: "?"},
            {kind: "name", context: "literal", text: "False"}
        ]}
    );
    assert_parse_expression(
        "[?, False, +0]",
        {kind: "operator", text: "[", args: [
            {kind: "name", context: "literal", text: "?"},
            {kind: "name", context: "literal", text: "False"},
            {kind: "number", text: "+0"}
        ]}
    );
    assert_parse_expression(
        "@.debug",
        {kind: "operator", text: ".", args: [
            {kind: "name", context: "literal", text: "@"},
            {kind: "name", text: "debug"}
        ]}
    );
    assert_parse_expression(
        "2 * @.n + 1",
        {kind: "operator", text: "+", args: [
            {kind: "operator", text: "*", args: [
                {kind: "number", text: "2"},
                {kind: "operator", text: ".", args: [
                    {kind: "name", context: "literal", text: "@"},
                    {kind: "name", text: "n"}
                ]}
            ]},
            {kind: "number", text: "1"}
        ]}
    );
    assert_parse_expression(
        "@[\"debug\"]",
        {kind: "operator", text: ".", args: [
            {kind: "name", context: "literal", text: "@"},
            {kind: "operator", text: "[", args: [
                {kind: "text", text: "\"debug\""}
            ]}
        ]}
    );
    assert_parse_expression(
        "add[5, -3]",
        {kind: "operator", text: ".", args: [
            {kind: "name", context: "literal", text: "add"},
            {kind: "operator", text: "[", args: [
                {kind: "number", text: "5"},
                {kind: "number", text: "-3"}
            ]}
        ]}
    );
    assert_parse(
        "module",
`boot:  // {} <- {dev_caps}
    let debug_dev be @.debug
    send {"answer": 42} to debug_dev

export[boot]`,
        {tokens: [
            {kind: "name", line: 1, column: 1, indentation: 0, start: 0, end: 4, text: "boot"},
            {kind: "operator", line: 1, column: 5, start: 4, end: 5, text: ":"},
            {kind: "space", line: 1, column: 6, start: 5, end: 7, text: "  "},
            {kind: "comment", line: 1, column: 8, start: 7, end: 26, text: "// {} <- {dev_caps}"},
            {kind: "newline", line: 1, column: 27, start: 26, end: 27, text: "\n"},

            {kind: "space", line: 2, column: 1, indent: 1, indentation: 4, start: 27, end: 31, text: "    "},
            {kind: "name", line: 2, column: 5, context: "keyword", start: 31, end: 34, text: "let"},
            {kind: "space", line: 2, column: 8, start: 34, end: 35, text: " "},
            {kind: "name", line: 2, column: 9, start: 35, end: 44, text: "debug_dev"},
            {kind: "space", line: 2, column: 18, start: 44, end: 45, text: " "},
            {kind: "name", line: 2, column: 19, context: "keyword", start: 45, end: 47, text: "be"},
            {kind: "space", line: 2, column: 21, start: 47, end: 48, text: " "},
            {kind: "name", line: 2, column: 22, context: "literal", start: 48, end: 49, text: "@"},
            {kind: "operator", line: 2, column: 23, start: 49, end: 50, text: "."},
            {kind: "name", line: 2, column: 24, start: 50, end: 55, text: "debug"},
            {kind: "newline", line: 2, column: 29, start: 55, end: 56, text: "\n"},

            {kind: "space", line: 3, column: 1, indentation: 4, start: 56, end: 60, text: "    "},
            {kind: "name", line: 3, column: 5, context: "keyword", start: 60, end: 64, text: "send"},
            {kind: "space", line: 3, column: 9, start: 64, end: 65, text: " "},
            {kind: "operator", line: 3, column: 10, start: 65, end: 66, text: "{"},
            {kind: "text", line: 3, column: 11, unicode: [97, 110, 115, 119, 101, 114], start: 66, end: 74, text: "\"answer\""},
            {kind: "operator", line: 3, column: 19, start: 74, end: 75, text: ":"},
            {kind: "space", line: 3, column: 20, start: 75, end: 76, text: " "},
            {kind: "number", line: 3, column: 21, base: 10, exponent: 0, significand: 42, start: 76, end: 78, text: "42"},
            {kind: "operator", line: 3, column: 23, start: 78, end: 79, text: "}"},
            {kind: "space", line: 3, column: 24, start: 79, end: 80, text: " "},
            {kind: "name", line: 3, column: 25, context: "keyword", start: 80, end: 82, text: "to"},
            {kind: "space", line: 3, column: 27, start: 82, end: 83, text: " "},
            {kind: "name", line: 3, column: 28, start: 83, end: 92, text: "debug_dev"},
            {kind: "newline", line: 3, column: 37, start: 92, end: 93, text: "\n"},

            {kind: "newline", line: 4, column: 1, start: 93, end: 94, text: "\n"},

            {kind: "name", line: 5, column: 1, context: "directive", dedent: 1, indentation: 0, start: 94, end: 100, text: "export"},
            {kind: "operator", line: 5, column: 7, start: 100, end: 101, text: "["},
            {kind: "name", line: 5, column: 8, start: 101, end: 105, text: "boot"},
            {kind: "operator", line: 5, column: 12, start: 105, end: 106, text: "]"},
            {kind: "end", line: 5, column: 13, start: 106, end: 106, text: ""}
        ]}
    );
}

if (import.meta.main) {
    test_parse();
}

export default Object.freeze(parse);
