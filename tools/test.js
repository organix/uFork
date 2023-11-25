// A Deno program that runs the project's automated tests.

// It requires permission to spawn subprocesses (--allow-run).

/*jslint deno */

import {fromFileUrl} from "https://deno.land/std@0.203.0/path/from_file_url.ts";
const root_dir_href = import.meta.resolve("../");
const rust_dir_href = import.meta.resolve("../vm/rust");
const asm_runner_href = import.meta.resolve("./run_asm_tests.js");

// Run the test runners in parallel, allowing their stdouts to mingle.
// Failure of either runner yields a non-zero exit code.

const rust_runner = Deno.run({
    cmd: ["cargo", "test", "--lib"],
    cwd: fromFileUrl(rust_dir_href)
});
const asm_runner = Deno.run({
    cmd: ["deno", "run", "--allow-read=.", asm_runner_href, "apps", "lib"],
    cwd: fromFileUrl(root_dir_href)
});
Promise.all([
    rust_runner.status(),
    asm_runner.status()
]).then(function (statuses) {
    Deno.exit(statuses.reduce(function (a, b) {
        return a.code + b.code;
    }));
});
