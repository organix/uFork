//
// Director - An Actor Scripting Language
//

/*jslint global */

// Decimal | Hex   | Char. | Usage
// --------+-------+-------+------------------------
// 48-57   | 30-39 | 0 - 9 | decimal digit
// 65-90   | 41-5A | A - Z | uppercase letter
// 95      | 5F    | _     | letter/digit separator
// 97-122  | 61-7A | a - z | lowercase letter

function is_digit(code) {
    return (48 <= code) && (code <= 57);
}

function is_letter(code) {
    return ((65 <= code) && (code <= 90))
        || ((97 <= code) && (code <= 122));
}

function is_name_head(code) {
    return is_letter(code) || (code === 95);
}

function is_name_tail(code) {
    return is_letter(code) || is_digit(code) || (code === 95);
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
    "Null",
    "?"
];

function parse(text, src) {
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

    function error(reason) {
        token.kind = "error";
        token.reason = reason;
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

    function number() {
        token.kind = "number";
        while (true) {
            advance();
            if (!is_digit(code) && (char !== "_")) {
                break;
            }
        }
    }

    function minus() {
        advance();
        if (is_digit(code)) {
            return number();
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
        "-": minus,
        "+": operator,
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

function assert_parse(text, tokens) {
    let expect = JSON.stringify(tokens);
    let actual = JSON.stringify(parse(text));
    if (actual !== expect) {
        throw new Error("Expect: " + expect + ", Actual: " + actual);
    }
}

function test_parse() {
    assert_parse("", []);
    assert_parse(" ", [
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
    assert_parse("  ", [
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
    assert_parse("    ", [
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
    assert_parse("     ", [
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
    assert_parse("//", [
        {
            kind: "comment",
            line: 1,
            column: 1,
            start: 0,
            end: 2,
            text: "//"
        }
    ]);
    assert_parse(" //", [
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
    assert_parse("// ", [
        {
            kind: "comment",
            line: 1,
            column: 1,
            start: 0,
            end: 3,
            text: "// "
        }
    ]);
    assert_parse("// \r\n", [
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
    // assert_parse("\nexport[]", [
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
    assert_parse(`
boot:  // {} <- {dev_caps}
    let debug_dev be @.debug
    send {"answer": 42} to debug_dev

export[boot]
`, []);
/*[
    {"kind":"newline","line":1,"column":1,"start":0,"end":1,"text":"\n"},
    {"kind":"name","line":2,"column":1,"indentation":0,"start":1,"end":5,"text":"boot"},
    {"kind":"operator","line":2,"column":5,"start":5,"end":6,"text":":"},
    {"kind":"space","line":2,"column":6,"start":6,"end":8,"text":"  "},
    {"kind":"comment","line":2,"column":8,"start":8,"end":27,"text":"// {} <- {dev_caps}"},
    {"kind":"newline","line":2,"column":27,"start":27,"end":28,"text":"\n"},
    {"kind":"space","line":3,"column":1,"indent":1,"indentation":4,"start":28,"end":32,"text":"    "},
    {"kind":"name","line":3,"column":5,"start":32,"end":35,"text":"let"},
    {"kind":"space","line":3,"column":8,"start":35,"end":36,"text":" "},
    {"kind":"name","line":3,"column":9,"start":36,"end":45,"text":"debug_dev"},
    {"kind":"space","line":3,"column":18,"start":45,"end":46,"text":" "},
    {"kind":"name","line":3,"column":19,"start":46,"end":48,"text":"be"},
    {"kind":"space","line":3,"column":21,"start":48,"end":49,"text":" "},
    {"kind":"literal","line":3,"column":22,"start":49,"end":50,"text":"@"},
    {"kind":"operator","line":3,"column":23,"start":50,"end":51,"text":"."},
    {"kind":"name","line":3,"column":24,"start":51,"end":56,"text":"debug"},
    {"kind":"newline","line":3,"column":29,"start":56,"end":57,"text":"\n"},
    {"kind":"space","line":4,"column":1,"indentation":4,"start":57,"end":61,"text":"    "},
    {"kind":"name","line":4,"column":5,"start":61,"end":65,"text":"send"},
    {"kind":"space","line":4,"column":9,"start":65,"end":66,"text":" "},
    {"kind":"operator","line":4,"column":10,"start":66,"end":67,"text":"{"},
    {"kind":"text","line":4,"column":11,"start":67,"end":75,"text":"\"answer\""},
    {"kind":"operator","line":4,"column":19,"start":75,"end":76,"text":":"},
    {"kind":"space","line":4,"column":20,"start":76,"end":77,"text":" "},
    {"kind":"number","line":4,"column":21,"start":77,"end":79,"text":"42"},
    {"kind":"operator","line":4,"column":23,"start":79,"end":80,"text":"}"},
    {"kind":"space","line":4,"column":24,"start":80,"end":81,"text":" "},
    {"kind":"name","line":4,"column":25,"start":81,"end":83,"text":"to"},
    {"kind":"space","line":4,"column":27,"start":83,"end":84,"text":" "},
    {"kind":"name","line":4,"column":28,"start":84,"end":93,"text":"debug_dev"},
    {"kind":"newline","line":4,"column":37,"start":93,"end":94,"text":"\n"},
    {"kind":"newline","line":5,"column":1,"start":94,"end":95,"text":"\n"},
    {"kind":"name","line":6,"column":1,"dedent":1,"indentation":0,"start":95,"end":101,"text":"export"},
    {"kind":"operator","line":6,"column":7,"start":101,"end":102,"text":"["},
    {"kind":"name","line":6,"column":8,"start":102,"end":106,"text":"boot"},
    {"kind":"operator","line":6,"column":12,"start":106,"end":107,"text":"]"},
    {"kind":"newline","line":6,"column":13,"start":107,"end":108,"text":"\n"}
]*/
}

function compile_json(text, src) {
    try {
        return JSON.parse(text);
    } catch (exception) {
        return {
            lang: "uFork",
            ast: {
                kind: "module",
                import: {},
                define: {},
                export: []
            },
            tokens: [],
            errors: [{
                kind: "error",
                code: "bad_json",
                message: exception.message,
                start: 0,
                end: 0,
                line: 1,
                column: 1,
                src
            }]
        };
    }
}

function compile(text, src) {
    const import_map = {};
    const module_env = {};
    const export_list = [];
    const errors = [];

    const tokens = parse(text, src);
    return {
        lang: "uFork",
        ast: {
            kind: "module",
            import: import_map,
            define: module_env,
            export: export_list
        },
        tokens,
        errors
    };
}

if (import.meta.main) {
    test_parse();
    // test_compile();
}

export default Object.freeze({parse, compile});
