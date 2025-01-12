// touchup.js
// James Diacono
// 2025-01-12

// An interactive find & replace tool for text files in large projects.

// Public Domain.

/*jslint deno, global */

const rx_crlf = /\n|\r\n?/;
const ansi_reset = "\u001b[0m";
const ansi_green = "\u001b[32m";
const ansi_red = "\u001b[31m";
const context_size = 10;
const strict_text_decoder = new TextDecoder("utf-8", {fatal: true});

function equal_hunks(a, b) {
    return (
        a.remove === b.remove
        && a.insert === b.insert
        && a.position === b.position
    );
}

function global_prompt(question) {
    const answer = globalThis.prompt(question);
    return (
        typeof answer === "string"
        ? Promise.resolve(answer)
        : Promise.reject("Quit.")
    );
}

function linecol(string) {

// Precompute line and column numbers for each character in a string.
// Everything is numbered from zero.

    let line = 0;
    let column = 0;
    return string.split("").map(function (character) {
        const coordinates = {line, column, character};
        if (character === "\n") {
            line += 1;
            column = 0;
        } else {
            column += 1;
        }
        return coordinates;
    });
}

function read_text_file(text_file) {

// Read a file as text. If the file can not be decoded as UTF-8, the returned
// Promise resolves to undefined.

    return Deno.readFile(text_file).then(function (bytes) {
        try {
            return strict_text_decoder.decode(bytes);
        } catch (_) {}
    }).catch(function (error) {
        return (
            error.code === "EISDIR"
            ? Promise.resolve()
            : Promise.reject(error)
        );
    });
}

function read_path_file(path_file) {
    return Deno.readTextFile(path_file).then(function (string) {
        return string.trim().split(rx_crlf);
    });
}

function read_touchup_file(touchup_file) {
    return Deno.readTextFile(touchup_file).catch(function () {
        return "{}";
    }).then(
        JSON.parse
    );
}

function write_touchup_file(touchup_file, touchups_by_file) {
    return Deno.writeTextFile(
        touchup_file,
        JSON.stringify(touchups_by_file, undefined, 4)
    );
}

function no_style(string) {
    return string;
}

function prepare(
    path,
    text,
    prior_touchups,
    diff,
    removal_style = no_style,
    addition_style = no_style,
    prompt = global_prompt
) {

// Begin asking the user which hunks to stage.

    const coordinates = linecol(text);
    const lines = text.split(rx_crlf);
    let touchups = {};
    return (function choose(hunk_array) {
        if (hunk_array.length === 0) {
            return touchups;
        }
        const hunk = hunk_array[0];
        const prior_touchup = prior_touchups[hunk.position];
        if (
            prior_touchup?.stage !== undefined
            && equal_hunks(hunk, prior_touchup.hunk)
        ) {

// The user has already decided what to do with this hunk.

            touchups[hunk.position] = prior_touchup;
            return choose(hunk_array.slice(1));
        }
        const line_nr = coordinates[hunk.position].line;
        const prefix = lines[line_nr].slice(
            0,
            coordinates[hunk.position].column
        );
        const suffix = lines[line_nr].slice(
            coordinates[hunk.position + hunk.remove.length].column
        );
        const before = (
            line_nr > 0
            ? lines.slice(
                Math.max(0, line_nr - context_size),
                line_nr
            )
            : []
        ).map(function (line) {
            return " " + line;
        });
        const remove = removal_style("-" + prefix + hunk.remove + suffix);
        const add = addition_style("+" + prefix + hunk.insert + suffix);
        const after = lines.slice(
            line_nr + 1,
            line_nr + 1 + context_size
        ).map(function (line) {
            return " " + line;
        });
        const question = [
            path + ":" + (line_nr + 1),
            ...before,
            remove,
            add,
            ...after,
            "Accept this hunk [y,n,q,a,d,j,?]?"
        ].join(
            "\n"
        );
        return prompt(question).then(function handle_answer(answer) {
            if (answer === "q") {
                return Promise.reject("Quit.");
            }
            if (answer === "y" || answer === "a") {
                if (answer === "a") {
                    prompt = function always_y() {
                        return Promise.resolve("y");
                    };
                }
                touchups[hunk.position] = {
                    hunk,
                    stage: true
                };
                return choose(hunk_array.slice(1));
            }
            if (answer === "n" || answer === "d") {
                if (answer === "d") {
                    prompt = function always_n() {
                        return Promise.resolve("n");
                    };
                }
                touchups[hunk.position] = {
                    hunk,
                    stage: false
                };
                return choose(hunk_array.slice(1));
            }
            if (answer === "j") {
                touchups[hunk.position] = {hunk};
                return choose(hunk_array.slice(1));
            }
            return prompt(
                "y - stage this hunk"
                + "\nn - do not stage this hunk"
                + "\nq - quit; do not stage this hunk or any others"
                + "\na - stage this hunk and all later hunks in the file"
                + "\nd - do not stage this hunk or any of the later hunks"
                + "\nj - leave this hunk undecided, see next undecided hunk"
                + "\n? - print help"
                + "\n" + question
            ).then(handle_answer);
        });
    }(diff(text, path)));
}

