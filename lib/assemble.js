// uFork assembler.

// Parses uFork assembly source into uFork's intermediate representation.
// See ir.md.

/*jslint global */

// Tokenizer ///////////////////////////////////////////////////////////////////

// Transforms the source text of an assembly module into tokens. The 'tokenize'
// function returns a generator function that returns the next token.

// A token is an object. All tokens have a "kind" property, one of:

//      "."
//      ":"
//      "comment"
//      "end of file"
//      "error"
//      "literal"
//      "name"
//      "newline"
//      "number"
//      "space"
//      "string"

// All tokens have "start" and "end" properties that indicate the range of
// the token in the source text.

// Unrecognized characters are produced as "error" tokens and skipped.

function tag_regexp(strings) {

// A tag function that creates a RegExp from a template literal string. Any
// whitespace in the string is ignored, and so can be injected into the pattern
// to improve readability.

    return new RegExp(strings.raw[0].replace(/\s/g, ""), "");
}

function linecol(string) {

// Precompute line and column numbers for each character in a string.
// Everything is numbered from zero. We should really be counting by Unicode
// glyphs, not UTF-16 characters.

    let line = 0;
    let column = 0;
    return string.split("").map(function (character) {
        const coordinates = {line, column, character};
        if (character === "\n") {
            line += 1;
            column = 0;
        } else {
            column += 1;
        }
        return coordinates;
    });
}

// linecol(`
// abc
// def
//     here I am!
// `);

const rx_token_raw = tag_regexp `
    (
        \n
      | \r \n?
    )
  | ( \u0020* ; .* )
  | ( \u0020+ )
  | (
        [ a-z A-Z ]
        (?:
            [ \- _ ]? [ 0-9 a-z A-Z ]
        )*
    )
  | (
        #
        [ a-z _ ? ]+
    )
  | (
        0
      | -? [ 1-9 ] \d* (?: # [ a-z A-Z \d ]+ )?
    )
  | (
        "
        [ ^ " \n \r ]*
        "
    )
  | (
        [ \. : ]
    )
  | (
        '
        (?:
            \\ [ \\ ' b t n r ]
          | [ ^ \\ ' \n \r ]
        )
        '
    )
  | (
        .
    )
`;

// Capturing groups:
//  [1] Newline
//  [2] Comment
//  [3] Whitespace
//  [4] Name
//  [5] Literal
//  [6] Fixnum
//  [7] String
//  [8] Punctuator
//  [9] Character
//  [10] Other

const escape_code_points = {
    "\\": 0x5C,
    "'": 0x27,
    "b": 0x08,
    "t": 0x09,
    "n": 0x0A,
    "r": 0x0D
};

function tokenize(text) {
    let rx_token = new RegExp(rx_token_raw, "yu"); // sticky, unicode aware
    let position = 0;
    let linecols = linecol(text);
    return function token_generator() {
        if (rx_token.lastIndex >= text.length) {
            const end_coordinates = (
                linecols[linecols.length - 1] ?? {line: 0, column: 0}
            );
            return {
                kind: "end of file",
                start: position,
                end: position,
                line: end_coordinates.line + 1,
                column: end_coordinates.column + 1
            };
        }
        const coordinates = linecols[position];
        const line = coordinates.line + 1;
        const column = coordinates.column + 1;
        let captives = rx_token.exec(text);

// The following code is incorrect. The "start" and "end" positions should be
// measured in Unicode code points, because the intermediate representation is
// intended to be language independent. For now, for a simple implementation,
// we count UTF-16 character codes instead.

        const start = position;
        const end = position + captives[0].length;
        position = end;
        if (captives[1]) {
            return {
                kind: "newline",
                start,
                end,
                line,
                column
            };
        }
        if (captives[2]) {
            return {
                kind: "comment",
                text: captives[2].slice(
                    captives[2].indexOf(";") + 1
                ),
                start,
                end,
                line,
                column
            };
        }
        if (captives[3]) {
            return {
                kind: "space",
                start,
                end,
                line,
                column
            };
        }
        if (captives[4]) {
            return {
                kind: "name",
                text: captives[4],
                start,
                end,
                line,
                column
            };
        }
        if (captives[5]) {
            return {
                kind: "literal",
                text: captives[5],
                start,
                end,
                line,
                column
            };
        }
        if (captives[6]) {
            let [base, digits] = captives[6].split("#");
            if (digits === undefined) {
                digits = base;
                base = 10;
            }
            if (base < 0) {
                return {
                    kind: "error",
                    text: captives[6],
                    start,
                    end,
                    line,
                    column
                };
            }
            const number = parseInt(digits, base);
            return (
                Number.isSafeInteger(number)
                ? {
                    kind: "number",
                    number,
                    text: captives[6],
                    start,
                    end,
                    line,
                    column
                }
                : {
                    kind: "error",
                    text: captives[6],
                    start,
                    end,
                    line,
                    column
                }
            );
        }
        if (captives[7]) {
            return {
                kind: "string",
                text: captives[7].slice(1, -1),
                start,
                end,
                line,
                column
            };
        }
        if (captives[8]) {
            return {
                kind: captives[8],
                start,
                end,
                line,
                column
            };
        }
        if (captives[9]) {
            const character = captives[9].slice(1, -1);
            const code_point = (
                character.startsWith("\\")
                ? escape_code_points[character[1]]
                : character.codePointAt(0)
            );
            return (
                Number.isSafeInteger(code_point)
                ? {
                    kind: "number",
                    number: code_point,
                    text: character,
                    start,
                    end,
                    line,
                    column
                }
                : {
                    kind: "error",
                    text: captives[9],
                    start,
                    end,
                    line,
                    column
                }
            );
        }
        if (captives[10]) {
            return {
                kind: "error",
                text: captives[10],
                start,
                end,
                line,
                column
            };
        }
    };
}

