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

    function next_char() {
        code = text.codePointAt(end);
        if (code === undefined) {
            return undefined;
        }
        if (code <= 0xFFFF) {
            end += 1;
        } else {
            end += 2;  // surrogate pair
        }
        char = String.fromCodePoint(code);
        return char;
    }

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
            if (char === "\n") {
                line += 1;
                column = 1;
            }
        }
        return peek();
    }

    function error(reason) {
        token.kind = "error";
        token.reason = reason;
        advance();
    }

    function space() {
        token.kind = "space";
        while (true) {
            if (advance() !== " ") {
                break;
            }
        }
        const depth = end - start;
        if (token.column === 1) {
            if (depth > indentation) {
                token.indent = 0;
                while (depth > indentation) {
                    token.indent += 1;
                    indentation += 4;
                }
            } else if (depth > indentation) {
                token.dedent = 0;
                while (depth < indentation) {
                    token.dedent += 1;
                    indentation -= 4;
                }
            }
            token.indentation = indentation;
        }
    }

    function newline() {
        error("newline");
    }

    function carriage_return() {
        error("carriage_return");
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

    const handlers = {
        " ": space,
        "\n": newline,
        "\r": carriage_return,
        "/": solidus,
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
    // assert_parse(" //", [
    //     {
    //         kind: "line",
    //         comment: 3,
    //         start: 0,
    //         end: 3,
    //         line: 1,
    //         column: 1,
    //         text: " //"
    //     }
    // ]);
    // assert_parse("// ", [
    //     {
    //         kind: "line",
    //         comment: 2,
    //         start: 0,
    //         end: 3,
    //         line: 1,
    //         column: 1,
    //         text: "// "
    //     }
    // ]);
    assert_parse("\nexport[]", [
        {
            kind: "line",
            first: 0,
            last: 8,
            start: 0,
            end: 8,
            line: 1,
            column: 1,
            text: "export[]"
        }
    ]);
    assert_parse(`
boot: // {} <- {dev_caps}
    let debug_dev be @.debug
    send {"answer": 42} to debug_dev

export[boot]
`, []);
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
