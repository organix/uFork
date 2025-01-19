// Replace any occurrences of 'import.meta.main' in the source code of a
// JavaScript module with 'true' or 'false', removing any dead code that
// results.

// This is an important optimization to apply to Whole Modules
// (https://james.diacono.com.au/whole_modules.html) because imports used only
// by the demo incur a performance penalty during application load.

import {parse} from "https://esm.sh/acorn";
import {recursive, simple} from "https://esm.sh/acorn-walk";

function parse_module(text) {
    return parse(text, {ecmaVersion: "latest", sourceType: "module"});
}

function alter_string(string, alterations) {

// The 'alter_string' function applies an array of substitutions to a string.
// The ranges of the alterations must be disjoint. The 'alterations' parameter
// is an array of objects like {range, replacement} where the range is an array
// like [start, end].

    alterations = alterations.slice().sort(
        function compare(a, b) {
            return a.range[0] - b.range[0] || a.range[1] - b.range[1];
        }
    );
    let end = 0;
    return alterations.map(
        function ({range, replacement}) {
            const chunk = string.slice(end, range[0]) + replacement;
            end = range[1];
            return chunk;
        }
    ).concat(
        string.slice(end)
    ).join(
        ""
    );
}

function infer_boolean(node) {

// If the expression 'node' is known to be true, return true.
// If the expression 'node' is known to be false, return false.
// Otherwise return undefined.

    if (node.type === "Literal") {
        if (node.raw === "false") {
            return false;
        }
        if (node.raw === "true") {
            return true;
        }
    }
    if (node.type === "LogicalExpression") {
        if (node.operator === "&&") {
            if (
                infer_boolean(node.left) === true
                && infer_boolean(node.right) === true
            ) {
                return true;
            }
            if (
                infer_boolean(node.left) === false
                || infer_boolean(node.right) === false
            ) {
                return false;
            }
        }
        if (node.operator === "||") {
            if (
                infer_boolean(node.left) === true
                || infer_boolean(node.right) === true
            ) {
                return true;
            }
        }
    }
    if (node.type === "UnaryExpression" && node.operator === "!") {
        const inferred = infer_boolean(node.argument);
        if (inferred === true) {
            return false;
        }
        if (inferred === false) {
            return true;
        }
    }
}

function test_infer_boolean() {
    const cases = {
        "false": false,
        "true": true,
        "undefined": undefined,
        "a": undefined,
        "true && false": false,
        "true && a": undefined,
        "false || a": undefined,
        "false || true": true,
        "true || false": true,
        "!true": false,
        "!!false": false
    };
    Object.entries(cases).forEach(function ([text, expect]) {
        const node = parse_module(text).body[0].expression;
        if (infer_boolean(node) !== expect) {
            throw new Error("FAIL infer_boolean " + text);
        }
    });
}

function pure(node) {

// Returns true if the node is known to be side effect free. Pure nodes include
// import statements, function declarations, simple variable declarations, and
// conditional statements whose condition is known to be false.

// Though imports technically can cause side effects, that is an extremely poor
// practice that we eschew. We also assume property access has no side
// effects.

    let is_pure = true;
    recursive(node, undefined, {
        ArrowFunctionExpression() {
            return;
        },
        AssignmentExpression() {
            is_pure = false;
        },
        CallExpression(node) {
            const is_import_meta_resolve = (
                node.callee.type === "MemberExpression"
                && node.callee.object.type === "MetaProperty"
                && node.callee.property.name === "resolve"
                && node.arguments.length === 1
                && typeof node.arguments[0].value === "string"
            );
            if (!is_import_meta_resolve) {
                is_pure = false;
            }
        },
        ClassDeclaration() {
            return;
        },
        FunctionExpression() {
            return;
        },
        FunctionDeclaration() {
            return;
        },
        Identifier() {
            return;
        },
        IfStatement(node, _, c) {
            if (infer_boolean(node.test) !== false) {
                c(node.test);
                c(node.consequent);
                if (node.alternate) {
                    c(node.alternate);
                }
            }
        },
        ImportDeclaration(node) {
            if (node.specifiers.length === 0) {
                is_pure = false;
            }
        },
        NewExpression() {
            is_pure = false;
        },
        UnaryExpression(node) {
            if (node.operator === "delete") {
                is_pure = false;
            }
        }
    });
    return is_pure;
}

function test_pure() {
    [
        "import a from \"a\";",
        "import {a} from \"a\";",
        "let a;",
        "let a = b;",
        "let a = function () { b(); };",
        "let a = () => b();",
        "let a = [b] + {b};",
        "class a {}",
        "function a() {}",
        "export default a;",
        "if (false) { a(); }",
        "let a = import.meta.resolve(\"a\");"
    ].forEach(function (text) {
        if (pure(parse_module(text).body[0]) !== true) {
            throw new Error("FAIL pure " + text);
        }
    });
    [
        "import \"a\";",
        "a();",
        "a = b",
        "a += b",
        "let a = b();",
        "export default a();",
        "if (true) { a(); }",
        "if (a) { a(); }",
        "delete a.b;",
        "new a();"
    ].forEach(function (text) {
        if (pure(parse_module(text).body[0]) !== false) {
            throw new Error("FAIL impure " + text);
        }
    });
}

