//
// Director - An Actor Scripting Language
//

/*jslint global, long */

// Decimal | Hex   | Char. | Usage
// --------+-------+-------+------------------------
// 48-57   | 30-39 | 0 - 9 | decimal digit
// 65-90   | 41-5A | A - Z | uppercase letter
// 95      | 5F    | _     | letter/digit separator
// 97-122  | 61-7A | a - z | lowercase letter

const code_zero = 48;
const code_nine = 57;
const code_upper_a = 65;
const code_upper_z = 90;
const code_underscore = 95;
const code_lower_a = 97;
const code_lower_z = 122;

function is_digit(code) {
    return (code_zero <= code) && (code <= code_nine);
}

function is_letter(code) {
    return ((code_upper_a <= code) && (code <= code_upper_z))
    || ((code_lower_a <= code) && (code <= code_lower_z));
}

function is_name_head(code) {
    return is_letter(code) || (code === code_underscore);
}

function is_name_tail(code) {
    return is_letter(code) || is_digit(code) || (code === code_underscore);
}

const literals = [
    "True",
    "False",
    "Null",
    "Boolean",
    "Number",
    "Text",
    "List",
    "Dict",
    "Actor",
    "Script",
    "Type",
    "?"
];

// Produce an Array of Token objects from a `text` String.
// The optional `src` parameter describes where `text` came from.
//
// This algorithm was inspired by
// https://github.com/douglascrockford/Misty/blob/38d82d789950f684c3ec32e6c57a42806f779349/js/tokenize.js

