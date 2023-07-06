// uFork assembler

// Transforms uFork assembly source code into an intermediate representation
// that is suitable for loading.

// The assembly language is described in asm.md.
// The intermediate representation is described in crlf.md.

// Tokenizer ///////////////////////////////////////////////////////////////////

function tag_regexp(strings) {

// A tag function that creates a RegExp from a template literal string. Any
// whitespace in the string is ignored, and so can be injected into the pattern
// to improve readability.

    return new RegExp(strings.raw[0].replace(/\s/g, ""), "");
}

const rx_token_raw = tag_regexp `
    (
        \n
      | \r \n?
    )
  | ( \u0020+ )
  | ( ; .* )
  | (
        [ a-z A-Z ]
        (?:
            [ \- _ ]? [ 0-9 a-z A-Z ]
        )*
        \??
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
        [ ^ " ]*
        "
    )
  | (
        [ \. : # \? ]
    )
  | (
        '
        (?:
            \\ [ \\ ' b t n r ]
          | [ ^ \\ ' ]
        )
        '
    )
`;

// Capturing groups:
//  [1] Newline
//  [2] Whitespace
//  [3] Comment
//  [4] Name
//  [5] Literal
//  [6] Fixnum
//  [7] String
//  [8] Punctuator
//  [9] Character

const escape_code_points = {
    "\\": 0x5C,
    "'": 0x27,
    "b": 0x08,
    "t": 0x09,
    "n": 0x0A,
    "r": 0x0D
};

function tokenize(source) {
    let rx_token = new RegExp(rx_token_raw, "yu"); // sticky, unicode aware
    let line_nr = 1;
    let column_to = 1;
    return function token_generator() {

        function error() {
            source = undefined;
            return {
                id: ":error:",
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
            const token = {
                id: ":linebreak:",
                line_nr,
                column_nr
            };
            line_nr += 1;
            column_to = 1;
            return token;
        }
        if (captives[2]) {
            return {
                id: ":space:",
                line_nr,
                column_nr,
                column_to
            };
        }
        if (captives[3]) {
            return {
                id: ":comment:",
                comment: captives[3].slice(1),
                line_nr,
                column_nr,
                column_to
            };
        }
        if (captives[4]) {
            return {
                id: captives[4],
                alphameric: true,
                line_nr,
                column_nr,
                column_to
            };
        }
        if (captives[5]) {
            return {
                id: ":literal:",
                name: captives[5].slice(1),
                line_nr,
                column_nr,
                column_to
            };
        }
        if (captives[6]) {
            let [base, digits] = captives[6].split("#");
            if (digits === undefined) {
                digits = base;
                base = 10;
            }
            if (base < 0) {
                return error();
            }
            const number = parseInt(digits, base);
            return (
                Number.isSafeInteger(number)
                ? {
                    id: ":number:",
                    number,
                    text: captives[6],
                    line_nr,
                    column_nr,
                    column_to
                }
                : error()
            );
        }
        if (captives[7]) {
            return {
                id: ":string:",
                string: captives[7].slice(1, -1),
                line_nr,
                column_nr,
                column_to
            };
        }
        if (captives[8]) {
            return {
                id: captives[8],
                line_nr,
                column_nr,
                column_to
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
                    id: ":number:",
                    number: code_point,
                    text: character,
                    line_nr,
                    column_nr,
                    column_to
                }
                : error()
            );
        }
    };
}

// Parser //////////////////////////////////////////////////////////////////////

// We first define some PEG parser primitives.
// See http://www.dalnefre.com/wp/2011/02/parsing-expression-grammars-part-1.

function zero() {
    return function zero_matcher(input) {
        return [input, undefined];
    };
}

function one(make_node, message = "Unexpected.") {
    return function one_matcher(input) {
        if (input.token === undefined) {
            return {message: "Unexpected end of stream."};
        }
        const node = make_node(input.token);
        return (
            node !== undefined
            ? [input.next(), node]
            : {
                message,
                token: input.token
            }
        );
    };
}

