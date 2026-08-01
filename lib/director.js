//
// Director - An Actor Scripting Language
//

/*jslint global, long, bitwise */

import tokenize from "./dir_tokenize.js";
import parse from "./dir_parse.js";

// function compile_json(text, src) {
//     try {
//         return JSON.parse(text);
//     } catch (exception) {
//         return {
//             lang: "uFork",
//             ast: {
//                 kind: "module",
//                 import: {},
//                 define: {},
//                 export: []
//             },
//             tokens: [],
//             errors: [{
//                 kind: "error",
//                 code: "bad_json",
//                 message: exception.message,
//                 start: 0,
//                 end: 0,
//                 line: 1,
//                 column: 1,
//                 src
//             }]
//         };
//     }
// }

function compile(text, src) {
    const import_map = {};
    const module_env = {};
    const export_list = [];
    const errors = [];

    const ast = {tokens: tokenize(text, src)};
    // const ast = parse(text, src);
    return {
        lang: "uFork",
        ast: {
            kind: "module",
            import: import_map,
            define: module_env,
            export: export_list
        },
        tokens: ast.tokens,
        errors
    };
}

// if (import.meta.main) {
//     test_compile();
// }

export default Object.freeze({tokenize, parse, compile});
