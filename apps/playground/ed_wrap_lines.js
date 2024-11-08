// Ed keybinding that wraps the selected text at the ruler.

/*jslint browser, global */

import ed from "./ed.js";
import select_paragraph from "./select_paragraph.js";

const rx_prefix = /^[^a-zA-Z0-9\n]*/;
const rx_regexp_escapable = /[.+*?$(){}|\[\]\^\\]/g;

function tag_rx_token(strings, prefix) {

// Strip whitespace from the pattern (inserted for readability) and inject the
// prefix, first escaping any special characters.

    const [pre, post] = strings.raw.map(function (raw) {
        return raw.replace(/\s/g, "");
    });
    prefix = prefix.replace(rx_regexp_escapable, function (original) {
        return "\\" + original;
    });
    return new RegExp(pre + prefix + post, "g");
}

function tokenize(text, position, prefix) {
    const rx_token = tag_rx_token `
        (
            (?:
                [ \u0020 \t ]*
                (?: \n | \r \n? )
                (?: ${prefix} )?
                [ \u0020 \t ]*
            )+
        )
      | (
            [ ^ \u0020 \t \n \r ]+
        )
      | (
            [ \u0020 \t ]+
        )
    `;

// Capturing groups:
//  [1] linebreaks, possibly including prefix
//  [2] word
//  [3] whitespace

    rx_token.lastIndex = position;
    return function next_token() {
        const start = rx_token.lastIndex;
        const matches = rx_token.exec(text);
        const end = rx_token.lastIndex;
        if (matches) {
            return {
                range: [start, end],
                word: matches[2] !== undefined,
                text: matches[3] ?? matches[2] ?? matches[1]
            };
        }
    };
}

if (import.meta.main) {
    const forth = "\\ ";
    const next_token = tokenize(
        `${forth}here is the first line
${forth}and the next   \u0020

  AND THE  NEXT
`,
        forth.length,
        forth
    );
    globalThis.console.log(function consume_tokens(tokens = []) {
        const token = next_token();
        return (
            token !== undefined
            ? consume_tokens(tokens.concat(token))
            : tokens
        );
    }());
}

function wrap(text, start, end, ruler) {

// If the first line has a non-alphameric prefix, e.g. "// ", that same prefix
// is assumed for all lines.

    const prefix = text.slice(start, end).match(rx_prefix)[0];
    const linebreak = "\n" + prefix;

// The paragraph is broken into tokens, alternating between a word and a
// separator. Separators contain only whitespace, with the possible inclusion
// of a line prefix. Everything else is a word. Tokenization begins after the
// first prefix because it would be incorrectly tokenized as a word.

    const advance = tokenize(
        text.slice(0, end), // don't get greedy
        start + prefix.length,
        prefix
    );
    let alterations = [];
    let previous;
    let token;
    let line_length = prefix.length;

    function replace(token, string) {
        if (token !== undefined && token.text !== string) {
            alterations.push({
                range: token.range,
                replacement: string
            });
        }
    }

    while (true) {
        previous = token;
        token = advance();
        if (token === undefined) {
            break;
        }
        if (previous !== undefined && token.word === previous.word) {
            throw new Error(
                "Adjacent tokens: "
                + JSON.stringify(token.word)
                + " "
                + JSON.stringify(previous.word)
            );
        }
        if (token.word) {
            const left_pad = (
                line_length === prefix.length
                ? ""
                : " "
            );
            const proposed_line_length = (
                line_length + left_pad.length + token.text.length
            );
            if (
                prefix.length + token.text.length > ruler
                || proposed_line_length <= ruler
            ) {

// The word either fits on the current line, or it is so long that it has no
// hope of fitting on a single line. Collapse any whitespace before it.

                replace(previous, left_pad);
                line_length = proposed_line_length;
            } else {

// The word does not fit on the current line. Insert a linebreak before it.

                replace(previous, linebreak);
                line_length = prefix.length + token.text.length;
            }
        }
    }

// Trim any trailing whitespace.

    if (previous !== undefined && !previous.word) {
        replace(previous, "");
    }
    return alterations;
}

if (import.meta.main) {
    const prelude = "PRELUDE";
    const postlude = "\n\nPOSTLUDE";
    const wrappable = prelude + `// First line then
// second with_an_extremely_long_word.
// \t

//bad prefix  \u0020` + postlude;
    const max_line_length = 15;
    const actual = JSON.stringify(wrap(
        wrappable,
        prelude.length,
        wrappable.length - postlude.length,
        max_line_length
    ));

// First line
// then second with_an_extremely_long_word.
// //bad prefix

    const expected = JSON.stringify([
        {range: [20, 21], replacement: "\n// "},
        {range: [25, 29], replacement: " "},
        {range: [64, 71], replacement: "\n// "},
        {range: [83, 86], replacement: ""}
    ]);
    if (actual !== expected) {
        throw new Error(
            "FAIL wrap"
            + "\nExpected:\n" + expected
            + "\nActual:\n" + actual
        );
    }
    const repeated_alterations = wrap(
        actual,
        prelude.length,
        actual.length - postlude.length,
        max_line_length
    );
    if (repeated_alterations.length > 0) {
        throw new Error("FAIL wrap not idempotent");
    }
}

function ed_wrap_lines(editor, event, ruler = 80) {
    if (event.defaultPrevented) {
        return;
    }

// On macOS, ⌥Q actually types "œ", so we can not rely on 'event.key'.

    if (!editor.is_command(event) && event.altKey && event.code === "KeyQ") {
        event.preventDefault();
        const text = editor.get_text();
        const cursor = editor.get_cursor();
        let cursor_start = Math.min(...cursor);
        let cursor_end = Math.max(...cursor);
        if (cursor_start === cursor_end) {

// The cursor is collapsed. Select the entire paragraph.

            [cursor_start, cursor_end] = select_paragraph(
                [cursor_start, cursor_end], // maintain direction
                text
            );
        } else {

// There is a selection. Expand it to encompass the first and last line.

            const pre = text.slice(0, cursor_start);
            const line_pre = pre.split("\n").pop();
            cursor_start -= line_pre.length;
            const post = text.slice(cursor_end);
            const line_post = post.split("\n").shift();
            cursor_end += line_post.length;
        }
        editor.edit(wrap(text, cursor_start, cursor_end, ruler));
    }
}

if (import.meta.main) {
    document.documentElement.innerHTML = "";
    document.body.style.fontFamily = "monospace";
    document.body.style.whiteSpace = "pre";
    document.body.textContent = `Alt+Q (Windows) or ⌥Q (Mac)

// Wrap the lines of the current paragraph.
// For this demo, the line limit is this wide:

<------------------>`;
    const editor = ed({
        element: document.body,
        on_keydown(event) {
            ed_wrap_lines(editor, event, 20);
        }
    });
    document.body.focus();
}

export default Object.freeze(ed_wrap_lines);