function or(matcher_array, message = "Unexpected.") {
    return function or_matcher(input) {
        let result;
        if (matcher_array.some(function (matcher) {
            result = matcher(input);
            return Array.isArray(result) || result.is_definite_match === true;
        })) {
            return result;
        }
        return {
            message,
            token: input.token
        };
    };
}

function and(matcher_array, definite_match_threshold = Infinity) {
    return function and_matcher(input) {
        let nodes = [];
        let result;
        let nr_matched = 0;
        if (matcher_array.every(function (matcher) {
            result = matcher(input);
            if (Array.isArray(result)) {
                nr_matched += 1;
                input = result[0];
                nodes.push(result[1]);
                return true;
            }
            return false;
        })) {
            return [input, nodes];
        }
        result.is_definite_match = (
            result.is_definite_match === true
            || nr_matched >= definite_match_threshold
        );
        return result;
    };
}

function repeat(matcher) {
    return function repeat_matcher(input) {
        let nodes = [];
        while (true) {
            const result = matcher(input);
            if (!Array.isArray(result)) {
                if (result.is_definite_match === true) {
                    return result;
                }
                break;
            }
            input = result[0];
            nodes.push(result[1]);
        }
        return [input, nodes];
    };
}

function many(matcher) {
    const repeat_matcher = repeat(matcher);
    return function many_matcher(input) {
        const head = matcher(input);
        if (!Array.isArray(head)) {
            return head;
        }
        input = head[0];
        const tail = repeat_matcher(input);
        if (!Array.isArray(tail)) {
            return tail;
        }
        input = tail[0];
        return [input, [head[1], ...tail[1]]];
    };
}

function optional(matcher) {
    return or([matcher, zero()]);
}

// Now we build our language grammar.

function id(the_id) {
    return one(
        function predicate(token) {
            return (
                token.id === the_id
                ? token
                : undefined
            );
        },
        "Expected " + (
            (the_id[0] === ":" && the_id.length > 1)
            ? "a " + the_id.slice(1, -1)
            : "'" + the_id + "'"
        ) + "."
    );
}

function spaces() {
    return id(":space:");
}

function indent() {
    return spaces();
}

function newline() {
    return and([
        optional(
            and([
                optional(spaces()),
                id(":comment:")
            ])
        ),
        id(":linebreak:")
    ]);
}

function directive(name) {
    return and([
        id("."),
        id(name)
    ]);
}

function name(message = "Expected a name.") {
    return one(
        function predicate(token) {
            return (
                token.alphameric === true
                ? token
                : undefined
            );
        },
        message
    );
}

function importation() {
    return and([
        indent(),
        name(),
        id(":"),
        spaces(),
        id(":string:"),
        many(newline())
    ], 1);
}

function import_declaration() {
    return and([
        directive("import"),
        many(newline()),
        many(importation())
    ], 1);
}

function label() {
    return and([
        name(),
        id(":"),
        many(newline())
    ], 1);
}

function pound() {
    return one(function predicate(token) {
        return (
            token.id === ":literal:"
            ? token
            : undefined
        );
    });
}

function ref() {
    return or([
        and([
            name(),
            id("."),
            name()
        ]),
        name()
    ]);
}

function value() {
    return or([
        pound(),
        id(":number:"),
        ref()
    ]);
}

function operand() {
    return and([
        spaces(),
        value()
    ]);
}

function statement() {
    return and([
        indent(),
        name("Expected an operator."),
        repeat(operand()),
        many(newline())
    ], 1);
}

function definition() {
    return and([
        many(label()),
        many(statement())
    ], 1);
}

function exportation() {
    return and([
        indent(),
        name(),
        many(newline())
    ], 1);
}

function export_declaration() {
    return and([
        directive("export"),
        many(newline()),
        many(exportation())
    ], 1);
}

function module() {
    return and([
        repeat(newline()),
        optional(import_declaration()),
        repeat(definition()),
        optional(export_declaration())
    ]);
}

