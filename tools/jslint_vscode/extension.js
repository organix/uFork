/*jslint node, eval */

const {
    window,
    workspace,
    languages,
    Diagnostic,
    Position,
    Range
} = require("vscode");

const jslint_href = "https://james.diacono.com.au/jslint/jslint.js";
let jslint;

function lint(document, diagnostics) {
    if (typeof jslint === "function" && document.languageId === "javascript") {
        const report = jslint(document.getText(), {fudge: true});
        diagnostics.set(document.uri, report.warnings.map(function (warning) {
            return new Diagnostic(
                new Range(
                    new Position(warning.line, warning.column),
                    new Position(
                        warning.line,
                        warning.column + (warning.a?.length ?? 1)
                    )
                ),
                warning.message
            );
        }));
    }
}

function activate(context) {
    const diagnostics = languages.createDiagnosticCollection("JSLint");
    context.subscriptions.push(
        workspace.onDidChangeTextDocument(function (event) {
            lint(event.document, diagnostics);
        })
    );

// Loading JSLint is not trivial, because it is distributed as an ES module.
// Furthermore, Node.js does not support network fetching of modules by default.
// Our workaround is to download the module's text, remove the "export default",
// and eval it.

    fetch(jslint_href).then(function (response) {
        return response.text();
    }).then(function (text) {
        jslint = eval(text.replace(
            "export default Object.freeze(function jslint(",
            "Object.freeze(function jslint("
        ));
        if (window.activeTextEditor !== undefined) {
            lint(window.activeTextEditor.document, diagnostics);
        }
    });
}

module.exports = {activate};