function test_tokenizer() {
    const cases = Object.create(null);
    cases["123"] = [{
        kind: "number",
        number: 123,
        text: "123",
        start: 0,
        end: 3
    }];
    cases["16#DEAF123"] = [{
        kind: "number",
        number: 233500963,
        text: "16#DEAF123",
        start: 0,
        end: 10
    }];
    cases["-8#555"] = [{
        kind: "error",
        text: "-8#555",
        start: 0,
        end: 6
    }];
    cases["#?"] = [{
        kind: "literal",
        text: "#?",
        start: 0,
        end: 2
    }];
    cases["#actor_t"] = [{
        kind: "literal",
        text: "#actor_t",
        start: 0,
        end: 8
    }];
    cases[": \"unterm ;stuff"] = [
        {kind: ":", start: 0, end: 1},
        {kind: "space", start: 1, end: 2},
        {kind: "error", text: "\"", start: 2, end: 3},
        {kind: "name", text: "unterm", start: 3, end: 9},
        {kind: "comment", text: "stuff", start: 9, end: 16}
    ];
    cases["\"stu\"ff\""] = [
        {kind: "string", text: "stu", start: 0, end: 5},
        {kind: "name", text: "ff", start: 5, end: 7},
        {kind: "error", text: "\"", start: 7, end: 8}
    ];
    cases["😀"] = [
        {kind: "error", text: "😀", start: 0, end: 2}
    ];
    cases["\"😀\""] = [
        {kind: "string", text: "😀", start: 0, end: 4}
    ];
    cases["'\\t'"] = [
        {kind: "number", number: 9, text: "\\t", start: 0, end: 4}
    ];
    cases["'😀'"] = [
        {kind: "number", number: 128512, text: "😀", start: 0, end: 4}
    ];
    cases["'\n'"] = [
        {kind: "error", text: "'", start: 0, end: 1},
        {kind: "newline", start: 1, end: 2},
        {kind: "error", text: "'", start: 2, end: 3}
    ];
    Object.entries(cases).forEach(function ([text, expected_tokens]) {
        let generator = tokenize(text);
        let actual_tokens = [];
        while (true) {
            const value = generator();
            if (value.kind === "end of file") {
                break;
            }
            delete value.line;
            delete value.column;
            actual_tokens.push(value);
        }
        if (
            JSON.stringify(actual_tokens)
            !== JSON.stringify(expected_tokens)
        ) {
            throw new Error(
                "Bad tokens: "
                + text
                + " ("
                + JSON.stringify(actual_tokens, undefined, 4)
                + ")"
            );
        }
    });
}

// Parser //////////////////////////////////////////////////////////////////////

// Parses a sequence of tokens into IR.

// This parser is fault-tolerant. It attempts to provide useful information even
// for invalid source code.

// The parser's source code is heavily inspired by, and in places lifted
// verbatim from, Douglas Crockford's Misty parser. See https://mistysystem.com.