function prepare_all(path_file, touchup_file, diff) {
    return Promise.all([
        read_path_file(path_file),
        read_touchup_file(touchup_file)
    ]).then(function prepare_next([paths, touchups_by_file]) {
        const text_file = paths[0];
        if (text_file !== undefined) {
            return read_text_file(text_file).then(function (text) {
                return (
                    typeof text === "string"
                    ? prepare(
                        text_file,
                        text,
                        touchups_by_file[text_file] ?? {},
                        diff,
                        function removal_style(string) {
                            return ansi_red + string + ansi_reset;
                        },
                        function addition_style(string) {
                            return ansi_green + string + ansi_reset;
                        }
                    )
                    : {}
                );
            }).then(function (touchups) {
                touchups_by_file[text_file] = (
                    Object.values(touchups).length > 0
                    ? touchups
                    : undefined
                );
                return write_touchup_file(touchup_file, touchups_by_file);
            }).then(function () {
                return prepare_next([
                    paths.slice(1),
                    touchups_by_file
                ]);
            });
        }
    });
}

function sort_hunks(hunks) {
    return hunks.slice().sort(function (a, b) {
        return a.position - b.position;
    });
}

function patch(text, hunks) {
    let position = 0;
    return sort_hunks(hunks).map(function (hunk) {
        const remove = text.slice(
            hunk.position,
            hunk.position + hunk.remove.length
        );
        if (remove !== hunk.remove) {
            throw new Error("Failed to apply hunk.");
        }
        const chunk = text.slice(position, hunk.position) + hunk.insert;
        position = hunk.position + hunk.remove.length;
        return chunk;
    }).concat(
        text.slice(position)
    ).join(
        ""
    );
}

function apply_touchups(text, touchups) {
    const undecided = Object.values(touchups).filter(function (touchup) {
        return touchup.stage === undefined;
    });
    if (undecided.length > 0) {
        throw new Error("Hunk undecided.");
    }
    const hunks = Object.values(touchups).filter(function (touchup) {
        return touchup.stage;
    }).map(function (touchup) {
        return touchup.hunk;
    });
    return patch(text, hunks);
}

function apply_all(path_file, touchup_file) {
    return Promise.all([
        read_path_file(path_file),
        read_touchup_file(touchup_file)
    ]).then(function apply_next([paths, touchups_by_file]) {
        const text_file = paths[0];
        if (text_file !== undefined) {
            const touchups = touchups_by_file[text_file] ?? {};
            const has_staged = Object.values(touchups).some(function (touchup) {
                return touchup.stage === true;
            });
            return (
                has_staged
                ? read_text_file(text_file).then(function (text) {
                    if (typeof text === "string") {
                        return Deno.writeTextFile(
                            text_file,
                            apply_touchups(text, touchups)
                        );
                    }
                })
                : Promise.resolve()
            ).then(function () {
                return apply_next([
                    paths.slice(1),
                    touchups_by_file
                ]);
            });
        }
    });
}

if (import.meta.main) {
    const text = "big fat hen";
    prepare(
        "/path/to/chicken.js",
        text,
        {
            "/path/to/chicken.js": {
                "0": {
                    hunk: {remove: "big", insert: "HUGE", position: 0},
                    stage: true
                },
                "8": {
                    hunk: {remove: "does_not_apply", insert: "x", position: 8},
                    stage: true
                }
            }
        },
        function diff() {
            return [
                {remove: "big", insert: "HUGE", position: 0},
                {remove: "fat", insert: "strong", position: 4},
                {remove: "hen", insert: "chook", position: 8}
            ];
        }
    ).then(function (touchups) {
        return globalThis.console.log(apply_touchups(text, touchups));
    });
}

export default Object.freeze({prepare_all, apply_all});
