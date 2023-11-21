// A Deno program that runs the project's automated tests.

// It requires permission to spawn subprocesses (--allow-run).
// For brevity, however, it should be safe to run will full permissions like

//  $ deno run -A test.js

/*jslint deno */

import {fromFileUrl} from "https://deno.land/std@0.203.0/path/from_file_url.ts";
const rust_dir_href = import.meta.resolve("./ufork-rust");
const wasm_dir_href = import.meta.resolve("./ufork-wasm");
const asm_runner_href = import.meta.resolve("./ufork-wasm/run_asm_tests.js");

// Run the test runners in parallel, allowing their stdouts to mingle.
// Failure of either runner yields a non-zero exit code.

const rust_runner = Deno.run({
    cmd: ["cargo", "test", "--lib"],
    cwd: fromFileUrl(rust_dir_href)
});
const asm_runner = Deno.run({
    cmd: ["deno", "run", "--allow-read=.", asm_runner_href, "examples", "lib"],
    cwd: fromFileUrl(wasm_dir_href)
});
Promise.all([
    rust_runner.status(),
    asm_runner.status()
]).then(function (statuses) {
    Deno.exit(statuses.reduce(function (a, b) {
        return a.code + b.code;
    }));
});
