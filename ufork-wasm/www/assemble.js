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
    let position = 0;
    return function token_generator() {

        function error() {
            source = undefined;
            return {
                id: ":error:",
                start: position
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

// The following code is incorrect. The "start" and "end" positions should be
// measured in Unicode code points, because the produced CRLF format is
// intended to be language independent. For now, for a simple implementation,
// we count UTF-16 character codes instead.

        const start = position;
        const end = position + captives[0].length;
        position = end;
        if (captives[1]) {
            return {
                id: ":linebreak:",
                start,
                end
            };
        }
        if (captives[2]) {
            return {
                id: ":space:",
                start,
                end
            };
        }
        if (captives[3]) {
            return {
                id: ":comment:",
                comment: captives[3].slice(1),
                start,
                end
            };
        }
        if (captives[4]) {
            return {
                id: ":name:",
                text: captives[4],
                start,
                end
            };
        }
        if (captives[5]) {
            return {
                id: ":literal:",
                name: captives[5].slice(1),
                start,
                end
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
                    start,
                    end
                }
                : error()
            );
        }
        if (captives[7]) {
            return {
                id: ":string:",
                text: captives[7].slice(1, -1),
                start,
                end
            };
        }
        if (captives[8]) {
            return {
                id: captives[8],
                start,
                end
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
                    start,
                    end
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

function id(the_id, message) {
    return one(
        function predicate(token) {
            return (
                token.id === the_id
                ? token
                : undefined
            );
        },
        message ?? (
            "Expected " + (
                (the_id[0] === ":" && the_id.length > 1)
                ? "a " + the_id.slice(1, -1)
                : "'" + the_id + "'"
            ) + "."
        )
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

function keyword(name) {
    return one(
        function predicate(token) {
            return (
                (token.id === ":name:" && token.text === name)
                ? token
                : undefined
            );
        },
        "Expected '" + name + "'."
    );
}

function directive(name) {
    return and([
        id("."),
        keyword(name)
    ]);
}

function name() {
    return one(
        function predicate(token) {
            return (
                (token.id === ":name:" || token.id === ":string:")
                ? token
                : undefined
            );
        },
        "Expected a name."
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
        id(":name:", "Expected an operator."),
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
    dict: ["has", "get", "add", "set", "del"],
    alu: ["not", "and", "or", "xor", "add", "sub", "mul"],
    cmp: ["eq", "ge", "gt", "lt", "le", "ne"],
    my: ["self", "beh", "state"],
    deque: ["new", "empty", "push", "pop", "put", "pull", "len"],
    sponsor: ["new", "memory", "events", "cycles", "reclaim", "start", "stop"],
    end: ["abort", "stop", "commit"]
};

function walk_tree(node, walker) {
    if (Array.isArray(node)) {
        node.forEach((child_node) => walk_tree(child_node, walker));
    }
    if (node !== undefined) {
        walker(node);
    }
}

function generate_crlf(tree, file) {
    let import_object = Object.create(null);
    let define_object = Object.create(null);
    let export_array = [];
    let supposed_instructions = [];
    let supposed_types = [];

    function fail(message, token) {
        throw {message, token};
    }

    function is_label(name) {
        return tree[2].some(function ([labels]) {
            return labels.some(function ([name_token]) {
                return name_token.text === name;
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
            define_object[the_name.text] !== undefined
            || import_object[the_name.text] !== undefined
        ) {
            return fail("Redefinition of '" + the_name.text + "'", the_name);
        }
    }

    function gen_label(operand, labels) {
        const token = operand[1];
        return (
            labels.includes(token.text)
            ? token.text
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

    function gen_type_literal(operand) {
        const token = operand[1];
        return (
            (token.id === ":literal:" && (
                token.name === "fixnum_t"
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
            name: name_token.text,
            debug: {
                file,
                start: name_token.start,
                end: name_token.end
            }
        };
    }

    function gen_ref_expression(operand, instruction_only = false) {
        const token = operand[1];
        if (Array.isArray(token)) {
            const module_name = token[0].text;
            const export_name = token[2].text;
            if (import_object[module_name] === undefined) {
                return fail("Not imported", token[0]);
            }
            return {
                kind: "ref",
                module: module_name,
                name: export_name,
                debug: {
                    file,
                    start: token[0].start,
                    end: token[0].end
                }
            };
        }
        if (token.text === undefined) {
            return fail("Expected a name", token);
        }
        if (!is_label(token.text)) {
            return fail("Not defined", token);
        }
        return gen_local_ref(token, instruction_only);
    }

    function gen_type(operand) {
        const token = operand[1];
        if (token.text !== undefined) {
            supposed_types.push(token);
        }
        if (token.text !== undefined || Array.isArray(token)) {
            return gen_ref_expression(operand);
        }
        return gen_type_literal(operand);
    }

    function gen_expression(operand) {
        const token = operand[1];
        if (token.id === ":number:") {
            return token.number;
        }
        if (token.id === ":literal:") {
            return (
                token.name.endsWith("_t")
                ? gen_type_literal(operand)
                : gen_literal(operand)
            );
        }
        return gen_ref_expression(operand);
    }

    function gen_value(statements, fallthru_label, instruction_only = false) {
        const [ignore, operator, operands] = statements[0];

// Locate the start and end positions of the statement.

        let end = operator.end;
        walk_tree(operands, function (node) {
            if (node.end !== undefined) {
                end = Math.max(end, node.end);
            }
        });
        const debug = {
            file,
            start: operator.start,
            end
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

        function data_check() {
            if (instruction_only) {
                return fail("Expected an instruction, not data", operator);
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

        if (operator.text === "type_t") {
            data_check();
            operand_check(0, 1);
            const arity = gen_fixnum(operands[0]);
            return (
                (arity >= 0 && arity <= 3)
                ? {
                    kind: "type",
                    arity,
                    debug
                }
                : fail("Bad arity.", operands[0][1])
            );
        }
        if (operator.text === "quad_1") {
            data_check();
            operand_check(0, 1);
            return {
                kind: "quad",
                t: gen_continuation(0),
                debug
            };
        }
        if (operator.text === "quad_2") {
            data_check();
            operand_check(1, 1);
            return {
                kind: "quad",
                t: gen_expression(operands[0]),
                x: gen_continuation(1),
                debug
            };
        }
        if (operator.text === "quad_3") {
            data_check();
            operand_check(2, 1);
            return {
                kind: "quad",
                t: gen_expression(operands[0]),
                x: gen_expression(operands[1]),
                y: gen_continuation(2),
                debug
            };
        }
        if (operator.text === "quad_4") {
            data_check();
            operand_check(3, 1);
            return {
                kind: "quad",
                t: gen_expression(operands[0]),
                x: gen_expression(operands[1]),
                y: gen_expression(operands[2]),
                z: gen_continuation(3),
                debug
            };
        }
        if (operator.text === "pair_t") {
            data_check();
            operand_check(1, 1);
            return {
                kind: "pair",
                head: gen_expression(operands[0]),
                tail: gen_continuation(1),
                debug
            };
        }
        if (operator.text === "dict_t") {
            data_check();
            operand_check(2, 1);
            return {
                kind: "dict",
                key: gen_expression(operands[0]),
                value: gen_expression(operands[1]),
                next: gen_continuation(2),
                debug
            };
        }
        if (operator.text === "ref") {
            operand_check(1, 0);
            return gen_continuation_expression(operands[0]);
        }

// The statement is an instruction. From here on in, the continuation stream
// should consist solely of instructions, and never data.

        instruction_only = true;
        if (operator.text === "typeq") {
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
            operator.text === "quad"
            || operator.text === "pair"
            || operator.text === "part"
            || operator.text === "nth"
            || operator.text === "drop"
            || operator.text === "pick"
            || operator.text === "dup"
            || operator.text === "roll"
            || operator.text === "msg"
            || operator.text === "state"
            || operator.text === "signal"
            || operator.text === "send"
            || operator.text === "new"
            || operator.text === "beh"
        ) {
            operand_check(1, 1);
            return {
                kind: "instr",
                op: operator.text,
                imm: gen_fixnum(operands[0]),
                k: gen_continuation(1),
                debug
            };
        }
        if (
            operator.text === "eq"
            || operator.text === "push"
            || operator.text === "assert"
        ) {
            operand_check(1, 1);
            return {
                kind: "instr",
                op: operator.text,
                imm: gen_expression(operands[0]),
                k: gen_continuation(1),
                debug
            };
        }
        if (operator.text === "debug") {
            operand_check(0, 1);
            return {
                kind: "instr",
                op: "debug",
                k: gen_continuation(0),
                debug
            };
        }
        if (operator.text === "if") {
            operand_check(1, 1);
            return {
                kind: "instr",
                op: "if",
                t: gen_ref_expression(operands[0], true),
                f: gen_continuation(1),
                debug
            };
        }
        if (operator.text === "if_not") {
            operand_check(1, 1);
            return {
                kind: "instr",
                op: "if",
                t: gen_continuation(1),
                f: gen_ref_expression(operands[0], true),
                debug
            };
        }
        if (operator.text === "jump") {
            operand_check(0, 0);
            return {
                kind: "instr",
                op: "jump",
                debug
            };
        }
        if (
            operator.text === "dict"
            || operator.text === "deque"
            || operator.text === "alu"
            || operator.text === "cmp"
            || operator.text === "my"
            || operator.text === "sponsor"
        ) {
            operand_check(1, 1);
            return {
                kind: "instr",
                op: operator.text,
                imm: gen_label(operands[0], imm_labels[operator.text]),
                k: gen_continuation(1),
                debug
            };
        }
        if (operator.text === "end") {
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
            if (import_object[the_name.text] !== undefined) {
                return fail(
                    "Redefinition of '" + the_name.text + "'",
                    the_name
                );
            }
            import_object[the_name.text] = the_specifier.text;
        });
    }
    define.forEach(function (definition, definition_nr) {
        const [labels, statements] = definition;
        const canonical_label = labels[0];
        redefinition_check(canonical_label);
        const the_name = canonical_label[0];
        define_object[the_name.text] = (
            definition_nr + 1 < define.length
            ? gen_value(statements, define[definition_nr + 1][0][0])
            : gen_value(statements)
        );
        labels.slice(1).forEach(function (label) {
            redefinition_check(label);
            define_object[label[0].text] = {
                kind: "ref",
                name: the_name.text
            };
        });
    });
    supposed_instructions.forEach(function (name_token) {
        if (!maybe_kind(define_object[name_token.text], "instr")) {
            return fail("Expected an instruction, not data", name_token);
        }
    });
    supposed_types.forEach(function (name_token) {
        if (!maybe_kind(define_object[name_token.text], "type")) {
            return fail("Expected a type", name_token);
        }
    });
    if (exports !== undefined) {
        export_array = exports[2].map(function (the_export) {
            const the_name = the_export[1];
            if (!is_label(the_name.text)) {
                return fail("Not defined", the_name);
            }
            return the_name.text;
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

function linecol(string, position) {

// Infer line and column numbers from a position in a string. Everything is
// numbered from zero.

// We actually should be working with code points here, not char codes.

    const lines = string.slice(0, position).split("\n");
    const line = lines.length - 1;
    const column = lines.pop().length;
    return {line, column};
}

//debug console.log(linecol(`
//debug abc
//debug def
//debug     here I am!
//debug `, 13));

function assemble(source, file) {
    try {
        return generate_crlf(parse(tokenize(source)), file);
    } catch (exception) {
        const error = {
            kind: "error",
            message: exception.message
        };
        if (exception.token?.start !== undefined) {
            const {line, column} = linecol(source, exception.token.start);
            error.line = line + 1;
            error.column = column + 1;
            error.start = exception.token.start;
            error.end = exception.token.end;
        }
        if (file !== undefined) {
            error.file = file;
        }
        return error;
    }
}

//debug function good(description, source) {
//debug     const result = assemble(source);
//debug     if (result.kind === "error") {
//debug         console.log("FAIL", description, result);
//debug     }
//debug }
//debug function bad(description, source) {
//debug     const result = assemble(source);
//debug     if (result.kind !== "error") {
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

export default Object.freeze(assemble);
