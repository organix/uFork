// A Deno program that runs the automated tests embedded in uFork assembly
// modules. Modules that do not export a "test" entrypoint are ignored.

// Usage:

//  $ deno run --allow-read=.. run_asm_tests.js [...file_or_directory]

/*jslint deno */

import {toFileUrl} from "https://deno.land/std@0.203.0/path/to_file_url.ts";
import {isAbsolute} from "https://deno.land/std@0.203.0/path/is_absolute.ts";
import parseq from "https://ufork.org/lib/parseq.js";
import pair from "https://ufork.org/lib/rq/pair.js";
import infallible from "https://ufork.org/lib/rq/infallible.js";
import requestorize from "https://ufork.org/lib/rq/requestorize.js";
import unpromise from "https://ufork.org/lib/rq/unpromise.js";
import lazy from "https://ufork.org/lib/rq/lazy.js";
import asm_test from "./asm_test.js";

const time_limit = 10 * 1000; // milliseconds

function iterate(iterable) {
    const iterator = iterable[Symbol.asyncIterator]();
    let values = [];
    return iterator.next().then(
        function more({done, value}) {
            if (done) {
                return values;
            }
            values.push(value);
            return iterator.next().then(more);
        }
    );
}

function directorify(url) {
    return (
        url.href.endsWith("/")
        ? url
        : new URL(url.href + "/")
    );
}

function is_asm(url) {
    return url.href.endsWith(".asm");
}

function find_asm_in_directory(directory_url) {
    if (directory_url.pathname.endsWith("/unloadable")) {
        return Promise.resolve([]);
    }
    return iterate(Deno.readDir(directory_url)).then(function (entries) {
        return Promise.all(entries.map(function ({name, isDirectory}) {
            const entry_url = new URL(name, directorify(directory_url));
            return (
                isDirectory
                ? find_asm_in_directory(entry_url)
                : (
                    is_asm(entry_url)
                    ? [entry_url]
                    : []
                )
            );
        }));
    }).then(function (array) {
        return array.flat();
    });
}

function find_asm(url) {
    return Deno.stat(url).then(function ({isDirectory}) {
        return (
            isDirectory
            ? find_asm_in_directory(url)
            : (
                is_asm(url)
                ? [url]
                : []
            )
        );
    });
}

function run_asm_tests(url_filters, root_file_url) {
    return parseq.sequence([
        unpromise(function () {
            return Promise.all(
                url_filters.map(find_asm)
            ).then(function (array_of_arrays) {
                return array_of_arrays.flat();
            });
        }),
        pair(lazy(function (file_url_array) {
            return parseq.parallel(
                file_url_array.map(function (file_url) {
                    return infallible(parseq.sequence(
                        [asm_test(file_url.href)],
                        time_limit
                    ));
                })
            );
        })),
        requestorize(function ([outcome_array, file_url_array]) {
            const summary = {
                pass: {},
                lost: {},
                fail: {}
            };
            file_url_array.forEach(function (file_url, report_nr) {
                const path = file_url.href.replace(root_file_url.href, "");
                const outcome = outcome_array[report_nr];
                const report = outcome.value;
                if (report === undefined) {
                    summary.lost[path] = [outcome.reason];
                } else {
                    if (report.pass === true) {
                        summary.pass[path] = [];
                    } else if (report.pass === false) {
                        summary.fail[path] = report.logs;
                    }
                }
            });
            return summary;
        })
    ]);
}

let path_filters = Deno.args;
let file_root_url = directorify(toFileUrl(Deno.cwd()));

//debug path_filters = ["/Users/me/code/uFork"];
//debug file_root_url = toFileUrl("/Users/me/code/uFork/");

run_asm_tests(
    path_filters.map(function (path) {
        return (
            isAbsolute(path)
            ? toFileUrl(path)
            : new URL(path, file_root_url)
        );
    }),
    file_root_url
)(function (summary, reason) {
    if (summary === undefined) {
        throw reason;
    }
    window.console.log(summary);
    return Deno.exit(
        Object.keys(summary.lost).length + Object.keys(summary.fail).length
    );
});

// Possible improvement: provide interactive TTY output.

// ANSI TTY control codes:

// const ESC = "\u001B[";
// const CLEAR_SCREEN = "2J";
// const HOME = "H";

// function tty(string) {
//     return Deno.stdout.write(new TextEncoder().encode(string));
// }

// if (Deno.isatty(Deno.stdout.rid)) {
//     console.log("TTY");
//     tty(ESC + CLEAR_SCREEN + ESC + HOME + "text\n");
//     setTimeout(console.log, 5000);
// }