function analyze_idents(statement) {

// Find the top-level variables defined by and the free variables within the
// statement.

    let scopes = [];

    function enter_scope() {
        scopes.unshift({
            define: new Set(),
            free: new Set()
        });
    }

    function exit_scope() {
        return scopes.shift();
    }

    enter_scope();
    recursive(statement, undefined, {
        ArrayPattern(node, _, c) {
            node.elements.forEach(function (element) {
                if (element.type === "Identifier") {
                    scopes[0].define.add(element.name);
                } else if (element.type === "AssignmentPattern") {
                    scopes[0].define.add(element.left.name);
                    c(element.right);
                } else {
                    c(element); // pattern
                }
            });
        },
        ArrowFunctionExpression(node, _, c) {
            c(node, undefined, "FunctionExpression");
        },
        BlockStatement(node, _, c) {
            enter_scope();
            node.body.forEach(function (substatement) {
                c(substatement);
            });
            exit_scope();
        },
        ClassDeclaration(node, _, c) {
            if (node.id) {
                scopes[0].define.add(node.id.name);
            }
            c(node, undefined, "ClassExpression");
        },
        FunctionDeclaration(node, _, c) {
            if (node.id) {
                scopes[0].define.add(node.id.name);
            }
            c(node, undefined, "FunctionExpression");
        },
        FunctionExpression(node, _, c) {
            enter_scope();
            node.params.forEach(function (param) {
                if (param.type === "AssignmentPattern") {
                    scopes[0].define.add(param.left.name);
                    c(param.right);
                } else if (param.type === "RestElement") {
                    scopes[0].define.add(param.argument.name);
                } else if (param.type === "Identifier") {
                    scopes[0].define.add(param.name);
                } else {
                    c(param); // pattern
                }
            });
            c(node.body);
            exit_scope();
        },
        Identifier(node) {
            scopes.every(function (scope) {
                if (!scope.define.has(node.name)) {
                    scope.free.add(node.name);
                    return true;
                }
                return false;
            });
        },
        ImportDefaultSpecifier(node) {
            scopes[0].define.add(node.local.name);
        },
        ImportSpecifier(node) {
            scopes[0].define.add(node.local.name);
        },
        ObjectPattern(node, _, c) {
            node.properties.forEach(function (property) {
                if (property.value.type === "Identifier") {
                    scopes[0].define.add(property.value.name);
                } else if (property.value.type === "AssignmentPattern") {
                    scopes[0].define.add(property.value.left.name);
                    c(property.value.right);
                } else {
                    c(property.value); // pattern
                }
            });
        },
        VariableDeclaration(node, _, c) {
            node.declarations.forEach(function (declaration) {
                if (declaration.id.type === "Identifier") {
                    scopes[0].define.add(declaration.id.name);
                } else {
                    c(declaration.id); // pattern
                }
                if (declaration.init) {
                    c(declaration.init);
                }
            });
        }
    });
    return exit_scope();
}

function equal_sets(a, b) {
    return a.isSubsetOf(b) && b.isSubsetOf(a);
}

function test_analyze_idents() {
    const cases = {
        "123;": {},
        "let a;": {define: ["a"]},
        "let a = b + c;": {define: ["a"], free: ["b", "c"]},
        "let [a] = b;": {define: ["a"], free: ["b"]},
        "let [a = b] = c;": {define: ["a"], free: ["b", "c"]},
        "let {a} = b;": {define: ["a"], free: ["b"]},
        "let {a: b} = d;": {define: ["b"], free: ["d"]},
        "let {a: b = c} = d;": {define: ["b"], free: ["c", "d"]},
        "let {a: {b: c}} = d;": {define: ["c"], free: ["d"]},
        "let [{a}] = b;": {define: ["a"], free: ["b"]},
        "import \"a\";": {},
        "import a from \"a\";": {define: ["a"]},
        "import {a as b} from \"a\";": {define: ["b"]},
        "if (true) { let a = 1; a + b; }": {free: ["b"]},
        "function a(b) { return b + c; }": {define: ["a"], free: ["c"]},
        "function a(b = c) { return b; }": {define: ["a"], free: ["c"]},
        "function a(...b) { return b; }": {define: ["a"]},
        "function a([b]) { return b; }": {define: ["a"]},
        "function a([b = c]) { return b; }": {define: ["a"], free: ["c"]},
        "function a({b}) { return b; }": {define: ["a"]},
        "function a({b: c}) { return c; }": {define: ["a"]},
        "function a({b: c = d}) { return c; }": {define: ["a"], free: ["d"]},
        "const a = (b) => b + c;": {define: ["a"], free: ["c"]},
        "export function a () {}": {define: ["a"]},
        "export default function a () {}": {define: ["a"]},
        "export default function () {}": {}
    };
    Object.entries(cases).forEach(function ([text, expect]) {
        const statement = parse_module(text).body[0];
        const actual = analyze_idents(statement);
        if (
            !equal_sets(new Set(expect.define), actual.define)
            || !equal_sets(new Set(expect.free), actual.free)
        ) {
            throw new Error("FAIL analyze_idents " + text);
        }
    });
}

