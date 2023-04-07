// uFork assembler

// Assembles uFork assembly source code into an intermediate representation,
// suitable for loading.

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
        -? [ 1-9 ] \d*
      | 0
    )
  | (
        "
        [ ^ " ]*
        "
    )
  | (
        [ \. : # \? ]
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

function tokenize(source) {
    let rx_token = new RegExp(rx_token_raw, "y"); // sticky
    let line_nr = 0;
    let column_to = 0;
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
                id: "\n",
                line_nr,
                column_nr
            };
            line_nr += 1;
            column_to = 0;
            return token;
        }
        if (captives[2]) {
            return {
                id: " ",
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
            const number = parseInt(captives[6], 10);
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

function one(make_node) {
    return function one_matcher(input) {
        if (input.token === undefined) {
            return {message: "Unexpected end of stream."};
        }
        const node = make_node(input.token);
        return (
            node !== undefined
            ? [input.next(), node]
            : {
                message: "Unexpected.",
                token: input.token
            }
        );
    };
}

function or(matcher_array) {
    return function or_matcher(input) {
        let ok;
        matcher_array.some(function (matcher) {
            const result = matcher(input);
            if (Array.isArray(result)) {
                ok = result;
                return true;
            }
            return false;
        });
        return ok ?? {message: "Unexpected", token: input.token};
    };
}

function and(matcher_array) {
    return function and_matcher(input) {
        let nodes = [];
        let result;
        return (
            matcher_array.every(function (matcher) {
                result = matcher(input);
                if (Array.isArray(result)) {
                    input = result[0];
                    nodes.push(result[1]);
                    return true;
                }
                return false;
            })
            ? [input, nodes]
            : result
        );
    };
}

function repeat(matcher) {
    return function repeat_matcher(input) {
        let nodes = [];
        while (true) {
            const result = matcher(input);
            if (!Array.isArray(result)) {
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
        input = tail[0];
        return [input, [head[1], ...tail[1]]];
    };
}

function optional(matcher) {
    return or([matcher, zero()]);
}

// Now we build our language grammar.

function id(the_id) {
    return one(function predicate(token) {
        return (
            token.id === the_id
            ? token
            : undefined
        );
    });
}

function spaces() {
    return id(" ");
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
        id("\n")
    ]);
}

function directive(name) {
    return and([
        id("."),
        id(name)
    ]);
}

function name() {
    return one(function predicate(token) {
        return (
            token.alphameric === true
            ? token
            : undefined
        );
    });
}

function importation() {
    return and([
        indent(),
        name(),
        id(":"),
        spaces(),
        id(":string:"),
        many(newline())
    ]);
}

function import_declaration() {
    return and([
        directive("import"),
        many(newline()),
        many(importation())
    ]);
}

function label() {
    return and([
        name(),
        id(":"),
        many(newline())
    ]);
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
        name(),
        repeat(operand()),
        many(newline())
    ]);
}

function definition() {
    return and([
        many(label()),
        many(statement())
    ]);
}

function exportation() {
    return and([
        indent(),
        name(),
        many(newline())
    ]);
}

function export_declaration() {
    return and([
        directive("export"),
        many(newline()),
        many(exportation())
    ]);
}

function module() {
    return and([
        repeat(newline()),
        optional(import_declaration()),
        many(definition()),
        export_declaration()
    ]);
}

function first(generator) {
    let memo;
    return function (...args) {
        if (generator !== undefined) {
            memo = generator(...args);
            generator = undefined;
            return memo;
        }
        return memo;
    };
}

function streamify(token_generator) {
    const token = token_generator();
    return {
        token,
        next: first(function () {
            return streamify(token_generator);
        })
    };
}

function parse(token_generator) {
    const result = module()(streamify(token_generator));
    if (!Array.isArray(result)) {
        return result;
    }
    const [input, tree] = result;
    if (input.token !== undefined) {
        return {
            message: "Unexpected token.",
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
    end: ["abort", "stop", "commit", "release"]
};

function generate_crlf(tree, file) {
    let import_object = Object.create(null);
    let define_object = Object.create(null);

    function fail(message, token) {
        throw {message, token};
    }

    function is_defined(name) {
        return tree[2].some(function ([labels]) {
            return labels.some(function ([name_token]) {
                return name_token.id === name;
            });
        });
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
            ? {kind: "type", name: token.name}
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

    function gen_ref(operand) {
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
                name: export_name
            };
        }
        if (token.alphameric !== true) {
            return fail("Expected a name");
        }
        if (!is_defined(token.id)) {
            return fail("Not defined", token);
        }
        return {
            kind: "ref",
            name: token.id
        };
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
        return gen_ref(operand);
    }

    function gen_instruction(operand) {
        // TODO forbid literals, etc
        return gen_expression(operand);
    }

    function gen_value(statements) {
        const [ignore, operator, operands] = statements[0];
        const debug = {
            file,
            line: operator.line_nr
        };

        function args_check(nr_required, nr_optional) {
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

        function gen_continuation(operand_nr) {
            return (
                operands[operand_nr] !== undefined
                ? (
                    statements.length <= 1
                    ? gen_instruction(operands[operand_nr])
                    : fail("Unexpected", statements[1][1])
                )
                : (
                    statements.length > 1
                    ? gen_value(statements.slice(1))
                    : fail("Expected a continuation", operator)
                )
            );
        }

        if (operator.id === "pair_t") {
            args_check(1, 1);
            return {
                kind: "pair",
                head: gen_expression(operands[0]),
                tail: gen_continuation(1),
                debug
            };
        }
        if (operator.id === "dict_t") {
            args_check(2, 1);
            return {
                kind: "dict",
                key: gen_expression(operands[0]),
                value: gen_expression(operands[1]),
                next: gen_continuation(2), // TODO ref/dict/nil only
                debug
            };
        }
        if (operator.id === "typeq") {
            args_check(1, 1);
            return {
                kind: "instr",
                op: "typeq",
                imm: gen_type(operands[0]),
                k: gen_continuation(1), // TODO ref/instr only
                debug
            };
        }
        if (
            operator.id === "pair"
            || operator.id === "part"
            || operator.id === "nth"
            || operator.id === "drop"
            || operator.id === "pick"
            || operator.id === "dup"
            || operator.id === "roll"
            || operator.id === "eq"
            || operator.id === "msg"
            || operator.id === "send"
            || operator.id === "new"
            || operator.id === "beh"
        ) {
            args_check(1, 1);
            return {
                kind: "instr",
                op: operator.id,
                imm: gen_fixnum(operands[0]),
                k: gen_continuation(1),
                debug
            };
        }
        if (
            operator.id === "push"
            || operator.id === "is_eq"
            || operator.id === "is_ne"
        ) {
            args_check(1, 1);
            return {
                kind: "instr",
                op: operator.id,
                imm: gen_expression(operands[0]),
                k: gen_continuation(1),
                debug
            };
        }
        if (operator.id === "depth") {
            args_check(0, 1);
            return {
                kind: "instr",
                op: "depth",
                k: gen_continuation(0),
                debug
            };
        }
        if (operator.id === "if") {
            args_check(1, 1);
            return {
                kind: "instr",
                op: "if",
                t: gen_instruction(operands[0]),
                f: gen_continuation(1),
                debug
            };
        }
        if (operator.id === "if_not") {
            args_check(1, 1);
            return {
                kind: "instr",
                op: "if",
                f: gen_instruction(operands[0]),
                t: gen_continuation(1),
                debug
            };
        }
        if (
            operator.id === "dict"
            || operator.id === "deque"
            || operator.id === "alu"
            || operator.id === "cmp"
            || operator.id === "my"
        ) {
            args_check(1, 1);
            return {
                kind: "instr",
                op: operator.id,
                imm: gen_label(operands[0], imm_labels[operator.id]),
                k: gen_continuation(1),
                debug
            };
        }
        if (operator.id === "end") {
            args_check(1, 0);
            return {
                kind: "instr",
                op: "end",
                imm: gen_label(operands[0], imm_labels.end),
                debug
            };
        }
        if (operator.id === "ref") {
            args_check(1, 0);
            return gen_expression(operands[0]);
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
            import_object[the_name.id] = the_specifier.string;
        });
    }
    define.forEach(function ([labels, statements]) {
        const [the_name] = labels[0];
        define_object[the_name.id] = gen_value(statements);
        labels.slice(1).forEach(function (label) {
            define_object[label[0].id] = {
                kind: "ref",
                name: the_name.id
            };
        });
    });
    return {
        lang: "uFork",
        ast: {
            kind: "module",
            import: import_object,
            define: define_object,
            export: exports[2].map(function (the_export) {
                return the_export[1].id;
            })
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
            line: exception.token?.line_nr,
            column: exception.token?.column_nr
        };
    }
}

export default Object.freeze(assemble);