function tokenize(text, src) {
    const tokens = [];
    let token = {};
    let char = undefined;
    let code = undefined;
    let start = 0;
    let end = 0;
    let line = 1;
    let column = 1;
    let indentation = 0;

    function peek(offset = 0) {
        code = text.codePointAt(end + offset);
        if (code === undefined) {
            char = undefined;
        } else {
            char = String.fromCodePoint(code);
        }
        return char;
    }

    function advance() {
        if (code !== undefined) {
            if (code <= 0xFFFF) {
                end += 1;
            } else {
                end += 2;  // surrogate pair
            }
            column += 1;
        }
        return peek();
    }

    function error(message) {
        token.kind = "error";
        token.message = message;
        token.src = src;
        advance();
    }

    function track_indentation(depth = 0) {
        if (token.column === 1) {
            if (depth > indentation) {
                token.indent = 0;
                while (depth > indentation) {
                    token.indent += 1;
                    indentation += 4;
                }
            } else if (depth < indentation) {
                token.dedent = 0;
                while (depth < indentation) {
                    token.dedent += 1;
                    indentation -= 4;
                }
            }
            token.indentation = indentation;
        }
    }

    function space() {
        token.kind = "space";
        while (true) {
            if (advance() !== " ") {
                break;
            }
        }
        track_indentation(end - start);
    }

    function newline() {
        token.kind = "newline";
        advance();
        line += 1;
        column = 1;
    }

    function carriage_return() {
        token.kind = "newline";
        if (advance() === "\n") {
            advance();
        }
        line += 1;
        column = 1;
    }

    function comment() {
        token.kind = "comment";
        while (true) {
            advance();
            if ((char === "\n") || (char === "\r") || (char === undefined)) {
                break;
            }
        }
    }

    function operator() {
        token.kind = "operator";
        advance();
    }

    function solidus() {
        if (advance() === "/") {
            return comment();
        }
        token.kind = "operator";
    }

    function question_mark() {
        token.kind = "literal";
        advance();
    }

    function at_sign() {
        token.kind = "literal";
        if (advance() === "@") {
            advance();
        }
    }

    function name() {
        token.kind = "name";
        while (true) {
            advance();
            if (!is_name_tail(code)) {
                break;
            }
        }
        const slice = text.slice(start, end);
        if (literals.includes(slice)) {
            token.kind = "literal";
        }
        track_indentation();
    }

    function integer(sign = 1) {
        let amount = 0;
        while (char !== undefined) {
            let increment = (code - code_zero);
            if ((increment < 0) || (increment > 9)) {
                break;
            }
            amount *= 10;
            amount += increment;
            advance();
            if (char === "_") {
                advance();
            }
        }
        return (
            sign < 0
            ? -amount
            : amount
        );
    }

    function based(sign = 1) {
        let dot = false;
        token.significand = 0;
        while (char !== undefined) {
            if (char === "_") {
                advance();
            } else if ((char === ".") && !dot) {
                dot = true;
                advance();
            }
            let floor = 0;
            let increment = (code - code_zero);
            if ((token.base > 10) && (code > code_nine)) {
                floor = 10;
                if (code < code_lower_a) {
                    increment = 10 + (code - code_upper_a);
                } else {
                    increment = 10 + (code - code_lower_a);
                }
            }
            if ((increment < floor) || (increment >= token.base)) {
                break;
            }
            token.significand *= token.base;
            token.significand += increment;
            if (dot) {
                token.exponent -= 1;
            }
            advance();
        }
        if (sign < 0) {
            token.significand = -token.significand;
        }
    }

    function number(sign = 1) {
        token.kind = "number";
        token.base = 10;
        token.exponent = 0;
        let reset = end;
        let amount = integer();
        if (char === ".") {
            end = reset;
            peek();
            return based(sign);
        }
        if (char === ":") {
            token.significand = (
                sign < 0
                ? -amount
                : amount
            );
            advance();
            if (!is_digit(code)) {
                return error("invalid number");
            }
            token.base = integer();
            token.exponent = -1;
            token.numerator = token.significand;
            token.denominator = token.base;
            return;
        }
        if (char === "^") {
            let e_sign = 1;
            if (advance() === "-") {
                advance();
                e_sign = -1;
            }
            if (!is_digit(code)) {
                return error("invalid number");
            }
            token.exponent = integer(e_sign);
        }
        if (char === "#") {
            advance();
            token.base = amount;
            return based(sign);
        }
        token.significand = (
            sign < 0
            ? -amount
            : amount
        );
    }

    function plus() {
        advance();
        if (is_digit(code)) {
            return number(1);
        }
        token.kind = "operator";
    }

    function minus() {
        advance();
        if (is_digit(code)) {
            return number(-1);
        }
        token.kind = "operator";
    }

    function quote() {
        token.kind = "text";
        while (true) {
            if (advance() === "\"") {
                break;
            }
            if (char === undefined) {
                return error("unterminated text");
            }
        }
        advance();
    }

    const handlers = {
        " ": space,
        "\n": newline,
        "\r": carriage_return,
        "/": solidus,
        "?": question_mark,
        "@": at_sign,
        "+": plus,
        "-": minus,
        "*": operator,
        ":": operator,
        ".": operator,
        ",": operator,
        "\"": quote,
        "[": operator,
        "]": operator,
        "{": operator,
        "}": operator,
        "\t": error
    };
    function dispatch() {
        let handler = handlers[char];
        if (typeof handler === "function") {
            return handler();
        }
        if (is_name_head(code)) {
            return name();
        }
        if (is_digit(code)) {
            return number();
        }
        error();
    }

    while (peek()) {
        token = {
            kind: "error",
            line,
            column
        };
        dispatch();
        Object.assign(token, {
            start,
            end,
            text: text.slice(start, end)
        });
        start = end;
        tokens.push(token);
    }
    return tokens;
}

function assert_tokenize(text, expect) {
    const s_expect = JSON.stringify(expect);
    const actual = tokenize(text);
    const s_actual = JSON.stringify(actual);
    if (s_actual !== s_expect) {
        throw new Error("Expect: " + s_expect + ", Actual: " + s_actual);
    }
}