const error_bundle = {
    already_a: "{a} was already declared.",
    expected_b_a: "Expected {b} and saw {a}.",
    expected_instruction: "Expected an instruction, not data.",
    exports_last: "Exports come last.",
    imports_first: "Imports come first.",
    maximum_a_b: "Expected {b} or less.",
    minimum_a_b: "Expected {b} or more.",
    unexpected_a: "Unexpected {a}.",
    undefined_a: "{a} was not defined.",
    unterminated: "Unterminated string."
};
const sub_operators = {
    alu: [
        "not", "and", "or", "xor", "add", "sub", "mul", "div", "lsl", "lsr",
        "asr", "rol", "ror"
    ],
    cmp: ["eq", "ge", "gt", "lt", "le", "ne"],
    dict: ["has", "get", "add", "set", "del"],
    deque: ["new", "empty", "push", "pop", "put", "pull", "len"],
    actor: ["send", "post", "create", "become", "self"],
    sponsor: ["new", "memory", "events", "cycles", "reclaim", "start", "stop"],
    end: ["abort", "stop", "commit"],
    my: ["self"] // deprecated
};
const actor_op_map = {
    send: "send",
    signal: "post",
    new: "create",
    beh: "become"
};

function singular(kind) {
    return (
        kind === "literal"
        || kind === "name"
        || kind === "newline"
        || kind === "number"
        || kind === "space"
        || kind === "string"
    );
}

function error_term(token) {
    if (token.kind.length === 1) {
        return "\"" + token.kind + "\"";
    }
    if (
        token.kind === "name"
        || token.kind === "number"
        || token.kind === "literal"
        || token.kind === "error"
    ) {
        return "\"" + token.text + "\"";
    }
    return token.kind;
}

function stringify_enum(array) {
    array = array.slice(0, -1).concat("or " + array[array.length - 1]);
    return array.join(", ");
}

