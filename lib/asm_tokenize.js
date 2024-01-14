// uFork assembly tokenizer.

// Transforms the source text of an assembly module into tokens. The 'tokenize'
// function returns a generator function that returns the next token.

// A token is an object. All tokens have a "kind" property, one of:

//      "."
//      ":"
//      "comment"
//      "end of file"
//      "error"
//      "literal"
//      "name"
//      "newline"
//      "number"
//      "space"
//      "string"

// All tokens have "start" and "end" properties that indicate the range of
// the token in the source text.

// Unrecognized characters are produced as "error" tokens and skipped.

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
        [ ^ " \n \r ]*
        "
    )
  | (
        [ \. : ]
    )
  | (
        '
        (?:
            \\ [ \\ ' b t n r ]
          | [ ^ \\ ' \n \r ]
        )
        '
    )
  | (
        .
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
//  [10] Other

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
        if (rx_token.lastIndex >= source.length) {
            return {
                kind: "end of file",
                start: position,
                end: position
            };
        }
        let captives = rx_token.exec(source);

// The following code is incorrect. The "start" and "end" positions should be
// measured in Unicode code points, because the intermediate representation is
// intended to be language independent. For now, for a simple implementation,
// we count UTF-16 character codes instead.

        const start = position;
        const end = position + captives[0].length;
        position = end;
        if (captives[1]) {
            return {
                kind: "newline",
                start,
                end
            };
        }
        if (captives[2]) {
            return {
                kind: "space",
                start,
                end
            };
        }
        if (captives[3]) {
            return {
                kind: "comment",
                text: captives[3].slice(1),
                start,
                end
            };
        }
        if (captives[4]) {
            return {
                kind: "name",
                text: captives[4],
                start,
                end
            };
        }
        if (captives[5]) {
            return {
                kind: "literal",
                text: captives[5],
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
                return {
                    kind: "error",
                    text: captives[6],
                    start,
                    end
                };
            }
            const number = parseInt(digits, base);
            return (
                Number.isSafeInteger(number)
                ? {
                    kind: "number",
                    number,
                    text: captives[6],
                    start,
                    end
                }
                : {
                    kind: "error",
                    text: captives[6],
                    start,
                    end
                }
            );
        }
        if (captives[7]) {
            return {
                kind: "string",
                text: captives[7].slice(1, -1),
                start,
                end
            };
        }
        if (captives[8]) {
            return {
                kind: captives[8],
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
                    kind: "number",
                    number: code_point,
                    text: character,
                    start,
                    end
                }
                : {
                    kind: "error",
                    text: captives[9],
                    start,
                    end
                }
            );
        }
        if (captives[10]) {
            return {
                kind: "error",
                text: captives[10],
                start,
                end
            };
        }
    };
}

//debug const cases = Object.create(null);
//debug cases["123"] = [{
//debug     kind: "number",
//debug     number: 123,
//debug     text: "123",
//debug     start: 0,
//debug     end: 3
//debug }];
//debug cases["16#DEAF123"] = [{
//debug     kind: "number",
//debug     number: 233500963,
//debug     text: "16#DEAF123",
//debug     start: 0,
//debug     end: 10
//debug }];
//debug cases["-8#555"] = [{
//debug     kind: "error",
//debug     text: "-8#555",
//debug     start: 0,
//debug     end: 6
//debug }];
//debug cases["#?"] = [{
//debug     kind: "literal",
//debug     text: "#?",
//debug     start: 0,
//debug     end: 2
//debug }];
//debug cases["#actor_t"] = [{
//debug     kind: "literal",
//debug     text: "#actor_t",
//debug     start: 0,
//debug     end: 8
//debug }];
//debug cases[": \"unterm;stuff"] = [
//debug     {kind: ":", start: 0, end: 1},
//debug     {kind: "space", start: 1, end: 2},
//debug     {kind: "error", text: "\"", start: 2, end: 3},
//debug     {kind: "name", text: "unterm", start: 3, end: 9},
//debug     {kind: "comment", text: "stuff", start: 9, end: 15}
//debug ];
//debug cases["\"stu\"ff\""] = [
//debug     {kind: "string", text: "stu", start: 0, end: 5},
//debug     {kind: "name", text: "ff", start: 5, end: 7},
//debug     {kind: "error", text: "\"", start: 7, end: 8}
//debug ];
//debug cases["😀"] = [
//debug     {kind: "error", text: "😀", start: 0, end: 2}
//debug ];
//debug cases["\"😀\""] = [
//debug     {kind: "string", text: "😀", start: 0, end: 4}
//debug ];
//debug cases["'\\t'"] = [
//debug     {kind: "number", number: 9, text: "\\t", start: 0, end: 4}
//debug ];
//debug cases["'😀'"] = [
//debug     {kind: "number", number: 128512, text: "😀", start: 0, end: 4}
//debug ];
//debug cases["'\n'"] = [
//debug     {kind: "error", text: "'", start: 0, end: 1},
//debug     {kind: "newline", start: 1, end: 2},
//debug     {kind: "error", text: "'", start: 2, end: 3}
//debug ];
//debug Object.entries(cases).forEach(function ([source, expected_tokens]) {
//debug     let generator = tokenize(source);
//debug     let actual_tokens = [];
//debug     while (true) {
//debug         const value = generator();
//debug         if (value.kind === "end of file") {
//debug             break;
//debug         }
//debug         actual_tokens.push(value);
//debug     }
//debug     if (
//debug         JSON.stringify(actual_tokens)
//debug         !== JSON.stringify(expected_tokens)
//debug     ) {
//debug         throw new Error(
//debug             "Bad tokens: "
//debug             + source
//debug             + " ("
//debug             + JSON.stringify(actual_tokens, undefined, 4)
//debug             + ")"
//debug         );
//debug     }
//debug });

export default Object.freeze(tokenize);