function test_tokenize() {
    assert_tokenize("", []);
    assert_tokenize(" ", [
        {
            kind: "space",
            line: 1,
            column: 1,
            indent: 1,
            indentation: 4,
            start: 0,
            end: 1,
            text: " "
        }
    ]);
    assert_tokenize("  ", [
        {
            kind: "space",
            line: 1,
            column: 1,
            indent: 1,
            indentation: 4,
            start: 0,
            end: 2,
            text: "  "
        }
    ]);
    assert_tokenize("    ", [
        {
            kind: "space",
            line: 1,
            column: 1,
            indent: 1,
            indentation: 4,
            start: 0,
            end: 4,
            text: "    "
        }
    ]);
    assert_tokenize("     ", [
        {
            kind: "space",
            line: 1,
            column: 1,
            indent: 2,
            indentation: 8,
            start: 0,
            end: 5,
            text: "     "
        }
    ]);
    assert_tokenize("//", [
        {
            kind: "comment",
            line: 1,
            column: 1,
            start: 0,
            end: 2,
            text: "//"
        }
    ]);
    assert_tokenize(" //", [
        {
            kind: "space",
            line: 1,
            column: 1,
            indent: 1,
            indentation: 4,
            start: 0,
            end: 1,
            text: " "
        },
        {
            kind: "comment",
            line: 1,
            column: 2,
            start: 1,
            end: 3,
            text: "//"
        }
    ]);
    assert_tokenize("// ", [
        {
            kind: "comment",
            line: 1,
            column: 1,
            start: 0,
            end: 3,
            text: "// "
        }
    ]);
    assert_tokenize("// \r\n", [
        {
            kind: "comment",
            line: 1,
            column: 1,
            start: 0,
            end: 3,
            text: "// "
        },
        {
            kind: "newline",
            line: 1,
            column: 4,
            start: 3,
            end: 5,
            text: "\r\n"
        }
    ]);
    assert_tokenize("0", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: 0,
            significand: 0,
            start: 0,
            end: 1,
            text: "0"
        }
    ]);
    assert_tokenize("13", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: 0,
            significand: 13,
            start: 0,
            end: 2,
            text: "13"
        }
    ]);
    assert_tokenize("-345", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: 0,
            significand: -345,
            start: 0,
            end: 4,
            text: "-345"
        }
    ]);
    assert_tokenize("+6_789", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: 0,
            significand: 6789,
            start: 0,
            end: 6,
            text: "+6_789"
        }
    ]);
    assert_tokenize("3.14", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: -2,
            significand: 314,
            start: 0,
            end: 4,
            text: "3.14"
        }
    ]);
    assert_tokenize("10#13", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: 0,
            significand: 13,
            start: 0,
            end: 5,
            text: "10#13"
        }
    ]);
    assert_tokenize("2#1101", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 2,
            exponent: 0,
            significand: 13,
            start: 0,
            end: 6,
            text: "2#1101"
        }
    ]);
    assert_tokenize("49_374", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: 0,
            significand: 49374,
            start: 0,
            end: 6,
            text: "49_374"
        }
    ]);
    assert_tokenize("16#C0de", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 16,
            exponent: 0,
            significand: 49374,
            start: 0,
            end: 7,
            text: "16#C0de"
        }
    ]);
    assert_tokenize("2#1100_0000_1101_1110", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 2,
            exponent: 0,
            significand: 49374,
            start: 0,
            end: 21,
            text: "2#1100_0000_1101_1110"
        }
    ]);
    assert_tokenize("2^2#11.01", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 2,
            exponent: 0,
            significand: 13,
            start: 0,
            end: 9,
            text: "2^2#11.01"
        }
    ]);
    assert_tokenize("123.456", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: -3,
            significand: 123456,
            start: 0,
            end: 7,
            text: "123.456"
        }
    ]);
    assert_tokenize("10^-3#123456", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: -3,
            significand: 123456,
            start: 0,
            end: 12,
            text: "10^-3#123456"
        }
    ]);
    assert_tokenize("10^2#1.23456", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: -3,
            significand: 123456,
            start: 0,
            end: 12,
            text: "10^2#1.23456"
        }
    ]);
    assert_tokenize("-420", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: 0,
            significand: -420,
            start: 0,
            end: 4,
            text: "-420"
        }
    ]);
    assert_tokenize("-10^2#4.2", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: 1,
            significand: -42,
            start: 0,
            end: 9,
            text: "-10^2#4.2"
        }
    ]);
    assert_tokenize("-0.5", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: -1,
            significand: -5,
            start: 0,
            end: 4,
            text: "-0.5"
        }
    ]);
    assert_tokenize("-10^-1#5", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: -1,
            significand: -5,
            start: 0,
            end: 8,
            text: "-10^-1#5"
        }
    ]);
    assert_tokenize("0.675", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: -3,
            significand: 675,
            start: 0,
            end: 5,
            text: "0.675"
        }
    ]);
    assert_tokenize("5:8", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 8,
            exponent: -1,
            significand: 5,
            numerator: 5,
            denominator: 8,
            start: 0,
            end: 3,
            text: "5:8"
        }
    ]);
    assert_tokenize("8^-1#5", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 8,
            exponent: -1,
            significand: 5,
            start: 0,
            end: 6,
            text: "8^-1#5"
        }
    ]);
    assert_tokenize("1#0123", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 1,
            exponent: 0,
            significand: 0,
            start: 0,
            end: 3,
            text: "1#0"
        },
        {
            kind: "number",
            line: 1,
            column: 4,
            base: 10,
            exponent: 0,
            significand: 123,
            start: 3,
            end: 6,
            text: "123"
        }
    ]);
    assert_tokenize("2#0123", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 2,
            exponent: 0,
            significand: 1,
            start: 0,
            end: 4,
            text: "2#01"
        },
        {
            kind: "number",
            line: 1,
            column: 5,
            base: 10,
            exponent: 0,
            significand: 23,
            start: 4,
            end: 6,
            text: "23"
        }
    ]);
    assert_tokenize("8#0123456789", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 8,
            exponent: 0,
            significand: 342391,
            start: 0,
            end: 10,
            text: "8#01234567"
        },
        {
            kind: "number",
            line: 1,
            column: 11,
            base: 10,
            exponent: 0,
            significand: 89,
            start: 10,
            end: 12,
            text: "89"
        }
    ]);
    assert_tokenize("0123456789AbCdEfG", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: 0,
            significand: 123456789,
            start: 0,
            end: 10,
            text: "0123456789"
        },
        {
            kind: "name",
            line: 1,
            column: 11,
            start: 10,
            end: 17,
            text: "AbCdEfG"
        }
    ]);
    assert_tokenize("10#0123456789AbCdEfG", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 10,
            exponent: 0,
            significand: 123456789,
            start: 0,
            end: 13,
            text: "10#0123456789"
        },
        {
            kind: "name",
            line: 1,
            column: 14,
            start: 13,
            end: 20,
            text: "AbCdEfG"
        }
    ]);
    assert_tokenize("16#0123456789AbCdEfG", [
        {
            kind: "number",
            line: 1,
            column: 1,
            base: 16,
            exponent: 0,
            significand: 81985529216486895,
            start: 0,
            end: 19,
            text: "16#0123456789AbCdEf"
        },
        {
            kind: "name",
            line: 1,
            column: 20,
            start: 19,
            end: 20,
            text: "G"
        }
    ]);

    // assert_tokenize("\nexport[]", [
    //     {
    //         kind: "line",
    //         first: 0,
    //         last: 8,
    //         start: 0,
    //         end: 8,
    //         line: 1,
    //         column: 1,
    //         text: "export[]"
    //     }
    // ]);
    assert_tokenize(
`boot:  // {} <- {dev_caps}
    let debug_dev be @.debug
    send {"answer": 42} to debug_dev

export[boot]`, []);
/*[
    {"kind":"name","line":1,"column":1,"indentation":0,"start":0,"end":4,"text":"boot"},
    {"kind":"operator","line":1,"column":5,"start":4,"end":5,"text":":"},
    {"kind":"space","line":1,"column":6,"start":5,"end":7,"text":"  "},
    {"kind":"comment","line":1,"column":8,"start":7,"end":26,"text":"// {} <- {dev_caps}"},
    {"kind":"newline","line":1,"column":27,"start":26,"end":27,"text":"\n"},
    {"kind":"space","line":2,"column":1,"indent":1,"indentation":4,"start":27,"end":31,"text":"    "},
    {"kind":"name","line":2,"column":5,"start":31,"end":34,"text":"let"},
    {"kind":"space","line":2,"column":8,"start":34,"end":35,"text":" "},
    {"kind":"name","line":2,"column":9,"start":35,"end":44,"text":"debug_dev"},
    {"kind":"space","line":2,"column":18,"start":44,"end":45,"text":" "},
    {"kind":"name","line":2,"column":19,"start":45,"end":47,"text":"be"},
    {"kind":"space","line":2,"column":21,"start":47,"end":48,"text":" "},
    {"kind":"literal","line":2,"column":22,"start":48,"end":49,"text":"@"},
    {"kind":"operator","line":2,"column":23,"start":49,"end":50,"text":"."},
    {"kind":"name","line":2,"column":24,"start":50,"end":55,"text":"debug"},
    {"kind":"newline","line":2,"column":29,"start":55,"end":56,"text":"\n"},
    {"kind":"space","line":3,"column":1,"indentation":4,"start":56,"end":60,"text":"    "},
    {"kind":"name","line":3,"column":5,"start":60,"end":64,"text":"send"},
    {"kind":"space","line":3,"column":9,"start":64,"end":65,"text":" "},
    {"kind":"operator","line":3,"column":10,"start":65,"end":66,"text":"{"},
    {"kind":"text","line":3,"column":11,"start":66,"end":74,"text":"\"answer\""},
    {"kind":"operator","line":3,"column":19,"start":74,"end":75,"text":":"},
    {"kind":"space","line":3,"column":20,"start":75,"end":76,"text":" "},
    {"kind":"number","line":3,"column":21,"base":10,"exponent":0,"significand":42,"start":76,"end":78,"text":"42"},
    {"kind":"operator","line":3,"column":23,"start":78,"end":79,"text":"}"},
    {"kind":"space","line":3,"column":24,"start":79,"end":80,"text":" "},
    {"kind":"name","line":3,"column":25,"start":80,"end":82,"text":"to"},
    {"kind":"space","line":3,"column":27,"start":82,"end":83,"text":" "},
    {"kind":"name","line":3,"column":28,"start":83,"end":92,"text":"debug_dev"},
    {"kind":"newline","line":3,"column":37,"start":92,"end":93,"text":"\n"},
    {"kind":"newline","line":4,"column":1,"start":93,"end":94,"text":"\n"},
    {"kind":"name","line":5,"column":1,"dedent":1,"indentation":0,"start":94,"end":100,"text":"export"},
    {"kind":"operator","line":5,"column":7,"start":100,"end":101,"text":"["},
    {"kind":"name","line":5,"column":8,"start":101,"end":105,"text":"boot"},
    {"kind":"operator","line":5,"column":12,"start":105,"end":106,"text":"]"}
]*/
}

function parse(text, src) {
    const ast = {};

    const tokens = tokenize(text, src);
    ast.tokens = tokens;
    return ast;
}

// function compile_json(text, src) {
//     try {
//         return JSON.parse(text);
//     } catch (exception) {
//         return {
//             lang: "uFork",
//             ast: {
//                 kind: "module",
//                 import: {},
//                 define: {},
//                 export: []
//             },
//             tokens: [],
//             errors: [{
//                 kind: "error",
//                 code: "bad_json",
//                 message: exception.message,
//                 start: 0,
//                 end: 0,
//                 line: 1,
//                 column: 1,
//                 src
//             }]
//         };
//     }
// }

function compile(text, src) {
    const import_map = {};
    const module_env = {};
    const export_list = [];
    const errors = [];

    const ast = parse(text, src);
    return {
        lang: "uFork",
        ast: {
            kind: "module",
            import: import_map,
            define: module_env,
            export: export_list
        },
        tokens: ast.tokens,
        errors
    };
}

if (import.meta.main) {
    test_tokenize();
    // test_parse();
    // test_compile();
}

export default Object.freeze({tokenize, parse, compile});