function parse(generate_token, src) {
    let define_object = Object.create(null);
    let export_array = [];
    let errors = [];
    let import_object = Object.create(null);
    let next_token;
    let previous_token;
    let supposed_instructions = [];
    let supposed_local_refs = [];
    let supposed_types = [];
    let token;
    let tokens = [];

    function maybe_kind(node, kind) {
        return (
            node.kind === "ref"
            ? (
                (
                    node.module === undefined
                    && define_object[node.name] !== undefined
                )
                ? maybe_kind(define_object[node.name], kind)
                : true // external
            )
            : node.kind === kind
        );
    }

    function error(code, token, b) {
        const a = error_term(token);
        let the_error = {
            kind: "error",
            code,
            message: error_bundle[code].replace("{a}", a).replace("{b}", b),
            start: token.start,
            end: token.end,
            line: token.line,
            column: token.column
        };
        if (a !== undefined) {
            the_error.a = a;
        }
        if (b !== undefined) {
            the_error.b = b;
        }
        if (src !== undefined) {
            the_error.src = src;
        }
        errors.push(the_error);
    }

    function advance(value) {
        if (value !== undefined && token.kind !== value) {
            error("expected_b_a", token, (
                singular(value)
                ? "a " + value
                : "\"" + value + "\""
            ));
            throw "advance";
        }
        previous_token = token;
        token = next_token;
        let unterminated_string = false;
        while (true) {
            next_token = generate_token();
            if (next_token.kind === "end of file") {
                break;
            }
            tokens.push(next_token);
            if (unterminated_string) {

// We are inside an unterminated string literal. Discard tokens until we reach
// the end of the line.

                if (next_token.kind === "newline") {
                    break;
                }
                next_token.context = "string";
            } else if (
                next_token.kind === "error"
                && next_token.text === "\""
            ) {

// Skip over the contents of unterminated string literals.

                next_token.context = "string";
                error("unterminated", next_token);
                unterminated_string = true;
            } else if (next_token.kind === "newline" && token !== undefined) {

// Skip over spaces or newlines that are followed by a newline.

                if (token.kind === "newline" || token.kind === "space") {
                    token = next_token;
                } else {
                    break;
                }
            } else if (next_token.kind !== "comment") {

// Skip over comments.

                break;
            }
        }
        return previous_token;
    }

    function skip_line() {
        if (token.kind !== "newline" && token.kind !== "end of file") {
            advance();
            return skip_line();
        }
    }

    function name() {
        return (
            token.kind === "string"
            ? advance("string")
            : advance("name")
        );
    }

    function importation() {
        try {
            advance("newline");
            advance("space");
            const name_token = name();
            if (name_token.kind === "name") {
                name_token.context = "namespace";
            }
            if (import_object[name_token.text] !== undefined) {
                error("already_a", name_token);
            }
            advance(":");
            if (token.kind === "space") {
                advance("space");
            } else {
                error("expected_b_a", token, "a space");
            }
            const src_token = advance("string");
            import_object[name_token.text] = src_token.text;
        } catch (_) {
            skip_line();
        }
    }

    function imports() {
        const import_token = advance();
        import_token.context = "directive";
        if (Object.keys(define_object).length > 0) {
            error("imports_first", import_token);
        }
        if (Object.keys(import_object).length > 0) {
            error("already_a", import_token);
        }
        do {
            importation();
        } while (token.kind === "newline" && next_token.kind === "space");
        advance("newline");
    }

    function exportation() {
        try {
            advance("newline");
            advance("space");
            const name_token = name();
            if (export_array.includes(name_token.text)) {
                error("already_a", name_token);
            }
            supposed_local_refs.push(name_token);
            export_array.push(name_token.text);
        } catch (_) {
            skip_line();
        }
    }

    function exports() {
        const export_token = advance();
        export_token.context = "directive";
        if (Object.keys(export_array).length > 0) {
            error("already_a", export_token);
        }
        do {
            exportation();
        } while (token.kind === "newline" && next_token.kind === "space");
        advance("newline");
    }

    function fixnum(minimum, maximum) {
        const number_token = advance("number");
        if (minimum !== undefined && number_token.number < minimum) {
            error("minimum_a_b", number_token, minimum);
        }
        if (maximum !== undefined && number_token.number > maximum) {
            error("maximum_a_b", number_token, maximum);
        }
        return number_token.number;
    }

    function type_literal() {
        const literal_token = advance("literal");
        if (
            literal_token.text !== "#fixnum_t"
            && literal_token.text !== "#type_t"
            && literal_token.text !== "#pair_t"
            && literal_token.text !== "#dict_t"
            && literal_token.text !== "#instr_t"
            && literal_token.text !== "#actor_t"
        ) {
            error("expected_b_a", literal_token, "a type");
        }
        return {
            kind: "type",
            name: literal_token.text.slice(1, -2)
        };
    }

    function literal() {
        const literal_token = advance("literal");
        if (literal_token.text === "#?") {
            return {kind: "literal", value: "undef"};
        }
        if (literal_token.text === "#nil") {
            return {kind: "literal", value: "nil"};
        }
        if (literal_token.text === "#t") {
            return {kind: "literal", value: "true"};
        }
        if (literal_token.text === "#f") {
            return {kind: "literal", value: "false"};
        }
        return error("expected_b_a", literal_token, "a literal");
    }

    function local_ref(
        instruction_only = false,
        name_token = name()
    ) {
        supposed_local_refs.push(name_token);
        if (instruction_only) {
            supposed_instructions.push(name_token);
        }
        return {
            kind: "ref",
            name: name_token.text,
            debug: {
                src,
                start: name_token.start,
                end: name_token.end
            }
        };
    }

    function ref(instruction_only = false) {
        if (
            (token.kind === "string" || token.kind === "name")
            && next_token.kind === "."
        ) {
            const module_token = name();
            if (import_object[module_token.text] === undefined) {
                error("undefined_a", module_token);
            }
            if (module_token.kind === "name") {
                module_token.context = "namespace";
            }
            advance(".");
            const name_token = name();
            return {
                kind: "ref",
                module: module_token.text,
                name: name_token.text,
                debug: {
                    src,
                    start: module_token.start,
                    end: name_token.end
                }
            };
        }
        return local_ref(instruction_only);
    }

    function type() {
        if (token.kind === "literal") {
            return type_literal();
        }
        if (token.kind === "name" && next_token.kind !== ".") {
            supposed_types.push(token);
        }
        return ref();
    }

    function expression(instruction_only = false) {
        if (token.kind === "number") {
            if (instruction_only) {
                error("expected_instruction", token);
            }
            return fixnum();
        }
        if (token.kind === "literal") {
            if (instruction_only) {
                error("expected_instruction", token);
            }
            return (
                token.text.endsWith("_t")
                ? type_literal()
                : literal()
            );
        }
        if (token.kind === "name" || token.kind === "string") {
            return ref(instruction_only);
        }
        error("expected_b_a", token, "an expression");
        throw "expression";
    }

    function sub_operator(op_name) {
        const name_token = advance("name");
        if (sub_operators[op_name].includes(name_token.text)) {
            name_token.context = "operator";
        } else {
            error(
                "expected_b_a",
                name_token,
                stringify_enum(sub_operators[op_name])
            );
        }
        return name_token.text;
    }

    function operand() {
        advance("space");
        return expression();
    }

    function value(instruction_only = false) {
        if (token.kind !== "space") {

// Fall through to the common tail, if there is one.

            if (token.kind !== "name" && token.kind !== "string") {
                error("expected_b_a", token, "a label");
                return;
            }
            return local_ref(instruction_only, token);
        }
        advance("space");
        let name_token = advance("name");
        let debug = {
            src,
            start: name_token.start,
            end: name_token.end
        };

        function data_check() {
            if (instruction_only) {
                error("expected_instruction", name_token);
            }
        }

        function terminal_check() {
            if (token.kind === "space" && next_token.kind === "name") {
                error("unexpected_a", next_token);
            }
        }

        function continuation(instruction_only) {
            if (token.kind === "newline") {
                debug.end = previous_token.end;
                advance("newline");
                return value(instruction_only);
            }
            advance("space");
            const the_expression = expression(instruction_only);
            debug.end = previous_token.end;
            advance("newline");
            terminal_check();
            return the_expression;
        }

        const op = name_token.text;
        if (op === "type_t") {
            name_token.context = "data";
            data_check();
            advance("space");
            const arity = fixnum(0, 3);
            debug.end = previous_token.end;
            advance("newline");
            return {
                kind: "type",
                arity,
                debug
            };
        }
        if (op === "quad_1") {
            name_token.context = "data";
            data_check();
            return {
                kind: "quad",
                t: continuation(),
                debug
            };
        }
        if (op === "quad_2") {
            name_token.context = "data";
            data_check();
            return {
                kind: "quad",
                t: operand(),
                x: continuation(),
                debug
            };
        }
        if (op === "quad_3") {
            name_token.context = "data";
            data_check();
            return {
                kind: "quad",
                t: operand(),
                x: operand(),
                y: continuation(),
                debug
            };
        }
        if (op === "quad_4") {
            name_token.context = "data";
            data_check();
            return {
                kind: "quad",
                t: operand(),
                x: operand(),
                y: operand(),
                z: continuation(),
                debug
            };
        }
        if (op === "pair_t") {
            name_token.context = "data";
            data_check();
            return {
                kind: "pair",
                head: operand(),
                tail: continuation(),
                debug
            };
        }
        if (op === "dict_t") {
            name_token.context = "data";
            data_check();
            return {
                kind: "dict",
                key: operand(),
                value: operand(),
                next: continuation(),
                debug
            };
        }
        if (op === "ref") {
            name_token.context = "terminal";
            advance("space");
            const the_expression = expression(instruction_only);
            debug.end = previous_token.end;
            advance("newline");
            terminal_check();
            return the_expression;
        }

// The statement is an instruction. From here on in, the continuation stream
// must consist solely of instructions, and never data.

        if (op === "end") {
            name_token.context = "terminal";
            advance("space");
            const imm = sub_operator(op);
            debug.end = previous_token.end;
            advance("newline");
            terminal_check();
            return {
                kind: "instr",
                op: "end",
                imm,
                debug
            };
        }
        if (op === "jump" || op === "return") {
            name_token.context = "terminal";
            advance("newline");
            terminal_check();
            return {
                kind: "instr",
                op: "jump",
                debug
            };
        }
        if (op === "call") {
            name_token.context = "terminal";
            advance("space");
            return {
                kind: "instr",
                op: "push",
                k: ref(true),
                imm: continuation(true),
                debug
            };
        }
        if (op === "if") {
            name_token.context = "conditional";
            advance("space");
            return {
                kind: "instr",
                op: "if",
                t: ref(true),
                f: continuation(true),
                debug
            };
        }
        if (op === "if_not") {
            name_token.context = "conditional";
            advance("space");
            return {
                kind: "instr",
                op: "if",
                f: ref(true),
                t: continuation(true),
                debug
            };
        }
        if (op === "typeq") {
            name_token.context = "operator";
            advance("space");
            return {
                kind: "instr",
                op: "typeq",
                imm: type(),
                k: continuation(true),
                debug
            };
        }
        if (
            op === "quad"
            || op === "pair"
            || op === "part"
            || op === "nth"
            || op === "drop"
            || op === "pick"
            || op === "dup"
            || op === "roll"
            || op === "msg"
            || op === "state"
            || op === "signal"  // deprecated
            || op === "send"    // deprecated
            || op === "new"     // deprecated
            || op === "beh"     // deprecated
        ) {
            name_token.context = "operator";
            advance("space");
            const range = (
                op === "quad"
                ? {minimum: -4, maximum: 4}
                : (
                    (
                        op === "drop"
                        || op === "dup"
                        || op === "pair"
                        || op === "part"
                    )
                    ? {minimum: 0}
                    : (
                        (
                            op === "signal"
                            || op === "send"
                            || op === "new"
                            || op === "beh"
                        )
                        ? {minimum: -1}
                        : {}
                    )
                )
            );
            const n = fixnum(range.minimum, range.maximum);
            const actor_imm = actor_op_map[op];
            if (actor_imm === undefined) {
                return {
                    kind: "instr",
                    op,
                    imm: n,
                    k: continuation(true),
                    debug
                };
            }

// Emulate the deprecated send/signal/new/beh instructions, where possible.
// The -1 variants of send/signal/new/beh match the various actor immediates.

            if (n === -1) {
                return {
                    kind: "instr",
                    op: "actor",
                    imm: actor_imm,
                    k: continuation(true),
                    debug
                };
            }

// The zero-or-positive variants are more challenging. This is the polyfill in
// assembly:

//      ...             ; ... actor
//      roll -(n+1)     ; actor ...
//      push #nil       ; actor ... ()
//      roll -(n+1)     ; actor () ...
//      pair n          ; actor (...)
//      roll 2          ; (...) actor
//      actor send      ; --

            if (n >= 0) {
                return {
                    kind: "instr",
                    op: "roll",
                    imm: -(n + 1),
                    k: {
                        kind: "instr",
                        op: "push",
                        imm: {kind: "literal", value: "nil"},
                        k: {
                            kind: "instr",
                            op: "roll",
                            imm: -(n + 1),
                            k: {
                                kind: "instr",
                                op: "pair",
                                imm: n,
                                k: {
                                    kind: "instr",
                                    op: "roll",
                                    imm: 2,
                                    k: {
                                        kind: "instr",
                                        op: "actor",
                                        imm: actor_imm,
                                        k: continuation(true),
                                        debug
                                    },
                                    debug
                                },
                                debug
                            },
                            debug
                        },
                        debug
                    },
                    debug
                };
            }

// The -2 and -3 variants are gone forever.

            return error("unexpected_a", name_token);
        }
        if (
            op === "eq"
            || op === "push"
            || op === "assert"
        ) {
            name_token.context = "operator";
            advance("space");
            return {
                kind: "instr",
                op,
                imm: expression(),
                k: continuation(true),
                debug
            };
        }
        if (op === "debug") {
            name_token.context = "operator";
            return {
                kind: "instr",
                op: "debug",
                k: continuation(true),
                debug
            };
        }
        if (
            op === "dict"
            || op === "deque"
            || op === "alu"
            || op === "cmp"
            || op === "actor"
            || op === "sponsor"
        ) {
            name_token.context = "operator";
            advance("space");
            return {
                kind: "instr",
                op,
                imm: sub_operator(op),
                k: continuation(true),
                debug
            };
        }

// Assemble the deprecated 'my self' instruction as 'actor self'.

        if (op === "my") {
            advance("space");
            sub_operator("my");
            return {
                kind: "instr",
                op: "actor",
                imm: "self",
                k: continuation(true),
                debug
            };
        }
        error("unexpected_a", name_token);
        while (token.kind === "space") {
            operand();
        }
        skip_line();
    }

    function label(instruction_only) {
        const name_token = name();
        if (export_array.length > 0) {
            error("exports_last", name_token);
        }
        if (define_object[name_token.text] !== undefined) {
            error("already_a", name_token);
        }
        advance(":");
        advance("newline");
        if (token.kind === "name" || token.kind === "string") {

// The label is an alias for the following label.

            define_object[name_token.text] = {
                kind: "ref",
                name: token.text
            };
            return label(instruction_only);
        }
        define_object[name_token.text] = value(instruction_only);
        return define_object[name_token.text];
    }

    advance();
    advance();
    while (true) {
        try {
            if (token.kind === "newline") {
                advance("newline");
            } else if (token.kind === ".") {
                const period_token = advance(".");
                period_token.context = "directive";
                if (token.kind === "name" && token.text === "import") {
                    imports();
                } else if (token.kind === "name" && token.text === "export") {
                    exports();
                } else {
                    error("expected_b_a", token, "import or export");
                    skip_line();
                }
            } else if (token.kind === "string" || token.kind === "name") {
                label();
            } else if (token.kind === "space" && next_token.kind === "name") {

// This looks like a statement with no corresponding label. Parse it, but
// discard the value.

                if (Object.keys(define_object).length === 0) {
                    error("expected_b_a", next_token, "a label");
                }
                value();
            } else if (token.kind !== "end of file") {
                error("unexpected_a", token);
                skip_line();
            } else {
                break;
            }
        } catch (_) {
            skip_line();
        }
    }
    supposed_instructions.forEach(function (name_token) {
        const definition = define_object[name_token.text];
        if (definition !== undefined && !maybe_kind(definition, "instr")) {
            error("expected_instruction", name_token);
        }
    });
    supposed_local_refs.forEach(function (name_token) {
        if (define_object[name_token.text] === undefined) {
            error("undefined_a", name_token);
        }
    });
    supposed_types.forEach(function (name_token) {
        const definition = define_object[name_token.text];
        if (definition !== undefined && !maybe_kind(definition, "type")) {
            error("expected_b_a", name_token, "a type");
        }
    });
    return {
        lang: "uFork",
        ast: {
            kind: "module",
            import: import_object,
            define: define_object,
            export: export_array
        },
        tokens,
        errors
    };
}

