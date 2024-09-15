// Text editor support for Humus.

import compile from "https://ufork.org/lib/humus.js";
import dom from "./dom.js";
import ed_comment from "./ed_comment.js";
import ed_duplication from "./ed_duplication.js";
import ed_tab from "./ed_tab.js";
import theme from "./theme.js";

const indent = "    ";
const rx_comment = /^(\s*)(#\u0020?)/;
const comment_prefix = "# ";

const styles = {
    comment: {color: theme.silver},
    literal: {color: theme.green},
    number: {color: theme.green},
    char: {color: theme.green},
    string: {color: theme.green},
    punct: {color: theme.purple},
    symbol: {color: theme.yellow},
    ident: {color: theme.yellow, fontStyle: "italic"},
    keyword: {color: theme.blue, fontWeight: "bold"},
    conditional: {color: theme.purple},
    data: {color: theme.blue, fontStyle: "italic"},
    directive: {color: theme.purple},
    name: {color: theme.yellow},
    namespace: {color: theme.orange},
    operator: {color: theme.blue},
    terminal: {color: theme.purple, fontStyle: "italic"},
    control: {color: theme.red, background: "white"},
    error: {color: theme.red, background: "black"},
    warning: {borderRadius: "2px", outline: "1px solid " + theme.red}
};

function styled_text(text, style = "comment") {
    return dom("span", {
        textContent: text,
        style: styles[style]
    });
}

const contexts = {
    "TRUE": "literal",
    "FALSE": "literal",
    "NIL": "literal",
    "?": "literal",
    "#": "literal",
    "DEF": "keyword",
    "AS": "keyword",
    "CREATE": "keyword",
    "WITH": "keyword",
    "SEND": "keyword",
    "TO": "keyword",
    "BECOME": "keyword",
    "THROW": "keyword",
    "LET": "keyword",
    "IN": "keyword",
    "CASE": "keyword",
    "OF": "keyword",
    "END": "keyword",
    "NEW": "keyword",
    "IF": "keyword",
    "ELIF": "keyword",
    "ELSE": "keyword",
    "AFTER": "keyword",
    "NOW": "keyword",
    "SELF": "keyword"
};

function highlight(element) {
    const text = element.textContent;
    element.textContent = "";
    const result = compile(text);
    let position = 0;
    if (result.errors.length > 0) {
        result.errors.filter(function (error) {
            return (
                Number.isSafeInteger(error.start)
                && Number.isSafeInteger(error.end)
            );
        }).sort(function (a, b) {
            return a.start - b.start;
        }).forEach(function (error) {

            // Skip overlapping errors.

            if (error.start >= position) {
                element.append(
                    text.slice(position, error.start),
                    dom("span", {
                        textContent: text.slice(error.start, error.end),
                        style: styles.warning,
                        title: error.message
                    })
                );
                position = error.end;
            }
        });
        element.append(text.slice(position));  // remnant
    } else {
        let prev = {
            type: "control",
            value: "<start>",
            start_ofs: 0,
            end_ofs: 0
        };
        result.tokens.forEach(function (token) {
            if (token.value === "#" || prev.value === "#") {
                token.context = "literal";
            } else if (token.type === "symbol") {
                token.context = contexts[token.value] ?? "ident";
            }
            const start = token.start_ofs;
            const end = token.end_ofs;
            if (start >= position) {
                element.append(
                    styled_text(text.slice(position, start)),
                    styled_text(
                        text.slice(start, end),
                        (token.context ?? token.type)
                    )
                );
            }
            position = end;
            prev = token;
        });
        element.append(styled_text(text.slice(position)));  // remnant
    }
}

function handle_keydown(editor, event) {
    ed_comment(editor, event, rx_comment, comment_prefix);
    ed_duplication(editor, event);
    ed_tab(editor, event, indent);
}

function stringify_error(error) {
    return `[${error.line ?? "?"}:${error.column ?? "?"}] ${error.message}`;
}

export default Object.freeze({
    compile,
    handle_keydown,
    highlight,
    stringify_error,
    docs_url: "https://dalnefre.github.io/humus_js/"
});
