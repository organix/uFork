//
// Director - An Actor Scripting Language
//

/*jslint global */

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
        track_indentation();
    }

    function carriage_return() {
        token.kind = "newline";
        if (advance() === "\n") {
            advance();
        }
        line += 1;
        column = 1;
        track_indentation();
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

    function solidus() {
        if (advance() === "/") {
            return comment();
        }
        token.kind = "operator";
    }

    function question_mark() {
        error("question_mark");
    }

    const handlers = {
        " ": space,
        "\n": newline,
        "\r": carriage_return,
        "/": solidus,
        "?": question_mark,
        "\t": error
    };
    function dispatch() {
        let handler = handlers[char];
        if (typeof handler === "function") {
            return handler();
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
    {"kind":"error","line":2,"column":1,"start":1,"end":2,"text":"b"},
    {"kind":"error","line":2,"column":2,"start":2,"end":3,"text":"o"},
    {"kind":"error","line":2,"column":3,"start":3,"end":4,"text":"o"},
    {"kind":"error","line":2,"column":4,"start":4,"end":5,"text":"t"},
    {"kind":"error","line":2,"column":5,"start":5,"end":6,"text":":"},
    {"kind":"space","line":2,"column":6,"start":6,"end":8,"text":"  "},
    {"kind":"comment","line":2,"column":8,"start":8,"end":27,"text":"// {} <- {dev_caps}"},
    {"kind":"newline","line":2,"column":27,"start":27,"end":28,"text":"\n"},
    {"kind":"space","line":3,"column":1,"indent":1,"indentation":4,"start":28,"end":32,"text":"    "},
    {"kind":"error","line":3,"column":5,"start":32,"end":33,"text":"l"},
    {"kind":"error","line":3,"column":6,"start":33,"end":34,"text":"e"},
    {"kind":"error","line":3,"column":7,"start":34,"end":35,"text":"t"},
    {"kind":"space","line":3,"column":8,"start":35,"end":36,"text":" "},
    {"kind":"error","line":3,"column":9,"start":36,"end":37,"text":"d"},
    {"kind":"error","line":3,"column":10,"start":37,"end":38,"text":"e"},
    {"kind":"error","line":3,"column":11,"start":38,"end":39,"text":"b"},
    {"kind":"error","line":3,"column":12,"start":39,"end":40,"text":"u"},
    {"kind":"error","line":3,"column":13,"start":40,"end":41,"text":"g"},
    {"kind":"error","line":3,"column":14,"start":41,"end":42,"text":"_"},
    {"kind":"error","line":3,"column":15,"start":42,"end":43,"text":"d"},
    {"kind":"error","line":3,"column":16,"start":43,"end":44,"text":"e"},
    {"kind":"error","line":3,"column":17,"start":44,"end":45,"text":"v"},
    {"kind":"space","line":3,"column":18,"start":45,"end":46,"text":" "},
    {"kind":"error","line":3,"column":19,"start":46,"end":47,"text":"b"},
    {"kind":"error","line":3,"column":20,"start":47,"end":48,"text":"e"},
    {"kind":"space","line":3,"column":21,"start":48,"end":49,"text":" "},
    {"kind":"error","line":3,"column":22,"start":49,"end":50,"text":"@"},
    {"kind":"error","line":3,"column":23,"start":50,"end":51,"text":"."},
    {"kind":"error","line":3,"column":24,"start":51,"end":52,"text":"d"},
    {"kind":"error","line":3,"column":25,"start":52,"end":53,"text":"e"},
    {"kind":"error","line":3,"column":26,"start":53,"end":54,"text":"b"},
    {"kind":"error","line":3,"column":27,"start":54,"end":55,"text":"u"},
    {"kind":"error","line":3,"column":28,"start":55,"end":56,"text":"g"},
    {"kind":"newline","line":3,"column":29,"start":56,"end":57,"text":"\n"},
    {"kind":"space","line":4,"column":1,"indentation":4,"start":57,"end":61,"text":"    "},
    {"kind":"error","line":4,"column":5,"start":61,"end":62,"text":"s"},
    {"kind":"error","line":4,"column":6,"start":62,"end":63,"text":"e"},
    {"kind":"error","line":4,"column":7,"start":63,"end":64,"text":"n"},
    {"kind":"error","line":4,"column":8,"start":64,"end":65,"text":"d"},
    {"kind":"space","line":4,"column":9,"start":65,"end":66,"text":" "},
    {"kind":"error","line":4,"column":10,"start":66,"end":67,"text":"{"},
    {"kind":"error","line":4,"column":11,"start":67,"end":68,"text":"\""},
    {"kind":"error","line":4,"column":12,"start":68,"end":69,"text":"a"},
    {"kind":"error","line":4,"column":13,"start":69,"end":70,"text":"n"},
    {"kind":"error","line":4,"column":14,"start":70,"end":71,"text":"s"},
    {"kind":"error","line":4,"column":15,"start":71,"end":72,"text":"w"},
    {"kind":"error","line":4,"column":16,"start":72,"end":73,"text":"e"},
    {"kind":"error","line":4,"column":17,"start":73,"end":74,"text":"r"},
    {"kind":"error","line":4,"column":18,"start":74,"end":75,"text":"\""},
    {"kind":"error","line":4,"column":19,"start":75,"end":76,"text":":"},
    {"kind":"space","line":4,"column":20,"start":76,"end":77,"text":" "},
    {"kind":"error","line":4,"column":21,"start":77,"end":78,"text":"4"},
    {"kind":"error","line":4,"column":22,"start":78,"end":79,"text":"2"},
    {"kind":"error","line":4,"column":23,"start":79,"end":80,"text":"}"},
    {"kind":"space","line":4,"column":24,"start":80,"end":81,"text":" "},
    {"kind":"error","line":4,"column":25,"start":81,"end":82,"text":"t"},
    {"kind":"error","line":4,"column":26,"start":82,"end":83,"text":"o"},
    {"kind":"space","line":4,"column":27,"start":83,"end":84,"text":" "},
    {"kind":"error","line":4,"column":28,"start":84,"end":85,"text":"d"},
    {"kind":"error","line":4,"column":29,"start":85,"end":86,"text":"e"},
    {"kind":"error","line":4,"column":30,"start":86,"end":87,"text":"b"},
    {"kind":"error","line":4,"column":31,"start":87,"end":88,"text":"u"},
    {"kind":"error","line":4,"column":32,"start":88,"end":89,"text":"g"},
    {"kind":"error","line":4,"column":33,"start":89,"end":90,"text":"_"},
    {"kind":"error","line":4,"column":34,"start":90,"end":91,"text":"d"},
    {"kind":"error","line":4,"column":35,"start":91,"end":92,"text":"e"},
    {"kind":"error","line":4,"column":36,"start":92,"end":93,"text":"v"},
    {"kind":"newline","line":4,"column":37,"start":93,"end":94,"text":"\n"},
    {"kind":"newline","line":5,"column":1,"start":94,"end":95,"text":"\n"},
    {"kind":"newline","line":5,"column":1,"dedent":1,"indentation":0,"start":94,"end":95,"text":"\n"},
    {"kind":"error","line":6,"column":1,"start":95,"end":96,"text":"e"},
    {"kind":"error","line":6,"column":2,"start":96,"end":97,"text":"x"},
    {"kind":"error","line":6,"column":3,"start":97,"end":98,"text":"p"},
    {"kind":"error","line":6,"column":4,"start":98,"end":99,"text":"o"},
    {"kind":"error","line":6,"column":5,"start":99,"end":100,"text":"r"},
    {"kind":"error","line":6,"column":6,"start":100,"end":101,"text":"t"},
    {"kind":"error","line":6,"column":7,"start":101,"end":102,"text":"["},
    {"kind":"error","line":6,"column":8,"start":102,"end":103,"text":"b"},
    {"kind":"error","line":6,"column":9,"start":103,"end":104,"text":"o"},
    {"kind":"error","line":6,"column":10,"start":104,"end":105,"text":"o"},
    {"kind":"error","line":6,"column":11,"start":105,"end":106,"text":"t"},
    {"kind":"error","line":6,"column":12,"start":106,"end":107,"text":"]"},
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
