// A Deno program that builds the debug and release uFork WASM binaries.

// It requires permission to spawn subprocesses (--allow-run) and to read and
// write this directory. For brevity, however, it can be run with full
// permissions like

//  $ deno run -A build.js [--opt]

// Pass the --opt flag to produce a highly optimized release build.

// The Rust compiler requires a C++ compiler to be installed. On Windows, this
// requires several gigabytes of build tools from Microsoft.
// See https://stackoverflow.com/a/69788132.
// Alternatively, install the GNU toolchain described at
// https://rust-lang.github.io/rustup/installation/windows.html.

/*jslint deno */

import {fromFileUrl} from "https://deno.land/std@0.203.0/path/from_file_url.ts";
import parseq from "https://ufork.org/lib/parseq.js";
import unpromise from "https://ufork.org/lib/rq/unpromise.js";
const wasm_dir_url = new URL(import.meta.resolve("./"));
const dot_cargo_url = new URL(import.meta.resolve("./.cargo"));
const wasm_opt_bin_url = new URL(import.meta.resolve("./.cargo/bin/wasm-opt"));
const target_debug_wasm_url = new URL(import.meta.resolve(
    "./target/wasm32-unknown-unknown/debug/ufork_wasm.wasm"
));
const target_release_wasm_url = new URL(import.meta.resolve(
    "./target/wasm32-unknown-unknown/release/ufork_wasm.wasm"
));
const www_debug_wasm_url = new URL(import.meta.resolve("./ufork.debug.wasm"));
const www_release_wasm_url = new URL(import.meta.resolve("./ufork.wasm"));

function run(...cmd) {
    return unpromise(function () {
        return Deno.run({
            cmd,
            cwd: fromFileUrl(wasm_dir_url)
        }).status().then(function (status) {
            return (
                status.success
                ? Promise.resolve(true)
                : Promise.reject(status)
            );
        });
    });
}

function cp(from, to) {
    return unpromise(function () {
        return Deno.copyFile(from, to);
    }, true);
}

function log_size(file_url) {
    return unpromise(function () {
        return Deno.stat(file_url).then(function (info) {
            const name = file_url.pathname.split("/").pop();
            const kilobytes = Math.round(info.size / 1000) + "K";
            window.console.log(kilobytes, name);
        });
    }, true);
}

const optimize = Deno.args[0] === "--opt";

function build_debug() {
    return parseq.sequence([
        run("cargo", "build"),
        cp(target_debug_wasm_url, www_debug_wasm_url),
        log_size(www_debug_wasm_url)
    ]);
}

function build_release() {
    return (
        optimize
        ? parseq.sequence([
            run(
                "cargo",
                "build",
                "--release",

// Build a custom std with only the components needed.

                "-Z",
                "build-std=core,alloc,panic_abort",

// Disables panic format generation, immediately abort instead.

                "-Z",
                "build-std-features=panic_immediate_abort"
            ),
            cp(target_release_wasm_url, www_release_wasm_url),
            run(
                fromFileUrl(wasm_opt_bin_url),
                "-Oz", // optimize for code size
                "--output",
                fromFileUrl(www_release_wasm_url),
                fromFileUrl(target_release_wasm_url)
            ),
            log_size(www_release_wasm_url)
        ])
        : parseq.sequence([
            run("cargo", "build", "--release"),
            cp(target_release_wasm_url, www_release_wasm_url),
            log_size(www_release_wasm_url)
        ])
    );
}

// Configure the build environment, then build.

let tasks = [];
if (optimize) {

// Only nightly Rust allows the use of -Z.

    tasks.push(run("rustup", "default", "nightly-2023-10-09"));

// Install the wasm-opt binary into .cargo.

    tasks.push(run(
        "cargo",
        "install",
        "--root",
        fromFileUrl(dot_cargo_url),
        "wasm-opt"
    ));
} else {
    tasks.push(run("rustup", "default", "1.81.0"));
}
tasks.push(run("rustup", "target", "add", "wasm32-unknown-unknown"));
tasks.push(parseq.parallel([
    build_debug(),
    build_release()
]));
parseq.sequence(tasks)(function callback(value, reason) {
    if (value === undefined) {
        window.console.error(reason);
        Deno.exit(1);
    }
});