function parse(token_generator) {
    let tokens = [];
    let error_token;

    function make_input(position) {
        while (tokens.length <= position) {
            tokens.push(token_generator());
        }
        const token = tokens[position];
        if (token?.id === ":error:" && error_token === undefined) {
            error_token = token;
        }
        return {
            token,
            next() {
                return make_input(position + 1);
            }
        };
    }

    let result = module()(make_input(0));
    if (error_token !== undefined) {
        return {
            message: "Unexpected.",
            token: error_token
        };
    }
    if (!Array.isArray(result)) {
        return result;
    }
    const [input, tree] = result;
    if (input.token !== undefined) {
        return {
            message: "Unexpected.",
            token: input.token
        };
    }
    return tree;
}

// CRLF generator //////////////////////////////////////////////////////////////

const imm_labels = {
    get: ["T", "X", "Y", "Z"],
    dict: ["has", "get", "add", "set", "del"],
    alu: ["not", "and", "or", "xor", "add", "sub", "mul"],
    cmp: ["eq", "ge", "gt", "lt", "le", "ne"],
    my: ["self", "beh", "state"],
    deque: ["new", "empty", "push", "pop", "put", "pull", "len"],
    sponsor: ["new", "memory", "events", "instrs", "reclaim", "start", "stop"],
    end: ["abort", "stop", "commit", "release"]
};

