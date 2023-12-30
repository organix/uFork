// The uFork assembly grammar in the Monarch format, ported from the
// Sublime Text syntax described in uforkasm.sublime-syntax.

// See https://microsoft.github.io/monaco-editor/monarch.html.

// Check out /vs/editor/standalone/common/themes.ts for a list of token names
// available by default.

const dict_imm_label = ["has", "get", "add", "set", "del"];
const alu_imm_label = [
    "not", "and", "or", "xor", "add", "sub", "mul", "div", "lsl", "lsr", "asr",
    "rol", "ror"
];
const cmp_imm_label = ["eq", "ge", "gt", "lt", "le", "ne"];
const my_imm_label = ["self", "beh", "state"];
const deque_imm_label = ["new", "empty", "push", "pop", "put", "pull", "len"];
const end_imm_label = ["abort", "stop", "commit"];
const sponsor_imm_label = [
    "new", "memory", "events", "cycles", "reclaim", "start", "stop"
];

function make_token_provider() {
    return {

// Tokenizer options.

// The 'includeLF' option includes newline characters in the matched lines,
// allowing us to conveniently detect the end of the line and pop
// the 'operand_list' state.

        includeLF: true,
        unicode: true,
        defaultToken: "invalid",
        start: "root",

// Some reusable regex patterns.

        colon: /\u003A/,
        spaces: /\u0020+/,          // one or more spaces
        name: /\w+/,
        string: /"[^"]*"/,          // double quoted string
        crlf: /\n|\r\n?/,           // various styles of newline
        label_start: /^["\w]/,      // start of a label, possibly quoted
        section_start: /^[".\w]/,   // start of a label or directive
        directive_start: /^\./,     // start of a directive

// Some keywords.

        type_operator: [
            "pair_t", "dict_t", "type_t", "quad_1", "quad_2", "quad_3", "quad_4"
        ],
        terminal_operator: ["ref", "jump"],
        immediate_operator: ["dict", "alu", "cmp", "my", "deque", "sponsor"],
        conditional_operator: ["if", "if_not"],
        other_operator: [
            "assert", "beh", "debug", "drop", "dup", "eq", "msg", "new", "nth",
            "pair", "part", "pick", "push", "quad", "roll", "send", "signal",
            "state", "typeq"
        ],
        immediate_label: [].concat(
            dict_imm_label,
            alu_imm_label,
            cmp_imm_label,
            my_imm_label,
            deque_imm_label,
            end_imm_label,
            sponsor_imm_label
        ),
        constant: [
            "#t", "#f", "#?", "#nil", "#unit", "#literal_t", "#fixnum_t",
            "#type_t", "#pair_t", "#dict_t", "#instr_t", "#actor_t"
        ],

// The grammar.

        tokenizer: {
            comments: [
                [/\u0020*;.*/, "comment"]
            ],
            imports: [
                {include: "@comments"},
                [
                    /^(@spaces)(@string)(@colon)(@spaces)(@string)/,
                    ["", "string", "delimiter", "", "string"]
                ],
                [
                    /^(@spaces)(@name)(@colon)(@spaces)(@string)/,
                    ["", "namespace", "delimiter", "", "string"]
                ],
                [/@section_start/, "@rematch", "@pop"]
            ],
            operand: [

// Constants.

                [/#[a-z0-9_?]+/, {
                    cases: {
                        "@constant": "variable",
                        "@default": "invalid"
                    }
                }],

// Based fixnum.

                [/[0-9]+#[0-9A-F]+/, "number", "@pop"],

// Decimal fixnum.

                [/-?[0-9]+/, "number", "@pop"],

// Character fixnum, possibly escaped.

                [/'(\\(b|t|n|r|'|\\)|.)'/, "number", "@pop"],

// Compound name, either part possibly quoted.

                [/(@name|@string)(\.)(@name|@string)/, [
                    {
                        cases: {
                            "\".*": "string",
                            "@default": "namespace"
                        }
                    },
                    "delimiter",
                    {
                        cases: {
                            "\".*": {token: "string", next: "@pop"},
                            "@default": {token: "namespace", next: "@pop"}
                        }
                    }
                ]],

// Singular name, possibly quoted.

                [/@name|@string/, {
                    cases: {
                        "\".*": {token: "string", next: "@pop"},
                        "@default": {token: "identifier", next: "@pop"}
                    }
                }],

// Any whitespace returns us to the operand list.

                [/@spaces|@crlf/, "@rematch", "@pop"]
            ],
            operand_list: [
                {include: "@comments"},
                [/@spaces/, "", "@operand"],
                [/@crlf/, "@rematch", "@pop"]
            ],
            immediate: [
                {include: "@comments"},
                [/(@spaces)(\w+)/, ["", {
                    cases: {
                        "@immediate_label": {
                            token: "keyword",
                            next: "@operand_list"
                        },
                        "@default": "invalid"
                    }
                }]],
                [/@crlf/, "@rematch", "@pop"]
            ],
            statement: [
                [/\w+/, {
                    cases: {
                        "end": {
                            token: "keyword.flow",
                            next: "@immediate"
                        },
                        "@terminal_operator": {
                            token: "keyword.flow",
                            next: "@operand_list"
                        },
                        "@type_operator": {
                            token: "type",
                            next: "@operand_list"
                        },
                        "@immediate_operator": {
                            token: "keyword",
                            next: "@immediate"
                        },
                        "@conditional_operator": {
                            token: "attribute.name",
                            next: "@operand_list"
                        },
                        "@other_operator": {
                            token: "keyword",
                            next: "@operand_list"
                        },
                        "@default": {
                            token: "invalid",
                            next: "@operand_list"
                        }
                    }
                }],
                [/@crlf/, "", "@pop"]
            ],
            definitions: [
                {include: "@comments"},
                [/^(@name)(@colon)/, ["identifier", "delimiter"]],
                [/^(@string)(@colon)/, ["string", "delimiter"]],
                [/^(@spaces)(?=\w)/, "", "@statement"],
                [/@directive_start/, "@rematch", "@pop"]
            ],
            exports: [
                {include: "@comments"},
                [/^(@spaces)(@name)(@crlf)/, ["", "identifier", ""]]
            ],
            root: [
                {include: "@comments"},
                [/^\.import\b/, "keyword", "@imports"],
                [/@label_start/, "@rematch", "@definitions"],
                [/^\.export\b/, "keyword", "@exports"]
            ]
        }
    };
}

export default Object.freeze(make_token_provider);
