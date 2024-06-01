// A Deno program that runs the project's automated tests.

// It requires permission to spawn subprocesses (--allow-run).

/*jslint deno */

import {fromFileUrl} from "https://deno.land/std@0.203.0/path/from_file_url.ts";
import parseq from "https://ufork.org/lib/parseq.js";
import unpromise from "https://ufork.org/lib/rq/unpromise.js";
const root_dir_href = import.meta.resolve("../");
const rust_dir_href = import.meta.resolve("../vm/rs");
const asm_runner_href = import.meta.resolve("./run_asm_tests.js");

function run(options) {
    return unpromise(function () {
        return Deno.run(options).status().then(function (status) {
            return (
                status.success
                ? Promise.resolve(true)
                : Promise.reject(status)
            );
        });
    });
}

function build() {
    return run({
        cmd: ["deno", "task", "build"],
        cwd: fromFileUrl(root_dir_href)
    });
}

function test_rust() {
    return run({
        cmd: ["cargo", "test", "--lib"],
        cwd: fromFileUrl(rust_dir_href)
    });
}

function test_asm() {
    return run({
        cmd: ["deno", "run", "--allow-read=.", asm_runner_href, "apps", "lib"],
        cwd: fromFileUrl(root_dir_href)
    });
}

// The assembly tests rely on the WASM, so built that first. Building has the
// side effect of choosing a version of cargo, a prerequisite for the Rust
// tests. The tests are run in parallel, allowing their stdouts to mingle.

parseq.sequence([
    build(),
    parseq.parallel([test_rust(), test_asm()])
])(function callback(value) {
    Deno.exit(
        value === undefined
        ? 1
        : 0
    );
});
