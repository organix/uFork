// A Deno program that runs the automated tests embedded in uFork assembly
// modules. Modules that do not export a "test" entrypoint are ignored.

// Usage:

//      cd ufork-wasm
//      deno run --allow-all run_asm_tests.js [...file_or_directory]

/*jslint deno */

import {toFileUrl, isAbsolute} from "https://deno.land/std@0.111.0/path/mod.ts";
import parseq from "./www/parseq.js";
import pair from "./www/requestors/pair.js";
import requestorize from "./www/requestors/requestorize.js";
import unpromise from "./www/requestors/unpromise.js";
import lazy from "./www/requestors/lazy.js";
import workerize from "./www/requestors/workerize.js";
const asm_test_url = import.meta.resolve("./www/asm_test.js");
const own_directory_url = new URL(import.meta.resolve("./"));

const time_limit = 2000; // milliseconds
const throttle = 20; // number of concurrent Workers

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
    if (directory_url.pathname.endsWith("/lib/unloadable")) {
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

function run_asm_tests(filter_file_urls, root_file_url, web_server_url) {
    return parseq.sequence([
        unpromise(function () {
            return Promise.all(
                filter_file_urls.map(find_asm)
            ).then(function (array_of_arrays) {
                return array_of_arrays.flat();
            });
        }),
        pair(lazy(function (file_url_array) {
            return parseq.parallel(
                [],
                file_url_array.map(function (file_url) {
                    const relative = (
                        "./" + file_url.href.replace(root_file_url.href, "")
                    );
                    const web_url = new URL(relative, web_server_url);
                    return workerize(asm_test_url, web_url.href);
                }),
                time_limit,
                true,
                throttle
            );
        })),
        requestorize(function ([report_array, file_url_array]) {
            const summary = {
                pass: {},
                lost: {},
                fail: {}
            };
            file_url_array.forEach(function (file_url, report_nr) {
                const report = report_array[report_nr];
                const path = file_url.href.replace(file_root_url.href, "");
                if (report === undefined) {
                    summary.lost[path] = [];
                } else if (report.pass === true) {
                    summary.pass[path] = [];
                } else if (report.pass === false) {
                    summary.fail[path] = report.logs;
                }
            });
            return summary;
        })
    ]);
}

let filter_paths = Deno.args;
let web_server_url = new URL("http://localhost:7273/");
let file_root_url = directorify(own_directory_url);

//debug filter_paths = ["/Users/me/code/uFork/ufork-wasm"];
//debug web_server_url = directorify(own_directory_url);
//debug file_root_url = toFileUrl("/Users/me/code/uFork/ufork-wasm/");

run_asm_tests(
    filter_paths.map(function (path) {
        return (
            isAbsolute(path)
            ? toFileUrl(path)
            : new URL(path, file_root_url)
        );
    }),
    file_root_url,
    web_server_url
)(function (summary, reason) {
    if (summary === undefined) {
        throw reason;
    }
    window.console.log(summary);
    return Deno.exit(
        Object.keys(summary.lost).length + Object.keys(summary.fail).length
    );
});

// TODO provide interactive TTY output.

// ANSI TTY control codes.

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
