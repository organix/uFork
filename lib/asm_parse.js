// uFork assembly parser.

// Parses a sequence of tokens into uFork's intermediate representation AST.
// See ir.md.

// This parser is fault-tolerant. It attempts to provide useful information even
// for invalid source code.

// The parser's source code is heavily inspired, and in places lifted verbatim,
// from Douglas Crockford's Misty parser, see https://mistysystem.com.

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
    if (singular(token.kind)) {
        return "a " + token.kind;
    }
    return token.kind;
}

function stringify_enum(array) {
    array = array.slice(0, -1).concat("or " + array[array.length - 1]);
    return array.join(", ");
}

function parse(generate_token, file) {
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
            end: token.end
        };
        if (a !== undefined) {
            the_error.a = a;
        }
        if (b !== undefined) {
            the_error.b = b;
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

    function advance(value, strict = false) {
        if (value !== undefined && token.kind !== value) {
            error("expected_b_a", token, (
                singular(value)
                ? "a " + value
                : "\"" + value + "\""
            ));
            if (strict) {
                throw "Strict.";
            }
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
                next_token.kind = "string";
            } else if (
                next_token.kind === "error"
                && next_token.text === "\""
            ) {

// Skip over the contents of unterminated string literals.

                next_token.kind = "string";
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
            ? advance("string", true)
            : advance("name", true)
        );
    }

    function imports() {
        const import_token = advance();
        import_token.kind = "directive";
        if (Object.keys(define_object).length > 0) {
            error("imports_first", import_token);
        }
        if (Object.keys(import_object).length > 0) {
            error("already_a", import_token);
        }
        do {
            try {
                advance("newline", true);
                advance("space", true);
                const name_token = name();
                if (name_token.kind === "name") {
                    name_token.kind = "namespace";
                }
                redefinition_check(name_token);
                advance(":", true);
                if (token.kind === "space") {
                    advance("space");
                } else {
                    error("expected_b_a", token, "a space");
                }
                const specifier_token = advance("string", true);
                import_object[name_token.text] = specifier_token.text;
            } catch (ignore) {
                skip_line();
            }
        } while (token.kind === "newline" && next_token.kind === "space");
        advance("newline");
    }

    function exports() {
        const export_token = advance();
        export_token.kind = "directive";
        if (Object.keys(export_array).length > 0) {
            error("already_a", export_token);
        }
        do {
            try {
                advance("newline", true);
                advance("space", true);
                const name_token = name();
                if (export_array.includes(name_token.text)) {
                    error("already_a", name_token);
                }
                supposed_local_refs.push(name_token);
                export_array.push(name_token.text);
            } catch (ignore) {
                skip_line();
            }
        } while (token.kind === "newline" && next_token.kind === "space");
        advance("newline");
    }

    function fixnum() {
        const number_token = advance("number", true);
        return number_token.number;
    }

    function type_literal() {
        const literal_token = advance("literal", true);
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
        const literal_token = advance("literal", true);
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

    function local_ref(instruction_only = false) {
        const name_token = name();
        supposed_local_refs.push(name_token);
        if (instruction_only) {
            supposed_instructions.push(name_token);
        }
        return {
            kind: "ref",
            name: name_token.text,
            debug: {
                file,
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
                module_token.kind = "namespace";
            }
            advance(".", true);
            const name_token = name();
            return {
                kind: "ref",
                module: module_token.text,
                name: name_token.text,
                debug: {
                    file,
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
        return ref(instruction_only);
    }

    function sub_operator(op_name) {
        const name_token = advance("name", true);
        if (sub_operators[op_name].includes(name_token.text)) {
            name_token.kind = "operator";
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
        advance("space", true);
        return expression();
    }

    function value(instruction_only = false) {
        let debug = {file};
        let name_token;

        function continuation(instruction_only) {
            if (token.kind === "newline") {
                debug.end = previous_token.end;
                advance("newline", true);
                return value(instruction_only);
            }
            advance("space", true);
            const the_expression = expression(instruction_only);
            debug.end = previous_token.end;
            advance("newline", true);
            return the_expression;
        }

        function data_check() {
            if (instruction_only) {
                error("expected_instruction", name_token);
            }
        }

        try {
            if (token.kind !== "space") {
                return label(instruction_only);
            }
            advance("space", true);
            name_token = advance("name", true);
            debug.start = name_token.start;
            debug.end = name_token.end;
            const op = name_token.text;
            if (op === "type_t") {
                name_token.kind = "data";
                data_check();
                advance("space", true);
                const arity_token = token;
                const arity = fixnum();
                if (arity < 0 || arity > 3) {
                    error("arity", arity_token);
                }
                debug.end = previous_token.end;
                advance("newline", true);
                return {
                    kind: "type",
                    arity,
                    debug
                };
            }
            if (op === "quad_1") {
                name_token.kind = "data";
                data_check();
                return {
                    kind: "quad",
                    t: continuation(),
                    debug
                };
            }
            if (op === "quad_2") {
                name_token.kind = "data";
                data_check();
                return {
                    kind: "quad",
                    t: operand(),
                    x: continuation(),
                    debug
                };
            }
            if (op === "quad_3") {
                name_token.kind = "data";
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
                name_token.kind = "data";
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
                name_token.kind = "data";
                data_check();
                return {
                    kind: "pair",
                    head: operand(),
                    tail: continuation(),
                    debug
                };
            }
            if (op === "dict_t") {
                name_token.kind = "data";
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
                name_token.kind = "terminal";
                advance("space", true);
                const the_expression = expression(instruction_only);
                debug.end = previous_token.end;
                advance("newline", true);
                return the_expression;
            }

// The statement is an instruction. From here on in, the continuation stream
// must consist solely of instructions, and never data.

            if (op === "jump") {
                name_token.kind = "terminal";
                advance("newline", true);
                return {
                    kind: "instr",
                    op,
                    debug
                };
            }
            if (op === "end") {
                name_token.kind = "terminal";
                advance("space", true);
                const imm = sub_operator(op);
                debug.end = previous_token.end;
                advance("newline", true);
                return {
                    kind: "instr",
                    op,
                    imm,
                    debug
                };
            }
            if (op === "if") {
                name_token.kind = "conditional";
                advance("space", true);
                return {
                    kind: "instr",
                    op,
                    t: ref(true),
                    f: continuation(true),
                    debug
                };
            }
            if (op === "if_not") {
                name_token.kind = "conditional";
                advance("space", true);
                return {
                    kind: "instr",
                    op: "if",
                    f: ref(true),
                    t: continuation(true),
                    debug
                };
            }
            if (op === "typeq") {
                name_token.kind = "operator";
                advance("space", true);
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
                name_token.kind = "operator";
                advance("space", true);
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
                name_token.kind = "operator";
                advance("space", true);
                return {
                    kind: "instr",
                    op,
                    imm: expression(),
                    k: continuation(true),
                    debug
                };
            }
            if (op === "debug") {
                name_token.kind = "operator";
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
                name_token.kind = "operator";
                advance("space", true);
                return {
                    kind: "instr",
                    op,
                    imm: sub_operator(op),
                    k: continuation(true),
                    debug
                };
            }
            error("unexpected_a", name_token);
        } catch (ignore) {}
        skip_line();
        advance("newline");
    }

    function label(instruction_only) {
        try {
            const name_token = name();
            if (export_array.length > 0) {
                error("exports_last", name_token);
            }
            redefinition_check(name_token);
            advance(":", true);
            advance("newline", true);
            if (token.kind === "name" || token.kind === "string") {

// The label is an alias for the following label.

                define_object[name_token.text] = {
                    kind: "ref",
                    name: token.text
                };
                return label();
            }
            define_object[name_token.text] = value(instruction_only);
            return define_object[name_token.text];
        } catch (ignore) {
            skip_line();
            advance("newline");
        }
    }

    advance();
    advance();
    while (true) {
        if (token.kind === "newline") {
            advance("newline");
        } else if (token.kind === ".") {
            const period_token = advance(".");
            period_token.kind = "directive";
            if (token.kind === "name" && token.text === "import") {
                imports();
            } else if (token.kind === "name" && token.text === "export") {
                exports();
            } else {
                error("expected_b_a", token, "import or export");
                skip_line();
                advance("newline");
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
        kind: "module",
        import: import_object,
        define: define_object,
        export: export_array,
        tokens,
        errors
    };
}

//debug import tokenize from "./asm_tokenize.js";
//debug function good(description, source) {
//debug     const result = parse(tokenize(source));
//debug     if (result.errors.length > 0) {
//debug         console.log("FAIL", description, result);
//debug     }
//debug }
//debug function bad(description, source) {
//debug     const result = parse(tokenize(source));
//debug     if (result.errors.length === 0) {
//debug         console.log("FAIL", description, source);
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
//debug bad("instruction continuation is data", `
//debug a:
//debug     cmp le b
//debug b:
//debug     pair_t 1 2
//debug `);
//debug bad("instruction continuation is data, separated by label", `
//debug a:
//debug     cmp le
//debug b:
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

export default Object.freeze(parse);
