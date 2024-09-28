// Text editor support for Humus.

import compile from "https://ufork.org/lib/humus.js";
import dom from "./dom.js";
import ed_comment from "./ed_comment.js";
import ed_duplication from "./ed_duplication.js";
import ed_tab from "./ed_tab.js";
import theme from "./theme.js";

const indent = "\u0020".repeat(4);
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
    warning: {borderRadius: "2px", outline: "1px solid " + theme.red}
};
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
    const ir = compile(text);
    element.textContent = "";
    let position = 0;
    let prev = {
        type: "control",
        value: "<start>",
        start_ofs: 0,
        end_ofs: 0
    };
    ir.tokens.forEach(function (token) {
        const errors = ir.errors.filter(function (error) {
            return token.start_ofs >= error.start && token.end_ofs <= error.end;
        });
        let context = token.type;
        if (token.value === "#" || prev.value === "#") {
            context = "literal";
        } else if (token.type === "symbol") {
            context = contexts[token.value] ?? "ident";
        }
        const start = token.start_ofs;
        const end = token.end_ofs;
        if (start >= position) {
            const comment_element = dom("span", {
                textContent: text.slice(position, start),
                style: styles.comment
            });
            const token_properties = {
                textContent: text.slice(start, end),
                style: (
                    errors.length > 0
                    ? Object.assign({}, styles[context], styles.warning)
                    : styles[context]
                )
            };
            if (errors.length > 0) {
                token_properties.title = errors.map(function (error) {
                    return error.message;
                }).join("\n");
            }
            const token_element = dom("span", token_properties);
            element.append(comment_element, token_element);
        }
        position = end;
        prev = token;
    });
    const remnant_element = dom("span", {
        textContent: text.slice(position),
        style: styles.comment
    });
    element.append(remnant_element);
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