function generate_crlf(tree, file) {
    let import_object = Object.create(null);
    let define_object = Object.create(null);
    let export_array = [];
    let supposed_instructions = [];

    function fail(message, token) {
        throw {message, token};
    }

    function is_label(name) {
        return tree[2].some(function ([labels]) {
            return labels.some(function ([name_token]) {
                return name_token.id === name;
            });
        });
    }

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

    function redefinition_check(label) {
        const the_name = label[0];
        if (
            define_object[the_name.id] !== undefined
            || import_object[the_name.id] !== undefined
        ) {
            return fail("Redefinition of '" + the_name.id + "'", the_name);
        }
    }

    function gen_label(operand, labels) {
        const token = operand[1];
        return (
            (token.alphameric === true && labels.includes(token.id))
            ? token.id
            : fail("Bad label", token)
        );
    }

    function gen_literal(operand) {
        const token = operand[1];
        if (token.id === ":literal:") {
            if (token.name === "?") {
                return {kind: "literal", value: "undef"};
            }
            if (token.name === "nil") {
                return {kind: "literal", value: "nil"};
            }
            if (token.name === "unit") {
                return {kind: "literal", value: "unit"};
            }
            if (token.name === "t") {
                return {kind: "literal", value: "true"};
            }
            if (token.name === "f") {
                return {kind: "literal", value: "false"};
            }
        }
        return fail("Expected a literal", token);
    }

    function gen_type(operand) {
        const token = operand[1];
        return (
            (token.id === ":literal:" && (
                token.name === "literal_t"
                || token.name === "fixnum_t"
                || token.name === "type_t"
                || token.name === "pair_t"
                || token.name === "dict_t"
                || token.name === "instr_t"
                || token.name === "actor_t"
            ))
            ? {
                kind: "type",
                name: token.name.slice(0, -2)
            }
            : fail("Expected a type", token)
        );
    }

    function gen_fixnum(operand) {
        const token = operand[1];
        return (
            token.id === ":number:"
            ? token.number
            : fail("Expected a fixnum", token)
        );
    }

    function gen_local_ref(name_token, instruction_only = false) {
        if (instruction_only) {
            supposed_instructions.push(name_token);
        }
        return {
            kind: "ref",
            name: name_token.id,
            debug: {
                file,
                line: name_token.line_nr
            }
        };
    }

    function gen_ref_expression(operand, instruction_only = false) {
        const token = operand[1];
        if (Array.isArray(token)) {
            const module_name = token[0].id;
            const export_name = token[2].id;
            if (import_object[module_name] === undefined) {
                return fail("Not imported", token[0]);
            }
            return {
                kind: "ref",
                module: module_name,
                name: export_name,
                debug: {
                    file,
                    line: token[0].line_nr
                }
            };
        }
        if (token.alphameric !== true) {
            return fail("Expected a name", token);
        }
        if (!is_label(token.id)) {
            return fail("Not defined", token);
        }
        return gen_local_ref(token, instruction_only);
    }

    function gen_expression(operand) {
        const token = operand[1];
        if (token.id === ":number:") {
            return token.number;
        }
        if (token.id === ":literal:") {
            return (
                token.name.endsWith("_t")
                ? gen_type(operand)
                : gen_literal(operand)
            );
        }
        return gen_ref_expression(operand);
    }

    function gen_value(statements, fallthru_label, instruction_only = false) {
        const [ignore, operator, operands] = statements[0];
        const debug = {
            file,
            line: operator.line_nr
        };

        function operand_check(nr_required, nr_optional) {
            if (operands.length < nr_required) {
                return fail("Too few operands", operator);
            }
            if (operands.length > nr_required + nr_optional) {
                return fail(
                    "Unexpected operand",
                    operands[nr_required + nr_optional][1]
                );
            }
            if (nr_optional === 0 && statements.length > 1) {
                return fail("Unexpected", statements[1][1]);
            }
        }

        function gen_continuation_expression(operand) {
            return (
                instruction_only
                ? gen_ref_expression(operand, true)
                : gen_expression(operand)
            );
        }

        function gen_continuation(operand_nr) {
            return (
                operands[operand_nr] !== undefined
                ? (
                    statements.length <= 1
                    ? gen_continuation_expression(operands[operand_nr])
                    : fail("Unexpected statement", statements[1][1])
                )
                : (
                    statements.length > 1
                    ? gen_value(
                        statements.slice(1),
                        fallthru_label,
                        instruction_only
                    )
                    : (
                        fallthru_label !== undefined
                        ? gen_local_ref(fallthru_label[0], instruction_only)
                        : fail("Missing continuation", operator)
                    )
                )
            );
        }

        if (operator.id === "pair_t") {
            if (instruction_only) {
                return fail("Expected an instruction, not data", operator);
            }
            operand_check(1, 1);
            return {
                kind: "pair",
                head: gen_expression(operands[0]),
                tail: gen_continuation(1),
                debug
            };
        }
        if (operator.id === "dict_t") {
            if (instruction_only) {
                return fail("Expected an instruction, not data", operator);
            }
            operand_check(2, 1);
            return {
                kind: "dict",
                key: gen_expression(operands[0]),
                value: gen_expression(operands[1]),
                next: gen_continuation(2),
                debug
            };
        }
        if (operator.id === "ref") {
            operand_check(1, 0);
            return gen_continuation_expression(operands[0]);
        }

// The statement is an instruction. From here on in, the continuation stream
// should consist solely of instructions, and never data.

        instruction_only = true;
        if (operator.id === "typeq") {
            operand_check(1, 1);
            return {
                kind: "instr",
                op: "typeq",
                imm: gen_type(operands[0]),
                k: gen_continuation(1),
                debug
            };
        }
        if (
            operator.id === "cell"
            || operator.id === "pair"
            || operator.id === "part"
            || operator.id === "nth"
            || operator.id === "drop"
            || operator.id === "pick"
            || operator.id === "dup"
            || operator.id === "roll"
            || operator.id === "msg"
            || operator.id === "state"
            || operator.id === "signal"
            || operator.id === "send"
            || operator.id === "new"
            || operator.id === "beh"
        ) {
            operand_check(1, 1);
            return {
                kind: "instr",
                op: operator.id,
                imm: gen_fixnum(operands[0]),
                k: gen_continuation(1),
                debug
            };
        }
        if (
            operator.id === "eq"
            || operator.id === "push"
            || operator.id === "is_eq"
            || operator.id === "is_ne"
        ) {
            operand_check(1, 1);
            return {
                kind: "instr",
                op: operator.id,
                imm: gen_expression(operands[0]),
                k: gen_continuation(1),
                debug
            };
        }
        if (operator.id === "depth") {
            operand_check(0, 1);
            return {
                kind: "instr",
                op: "depth",
                k: gen_continuation(0),
                debug
            };
        }
        if (operator.id === "if") {
            operand_check(1, 1);
            return {
                kind: "instr",
                op: "if",
                t: gen_ref_expression(operands[0], true),
                f: gen_continuation(1),
                debug
            };
        }
        if (operator.id === "if_not") {
            operand_check(1, 1);
            return {
                kind: "instr",
                op: "if",
                t: gen_continuation(1),
                f: gen_ref_expression(operands[0], true),
                debug
            };
        }
        if (
            operator.id === "get"
            || operator.id === "dict"
            || operator.id === "deque"
            || operator.id === "alu"
            || operator.id === "cmp"
            || operator.id === "my"
            || operator.id === "sponsor"
        ) {
            operand_check(1, 1);
            return {
                kind: "instr",
                op: operator.id,
                imm: gen_label(operands[0], imm_labels[operator.id]),
                k: gen_continuation(1),
                debug
            };
        }
        if (operator.id === "end") {
            operand_check(1, 0);
            return {
                kind: "instr",
                op: "end",
                imm: gen_label(operands[0], imm_labels.end),
                debug
            };
        }
        return fail("Bad op", operator);
    }

    if (!Array.isArray(tree)) {
        throw tree;
    }
    const [imports, define, exports] = tree.slice(1); // ignore leading newlines
    if (imports !== undefined) {
        imports[2].forEach(function (importation) {
            const the_name = importation[1];
            const the_specifier = importation[4];
            if (import_object[the_name.id] !== undefined) {
                return fail("Redefinition of '" + the_name.id + "'", the_name);
            }
            import_object[the_name.id] = the_specifier.string;
        });
    }
    define.forEach(function (definition, definition_nr) {
        const [labels, statements] = definition;
        const canonical_label = labels[0];
        redefinition_check(canonical_label);
        const the_name = canonical_label[0];
        define_object[the_name.id] = (
            definition_nr + 1 < define.length
            ? gen_value(statements, define[definition_nr + 1][0][0])
            : gen_value(statements)
        );
        labels.slice(1).forEach(function (label) {
            redefinition_check(label);
            define_object[label[0].id] = {
                kind: "ref",
                name: the_name.id
            };
        });
    });
    supposed_instructions.forEach(function (name_token) {
        if (!maybe_kind(define_object[name_token.id], "instr")) {
            return fail("Expected an instruction, not data", name_token);
        }
    });
    if (exports !== undefined) {
        export_array = exports[2].map(function (the_export) {
            const the_name = the_export[1];
            if (!is_label(the_name.id)) {
                return fail("Not defined", the_name);
            }
            return the_name.id;
        });
    }
    return {
        lang: "uFork",
        ast: {
            kind: "module",
            import: import_object,
            define: define_object,
            export: export_array
        }
    };
}