let claims = [];

function good(description, text) {
    claims.push(function good_validator() {
        const result = parse(tokenize(text));
        return (
            result.errors.length > 0
            ? [[description, result]]
            : []
        );
    });
}

function bad(description, text) {
    claims.push(function bad_validator() {
        const result = parse(tokenize(text));
        return (
            result.errors.length === 0
            ? [[description, text]]
            : []
        );
    });
}

good("empty", "");
good("continuation separated by labels", `
a:
    msg 2
b:
    end commit
`);
good("string labels", `
.import
    "~1": "../mod.asm"
"~2":
    ref "~1"."~3"
"~4":
    ref "~2"
.export
    "~4"
`);
good("type literal", `
a:
    push #actor_t
    end commit
`);
good("custom quads", `
nullary_t:
    type_t 0
unary_t:
    type_t 1
binary_t:
    type_t 2
ternary_t:
    type_t 3
nullary:
    quad_1 nullary_t
unary:
    quad_2 unary_t 1
binary:
    quad_3 binary_t 1 2
ternary:
    quad_4 ternary_t 1 2 3
nullary_k:
    quad_1
    ref nullary_t
unary_k:
    quad_2 unary_t
    ref 1
binary_k:
    quad_3 binary_t 1
    ref 2
ternary_k:
    quad_4 ternary_t 1 2
    ref 3
`);
good("fib", `
; A fibonnacci service behavior.
.import
    std: "./std.asm"
fib_beh:                    ; _ <- (cust . n)
    msg -1                  ; n
    dup 1                   ; n n
    push 2                  ; n n 2
    cmp lt                  ; n n<2
    if std.cust_send        ; n
    msg 1                   ; n cust
    push k                  ; n cust k
    actor create            ; n k=k.cust
    pick 2                  ; n k n
    push 1                  ; n k n 1
    alu sub                 ; n k n-1
    pick 2                  ; n k n-1 k
    pair 1                  ; n k (k . n-1)
    push #?                 ; n k (k . n-1) #?
    push fib_beh            ; n k (k . n-1) #? fib_beh
    actor create            ; n k (k . n-1) fib.#?
    actor send              ; n k
    roll 2                  ; k n
    push 2                  ; k n 2
    alu sub                 ; k n-2
    roll 2                  ; n-2 k
    pair 1                  ; (k . n-2)
    push #?                 ; (k . n-2) #?
    push fib_beh            ; (k . n-2) #? fib_beh
    actor create            ; (k . n-2) fib.#?
    ref std.send_msg
k:                          ; cust <- m
    msg 0                   ; m
    state 0                 ; m cust
    pair 1                  ; (cust . m)
    push k2                 ; (cust . m) k2
    actor become            ; k2.(cust . m)
    ref std.commit
k2:                         ; (cust . m) <- n
    state -1                ; m
    msg 0                   ; m n
    alu add                 ; m+n
    state 1                 ; m+n cust
    ref std.send_msg
.export
    fib_beh
`);
good("character literals", `
a:
    ref 'a'
b:
    ref '😀'
c:
    ref '\\n'
`);
good("typeq type", `
.import
    out: "out"
alias_t:
    ref #fixnum_t
custom_t:
    type_t 2
external_t:
    ref out.t
a:
    typeq #fixnum_t
    end commit
b:
    typeq alias_t
    end commit
c:
    typeq custom_t
    end commit
d:
    typeq out.t
    end commit
`);
bad("typeq #t", `
a:
    typeq #t
    end commit
`);
bad("typeq local ref", `
a:
    ref #t
b:
    typeq a
    end commit
`);
bad("string declaration", `
."import"
    std: "std"
`);
bad("string operator", `
a:
    "ref" 1
`);
bad("type_t bad arity", `
type:
    type_t 4
`);
bad("character escape", `
a:
    ref '\\x'
`);
bad("unescaped character literal", `
a:
    ref '''
`);
bad("too many characters", `
a:
    ref 'foo'
`);
good("non-decimal fixnums", `
hex:
    ref 16#0A
binary:
    ref 2#101010
`);
bad("malformed fixnums", `
hex:
    ref 16#ZZ
binary:
    ref 2#123
`);
bad("negative base", `
a:
    ref -16#A0
`);
bad("bad sub operator", `
a:
    my xyz
    end commit
`);
bad("bad label", `
ab$c:
    end commit
`);
bad("unlabelled statement", `
a:
    end commit
    end commit
`);
bad("unlabelled statement after explicit continuation", `
a:
    cmp le a
    end commit
`);
bad("instruction continuation is data", `
a:
    cmp le b
b:
    pair_t 1 2
`);
bad("instruction continuation is data, separated by labels", `
a:
    cmp le
b:
c:
    pair_t 1 2
`);
bad("instruction continuation is data, via a chain of refs", `
a:
    ref 42
b:
    ref a
d:
    alu xor c
c:
    actor self
    ref b
`);
bad("too few operands", `
a:
    dict_t 1
`);
bad("too many operands", `
a:
    jump 1 a
`);
bad("undefined ref", `
a:
    ref b
`);
bad("missing import", `
a:
    ref x.y
`);
bad("late imports", `
a:
    end commit
.import
    x: "x"
`);
bad("duplicate imports", `
.import
    x: "x"
.import
    y: "y"
`);
bad("late definition", `
a:
    ref 1
.export
    a
b:
    ref 2
`);
bad("duplicate exports", `
a:
    ref 1
b:
    ref 1
.export
    a
.export
    b
`);
bad("export undefined", `
.export
    a
`);
bad("'if' operand is fixnum", `
a:
    if 1 a
`);
bad("'typeq' of a fixnum", `
a:
    typeq 42 a
`);
bad("instruction missing continuation", `
a:
    dict has
    pair 2
`);
bad("exportation at margin", `
.export
a
`);
bad("label is indented", `
 a:
    nth 5 a
`);
bad("label is redefined", `
a:
a:
    end commit
`);
bad("instruction continuation is a module name", `
.import
    i: "i"
a:
    drop 4 i
`);
bad("instruction continuation is fixnum", `
a:
    msg 1 0
`);
bad("instruction continuation is data", `
a:
    cmp le
    ref b
b:
    pair_t 1 2
`);
bad("undefined continuation operand", `
a:
    drop 4
    actor self b
`);
bad("instruction at margin", `
a:
nth 5 a
`);
bad("directive indented", `
 .export
    a
`);
bad("import is exported", `
.import
    i: "i"
.export
    i
`);
bad("unterminated instruction stream", `
a:
    msg 1
.export
    a
`);
bad("missing instruction ref of ref", `
b:
    ref c
a:
    dup 0
    ref b
`);
good("import and label with same name", `
.import
    foo: "foo"
foo:
    ref foo.name
`);
bad("imm out of range", `
foo:
    part -1
    end commit
`);
good("deprecated instructions", `
foo:
    my self
    new 0
    send 3
    beh -1
    end commit
`);

const common_tails = parse(tokenize(`
a:
    pair_t #t
b:
    pair_t #f #nil
`));
claims.push(function common_tails_validator() {
    return (
        common_tails.ast.define.a.tail.kind !== "ref"
        ? [{description: "common_tails", text: "duplicated"}]
        : []
    );
});

function test_parse() {
    let violations = [];
    claims.forEach(function (claim) {
        violations.push(...claim());
    });
    if (violations.length > 0) {
        violations.forEach(function ([description, evidence]) {
            globalThis.console.log("FAIL", description, evidence);
        });
        throw new Error("FAIL parse");
    }
}

function assemble(text, src) {
    return parse(tokenize(text), src);
}

// assemble(`
// oi:
//     my state
//     end commit
// `, "invalid.asm");

if (import.meta.main) {
    test_tokenizer();
    test_parse();
}

export default Object.freeze(assemble);