function fold(text) {

// Comment out dead code from a JavaScript module, returning the modified text.

    const ast = parse_module(text);
    const statements = ast.body;
    const analyses = statements.map(analyze_idents);

// Mark all statements that either export values or have side effects, then mark
// the statements that depend on those statements, and so on until we have
// visited every statement in the program.

    let rooted = new Array(statements.length).fill(false);
    let marked = [];
    statements.forEach(function (statement, statement_nr) {
        if (
            statement.type === "ExportDefaultDeclaration"
            || statement.type === "ExportNamedDeclaration"
            || statement.type === "ExportAllDeclaration"
            || !pure(statement)
        ) {
            marked.push(statement_nr);
        }
    });
    while (marked.length > 0) {
        const marked_nr = marked.shift();
        rooted[marked_nr] = true;
        const marked_free = analyses[marked_nr].free;
        let other_nr = 0;
        while (other_nr < statements.length) {
            const other_define = analyses[other_nr].define;
            if (
                other_nr !== marked_nr // ignore self-reference
                && !marked_free.isDisjointFrom(other_define) // intersects
            ) {
                marked.push(other_nr);
            }
            other_nr += 1;
        }
    }

// Sweep away statements that are not rooted. This is done by commenting them
// out so they can easily be removed by a minifier, yet line numbering will
// remain stable.

    let rx_crlf = /\n|\r\n?/g;
    const alterations = statements.filter(function (_, statement_nr) {
        return !rooted[statement_nr];
    }).flatMap(function (statement, statement_nr) {

// Comment out each line of the statement.

        const prefix = "// ";
        let sub_alterations = [];
        rx_crlf.lastIndex = statement.start;
        while (true) {
            sub_alterations.push({
                range: [rx_crlf.lastIndex, rx_crlf.lastIndex],
                replacement: prefix
            });
            const matches = rx_crlf.exec(text);
            if (!matches || rx_crlf.lastIndex > statement.end) {
                break;
            }
        }

// Though it is legal to have multiple statements on the same line, that would
// make it unsafe to comment out lines with a double slash.

        const is_last = statement_nr === statements.length - 1;
        if (!is_last) {
            rx_crlf.lastIndex = statement.end;
            const match = rx_crlf.exec(text);
            if (!Array.isArray(match) || match.index !== statement.end) {
                throw new Error("Missing newline after statement.");
            }
        }
        return sub_alterations;
    });
    return alter_string(text, alterations);
}

function test_fold() {
    const actual = fold(`
let a;
let b = a;
let d;

function c() {
    return d + c();
}

export default b
`);
    const expect = `
let a;
let b = a;
// let d;

// function c() {
//     return d + c();
// }

export default b
`;
    if (actual !== expect) {
        throw new Error("FAIL " + actual);
    }
    let did_throw = false;
    try {
        fold("let a; let b;");
    } catch (_) {
        did_throw = true;
        fold("let a;\nlet b;");
    }
    if (!did_throw) {
        throw new Error("FAIL fold multiple statements per line");
    }
}

function bind_main(text, main = false) {
    const program = parse_module(text);
    let alterations = [];
    simple(program, {
        MemberExpression(node) {
            if (
                node.object.type === "MetaProperty"
                && node.object.meta.name === "import"
                && node.object.property.name === "meta"
                && node.property.name === "main"
            ) {
                alterations.push({
                    range: [node.start, node.end],
                    replacement: String(main)
                });
            }
        }
    });
    return fold(alter_string(text, alterations));
}

function test_bind_main() {
    const text = `
import test from "test";

function double() {
    return;
}

function test_double() {
    test(double);
}

if (import.meta.main) {
    test_double();
}
export default double;
`;
    const expect_true = `
import test from "test";

function double() {
    return;
}

function test_double() {
    test(double);
}

if (true) {
    test_double();
}
export default double;
`;
    const actual_true = bind_main(text, true);
    if (actual_true !== expect_true) {
        throw new Error("FAIL bind_main true" + actual_true);
    }
    const expect_false = `
// import test from "test";

function double() {
    return;
}

// function test_double() {
//     test(double);
// }

// if (false) {
//     test_double();
// }
export default double;
`;
    const actual_false = bind_main(text, false);
    if (actual_false !== expect_false) {
        throw new Error("FAIL bind_main false" + actual_false);
    }
}

if (import.meta.main) {
    test_infer_boolean();
    test_pure();
    test_analyze_idents();
    test_fold();
    test_bind_main();
}

export default Object.freeze(bind_main);
