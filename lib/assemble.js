// uFork assembler.

// It works by tokenizing the source code into token objects and feeding them to
// a parser that produces uFork IR.

import tokenize from "./asm_tokenize.js";
import parse from "./asm_parse.js";

function linecol(string, position) {

// Infer line and column numbers from a position in a string. Everything is
// numbered from zero.

// We should really be working with code points here, not char codes.

    const lines = string.slice(0, position).split("\n");
    const line = lines.length - 1;
    const column = lines.pop().length;
    return {line, column};
}

//debug linecol(`
//debug abc
//debug def
//debug     here I am!
//debug `, 13);

function assemble(text, src) {
    const ast = parse(tokenize(text), src);
    if (ast.errors.length > 0) {
        ast.errors.forEach(function (error) {
            const {line, column} = linecol(text, error.start);
            error.line = line + 1;
            error.column = column + 1;
            if (src !== undefined) {
                error.src = src;
            }
        });
        return {
            errors: ast.errors,
            tokens: ast.tokens
        };
    }
    return {
        lang: "uFork",
        ast
    };
}

//debug assemble(`
//debug a:
//debug     dict boo
//debug     end commit
//debug `, "invalid.asm");

export default Object.freeze(assemble);