function assemble(source, file) {
    try {
        return generate_crlf(parse(tokenize(source)), file);
    } catch (exception) {
        return {
            kind: "error",
            message: exception.message,
            file,
            line: exception.token?.line_nr ?? 1,
            column: exception.token?.column_nr ?? 1
        };
    }
}

// function good(description, source) {
//     const result = assemble(source);
//     if (result.kind === "error") {
//         console.log("FAIL", description, result);
//     }
// }

// function bad(description, source) {
//     const result = assemble(source);
//     if (result.kind !== "error") {
//         console.log("FAIL", description, source);
//     }
// }

// good("continuation separated by labels", `
// a:
//     msg 2
// b:
//     end commit
// `);

// good("type literal", `
// a:
//     push #actor_t
//     end commit
// `);

// good("fib", `
// ; A fibonnacci service behavior.
// .import
//     std: "./std.asm"
// beh:                    ; (cust n)
//     msg 2               ; n
//     dup 1               ; n n
//     push 2              ; n n 2
//     cmp lt              ; n n<2
//     if std.cust_send    ; n
//     msg 1               ; n cust
//     push k              ; n cust k
//     new 1               ; n k=(k cust)
//     pick 2              ; n k n
//     push 1              ; n k n 1
//     alu sub             ; n k n-1
//     pick 2              ; n k n-1 k
//     push beh            ; n k n-1 k beh
//     new 0               ; n k n-1 k fib
//     send 2              ; n k
//     roll 2              ; k n
//     push 2              ; k n 2
//     alu sub             ; k n-2
//     roll 2              ; n-2 k
//     push beh            ; n-2 k beh
//     new 0               ; n-2 k fib
//     send 2              ;
//     ref std.commit
// k:                      ; cust
//     msg 0               ; cust m
//     push k2             ; cust m k2
//     beh 2               ; (k2 cust m)
//     ref std.commit
// k2:                     ; cust m
//     msg 0               ; cust m n
//     alu add             ; cust m+n
//     roll 2              ; m+n cust
//     ref std.send_0
// .export
//     beh
// `);

