// uFork assembler.

// Parses uFork assembly source into uFork's intermediate representation.
// See ir.md.

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

function linecol(string, position) {

// Infer line and column numbers from a position in a string. Everything is
// numbered from zero.

// We should really be working with code points here, not char codes.

    const lines = string.slice(0, position).split("\n");
    const line = lines.length - 1;
    const column = lines.pop().length;
    return {line, column};
}

//debug linecol(`
//debug abc
//debug def
//debug     here I am!
//debug `, 13);

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
    return function token_generator() {
        const coordinates = linecol(text, position);
        const line = coordinates.line + 1;
        const column = coordinates.column + 1;
        if (rx_token.lastIndex >= text.length) {
            return {
                kind: "end of file",
                start: position,
                end: position,
                line,
                column
            };
        }
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

//debug const cases = Object.create(null);
//debug cases["123"] = [{
//debug     kind: "number",
//debug     number: 123,
//debug     text: "123",
//debug     start: 0,
//debug     end: 3
//debug }];
//debug cases["16#DEAF123"] = [{
//debug     kind: "number",
//debug     number: 233500963,
//debug     text: "16#DEAF123",
//debug     start: 0,
//debug     end: 10
//debug }];
//debug cases["-8#555"] = [{
//debug     kind: "error",
//debug     text: "-8#555",
//debug     start: 0,
//debug     end: 6
//debug }];
//debug cases["#?"] = [{
//debug     kind: "literal",
//debug     text: "#?",
//debug     start: 0,
//debug     end: 2
//debug }];
//debug cases["#actor_t"] = [{
//debug     kind: "literal",
//debug     text: "#actor_t",
//debug     start: 0,
//debug     end: 8
//debug }];
//debug cases[": \"unterm ;stuff"] = [
//debug     {kind: ":", start: 0, end: 1},
//debug     {kind: "space", start: 1, end: 2},
//debug     {kind: "error", text: "\"", start: 2, end: 3},
//debug     {kind: "name", text: "unterm", start: 3, end: 9},
//debug     {kind: "comment", text: "stuff", start: 9, end: 16}
//debug ];
//debug cases["\"stu\"ff\""] = [
//debug     {kind: "string", text: "stu", start: 0, end: 5},
//debug     {kind: "name", text: "ff", start: 5, end: 7},
//debug     {kind: "error", text: "\"", start: 7, end: 8}
//debug ];
//debug cases["😀"] = [
//debug     {kind: "error", text: "😀", start: 0, end: 2}
//debug ];
//debug cases["\"😀\""] = [
//debug     {kind: "string", text: "😀", start: 0, end: 4}
//debug ];
//debug cases["'\\t'"] = [
//debug     {kind: "number", number: 9, text: "\\t", start: 0, end: 4}
//debug ];
//debug cases["'😀'"] = [
//debug     {kind: "number", number: 128512, text: "😀", start: 0, end: 4}
//debug ];
//debug cases["'\n'"] = [
//debug     {kind: "error", text: "'", start: 0, end: 1},
//debug     {kind: "newline", start: 1, end: 2},
//debug     {kind: "error", text: "'", start: 2, end: 3}
//debug ];
//debug Object.entries(cases).forEach(function ([text, expected_tokens]) {
//debug     let generator = tokenize(text);
//debug     let actual_tokens = [];
//debug     while (true) {
//debug         const value = generator();
//debug         if (value.kind === "end of file") {
//debug             break;
//debug         }
//debug         delete value.line;
//debug         delete value.column;
//debug         actual_tokens.push(value);
//debug     }
//debug     if (
//debug         JSON.stringify(actual_tokens)
//debug         !== JSON.stringify(expected_tokens)
//debug     ) {
//debug         throw new Error(
//debug             "Bad tokens: "
//debug             + text
//debug             + " ("
//debug             + JSON.stringify(actual_tokens, undefined, 4)
//debug             + ")"
//debug         );
//debug     }
//debug });

// Parser //////////////////////////////////////////////////////////////////////

// Parses a sequence of tokens into IR.

// This parser is fault-tolerant. It attempts to provide useful information even
// for invalid source code.

// The parser's source code is heavily inspired by, and in places lifted
// verbatim from, Douglas Crockford's Misty parser. See https://mistysystem.com.

const error_bundle = {
    already_a: "{a} was already declared.",
    arity: "Bad arity.",
    expected_b_a: "Expected {b} and saw {a}.",
    expected_instruction: "Expected an instruction, not data.",
    exports_last: "Exports come last.",
    imports_first: "Imports come first.",
    unexpected_a: "Unexpected {a}.",
    undefined_a: "{a} was not defined.",
    unterminated: "Unterminated string."
};
const sub_operators = {
    dict: ["has", "get", "add", "set", "del"],
    alu: [
        "not", "and", "or", "xor", "add", "sub", "mul", "div", "lsl", "lsr",
        "asr", "rol", "ror"
    ],
    cmp: ["eq", "ge", "gt", "lt", "le", "ne"],
    my: ["self", "beh", "state"],
    deque: ["new", "empty", "push", "pop", "put", "pull", "len"],
    sponsor: ["new", "memory", "events", "cycles", "reclaim", "start", "stop"],
    end: ["abort", "stop", "commit"]
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
                node.module === undefined
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

    function redefinition_check(name_token) {
        if (
            define_object[name_token.text] !== undefined
            || import_object[name_token.text] !== undefined
        ) {
            error("already_a", name_token);
        }
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
            redefinition_check(name_token);
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

    function fixnum() {
        const number_token = advance("number");
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
        if (literal_token.text === "#unit") {
            return {kind: "literal", value: "unit"};
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
            const arity_token = token;
            const arity = fixnum();
            if (arity < 0 || arity > 3) {
                error("arity", arity_token);
            }
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

        if (op === "jump") {
            name_token.context = "terminal";
            advance("newline");
            terminal_check();
            return {
                kind: "instr",
                op,
                debug
            };
        }
        if (op === "end") {
            name_token.context = "terminal";
            advance("space");
            const imm = sub_operator(op);
            debug.end = previous_token.end;
            advance("newline");
            terminal_check();
            return {
                kind: "instr",
                op,
                imm,
                debug
            };
        }
        if (op === "if") {
            name_token.context = "conditional";
            advance("space");
            return {
                kind: "instr",
                op,
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
                op,
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
            || op === "signal"
            || op === "send"
            || op === "new"
            || op === "beh"
        ) {
            name_token.context = "operator";
            advance("space");
            return {
                kind: "instr",
                op,
                imm: fixnum(),
                k: continuation(true),
                debug
            };
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
                op,
                k: continuation(true),
                debug
            };
        }
        if (
            op === "dict"
            || op === "deque"
            || op === "alu"
            || op === "cmp"
            || op === "my"
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
        redefinition_check(name_token);
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

//debug function good(description, text) {
//debug     const result = parse(tokenize(text));
//debug     if (result.errors.length > 0) {
//debug         console.log("FAIL", description, result);
//debug     }
//debug }
//debug function bad(description, text) {
//debug     const result = parse(tokenize(text));
//debug     if (result.errors.length === 0) {
//debug         console.log("FAIL", description, text);
//debug     }
//debug }
//debug good("empty", "");
//debug good("continuation separated by labels", `
//debug a:
//debug     msg 2
//debug b:
//debug     end commit
//debug `);
//debug good("string labels", `
//debug .import
//debug     "~1": "../mod.asm"
//debug "~2":
//debug     ref "~1"."~3"
//debug "~4":
//debug     ref "~2"
//debug .export
//debug     "~4"
//debug `);
//debug good("type literal", `
//debug a:
//debug     push #actor_t
//debug     end commit
//debug `);
//debug good("custom quads", `
//debug nullary_t:
//debug     type_t 0
//debug unary_t:
//debug     type_t 1
//debug binary_t:
//debug     type_t 2
//debug ternary_t:
//debug     type_t 3
//debug nullary:
//debug     quad_1 nullary_t
//debug unary:
//debug     quad_2 unary_t 1
//debug binary:
//debug     quad_3 binary_t 1 2
//debug ternary:
//debug     quad_4 ternary_t 1 2 3
//debug nullary_k:
//debug     quad_1
//debug     ref nullary_t
//debug unary_k:
//debug     quad_2 unary_t
//debug     ref 1
//debug binary_k:
//debug     quad_3 binary_t 1
//debug     ref 2
//debug ternary_k:
//debug     quad_4 ternary_t 1 2
//debug     ref 3
//debug `);
//debug good("fib", `
//debug ; A fibonnacci service behavior.
//debug .import
//debug     std: "./std.asm"
//debug beh:                    ; (cust n)
//debug     msg 2               ; n
//debug     dup 1               ; n n
//debug     push 2              ; n n 2
//debug     cmp lt              ; n n<2
//debug     if std.cust_send    ; n
//debug     msg 1               ; n cust
//debug     push k              ; n cust k
//debug     new 1               ; n k=(k cust)
//debug     pick 2              ; n k n
//debug     push 1              ; n k n 1
//debug     alu sub             ; n k n-1
//debug     pick 2              ; n k n-1 k
//debug     push beh            ; n k n-1 k beh
//debug     new 0               ; n k n-1 k fib
//debug     send 2              ; n k
//debug     roll 2              ; k n
//debug     push 2              ; k n 2
//debug     alu sub             ; k n-2
//debug     roll 2              ; n-2 k
//debug     push beh            ; n-2 k beh
//debug     new 0               ; n-2 k fib
//debug     send 2              ;
//debug     ref std.commit
//debug k:                      ; cust
//debug     msg 0               ; cust m
//debug     push k2             ; cust m k2
//debug     beh 2               ; (k2 cust m)
//debug     ref std.commit
//debug k2:                     ; cust m
//debug     msg 0               ; cust m n
//debug     alu add             ; cust m+n
//debug     roll 2              ; m+n cust
//debug     ref std.send_0
//debug .export
//debug     beh
//debug `);
//debug good("character literals", `
//debug a:
//debug     ref 'a'
//debug b:
//debug     ref '😀'
//debug c:
//debug     ref '\\n'
//debug `);
//debug good("typeq type", `
//debug .import
//debug     out: "out"
//debug alias_t:
//debug     ref #fixnum_t
//debug custom_t:
//debug     type_t 2
//debug external_t:
//debug     ref out.t
//debug a:
//debug     typeq #fixnum_t
//debug     end commit
//debug b:
//debug     typeq alias_t
//debug     end commit
//debug c:
//debug     typeq custom_t
//debug     end commit
//debug d:
//debug     typeq out.t
//debug     end commit
//debug `);
//debug bad("typeq #t", `
//debug a:
//debug     typeq #t
//debug     end commit
//debug `);
//debug bad("typeq local ref", `
//debug a:
//debug     ref #t
//debug b:
//debug     typeq a
//debug     end commit
//debug `);
//debug bad("string declaration", `
//debug ."import"
//debug     std: "std"
//debug `);
//debug bad("string operator", `
//debug a:
//debug     "ref" 1
//debug `);
//debug bad("type_t bad arity", `
//debug type:
//debug     type_t 4
//debug `);
//debug bad("character escape", `
//debug a:
//debug     ref '\\x'
//debug `);
//debug bad("unescaped character literal", `
//debug a:
//debug     ref '''
//debug `);
//debug bad("too many characters", `
//debug a:
//debug     ref 'foo'
//debug `);
//debug good("non-decimal fixnums", `
//debug hex:
//debug     ref 16#0A
//debug binary:
//debug     ref 2#101010
//debug `);
//debug bad("malformed fixnums", `
//debug hex:
//debug     ref 16#ZZ
//debug binary:
//debug     ref 2#123
//debug `);
//debug bad("negative base", `
//debug a:
//debug     ref -16#A0
//debug `);
//debug bad("bad sub operator", `
//debug a:
//debug     my xyz
//debug `);
//debug bad("bad label", `
//debug ab$c:
//debug     end commit
//debug `);
//debug bad("unlabelled statement", `
//debug a:
//debug     end commit
//debug     end commit
//debug `);
//debug bad("unlabelled statement after explicit continuation", `
//debug a:
//debug     cmp le a
//debug     end commit
//debug `);
//debug bad("instruction continuation is data", `
//debug a:
//debug     cmp le b
//debug b:
//debug     pair_t 1 2
//debug `);
//debug bad("instruction continuation is data, separated by labels", `
//debug a:
//debug     cmp le
//debug b:
//debug c:
//debug     pair_t 1 2
//debug `);
//debug bad("instruction continuation is data, via a chain of refs", `
//debug a:
//debug     ref 42
//debug b:
//debug     ref a
//debug d:
//debug     alu xor c
//debug c:
//debug     alu not
//debug     ref b
//debug `);
//debug bad("too few operands", `
//debug a:
//debug     dict_t 1
//debug `);
//debug bad("too many operands", `
//debug a:
//debug     jump 1 a
//debug `);
//debug bad("undefined ref", `
//debug a:
//debug     ref b
//debug `);
//debug bad("missing import", `
//debug a:
//debug     ref x.y
//debug `);
//debug bad("late imports", `
//debug a:
//debug     end commit
//debug .import
//debug     x: "x"
//debug `);
//debug bad("duplicate imports", `
//debug .import
//debug     x: "x"
//debug .import
//debug     y: "y"
//debug `);
//debug bad("late definition", `
//debug a:
//debug     ref 1
//debug .export
//debug     a
//debug b:
//debug     ref 2
//debug `);
//debug bad("duplicate exports", `
//debug a:
//debug     ref 1
//debug b:
//debug     ref 1
//debug .export
//debug     a
//debug .export
//debug     b
//debug `);
//debug bad("export undefined", `
//debug .export
//debug     a
//debug `);
//debug bad("'if' operand is fixnum", `
//debug a:
//debug     if 1 a
//debug `);
//debug bad("'typeq' of a fixnum", `
//debug a:
//debug     typeq 42 a
//debug `);
//debug bad("instruction missing continuation", `
//debug a:
//debug     dict has
//debug     pair 2
//debug `);
//debug bad("exportation at margin", `
//debug .export
//debug a
//debug `);
//debug bad("label is indented", `
//debug  a:
//debug     nth 5 a
//debug `);
//debug bad("label is redefined", `
//debug a:
//debug a:
//debug     end commit
//debug `);
//debug bad("instruction continuation is a module name", `
//debug .import
//debug     i: "i"
//debug a:
//debug     drop 4 i
//debug `);
//debug bad("instruction continuation is fixnum", `
//debug a:
//debug     msg 1 0
//debug `);
//debug bad("instruction continuation is data", `
//debug a:
//debug     cmp le
//debug     ref b
//debug b:
//debug     pair_t 1 2
//debug `);
//debug bad("undefined continuation operand", `
//debug a:
//debug     drop 4
//debug     my self b
//debug `);
//debug bad("instruction at margin", `
//debug a:
//debug nth 5 a
//debug `);
//debug bad("directive indented", `
//debug  .export
//debug     a
//debug `);
//debug bad("import is exported", `
//debug .import
//debug     i: "i"
//debug .export
//debug     i
//debug `);
//debug bad("unterminated instruction stream", `
//debug a:
//debug     msg 1
//debug .export
//debug     a
//debug `);

//debug const common_tails = parse(tokenize(`
//debug a:
//debug     pair_t #t
//debug b:
//debug     pair_t #f #nil
//debug `));
//debug if (common_tails.ast.define.a.tail.kind !== "ref") {
//debug     console.log("FAIL", "duplicated common tails");
//debug }

function assemble(text, src) {
    return parse(tokenize(text), src);
}

//debug assemble(`
//debug a:
//debug     msg 1
//debug .export
//debug     a
//debug `, "invalid.asm");

export default Object.freeze(assemble);