// good("character literals", `
// a:
//     ref 'a'
// b:
//     ref '😀'
// c:
//     ref '\\n'
// `);

// bad("character escape", `
// a:
//     ref '\\x'
// `);

// bad("unescaped character literal", `
// a:
//     ref '''
// `);

// bad("too many characters", `
// a:
//     ref 'foo'
// `);

// good("non-decimal fixnums", `
// hex:
//     ref 16#0A
// binary:
//     ref 2#101010
// `);

// bad("malformed fixnums", `
// hex:
//     ref 16#ZZ
// binary:
//     ref 2#123
// `);

// bad("negative base", `
// a:
//     ref -16#A0
// `);

// bad("bad label", `
// ab$c:
//     end commit
// `);

// bad("instruction continuation is data", `
// a:
//     cmp le b
// b:
//     pair_t 1 2
// `);

// bad("instruction continuation is data, separated by label", `
// a:
//     cmp le
// b:
//     pair_t 1 2
// `);

// bad("instruction continuation is data, via a chain of refs", `
// a:
//     ref 42
// b:
//     ref a
// d:
//     alu xor c
// c:
//     alu not
//     ref b
// `);

// bad("too few operands", `
// a:
//     dict_t 1
// `);

// bad("too many operands", `
// a:
//     depth 1 a
// `);

// bad("undefined ref", `
// a:
//     ref b
// `);

// bad("missing import", `
// a:
//     ref x.y
// `);

// bad("export undefined", `
// .export
//     a
// `);

// bad("'if' operand is fixnum", `
// a:
//     if 1 a
// `);

// bad("'typeq' of a fixnum", `
// a:
//     typeq 42 a
// `);

// bad("instruction missing continuation", `
// a:
//     dict has
//     pair 2
// `);

// bad("exportation at margin", `
// .export
// a
// `);

// bad("label is indented", `
//  a:
//     nth 5 a
// `);

// bad("label is redefined", `
// a:
// a:
//     end commit
// `);

// bad("instruction continuation is a module name", `
// .import
//     i: "i"
// a:
//     drop 4 i
// `);

// bad("instruction continuation is fixnum", `
// a:
//     msg 1 0
// `);

// bad("instruction continuation is data", `
// a:
//     cmp le
//     ref b
// b:
//     pair_t 1 2
// `);

// bad("undefined continuation operand", `
// a:
//     drop 4
//     my self b
// `);

// bad("instruction at margin", `
// a:
// nth 5 a
// `);

// bad("directive indented", `
//  .export
//     a
// `);

// bad("import is exported", `
// .import
//     i: "i"
// .export
//     i
// `);

export default Object.freeze(assemble);
