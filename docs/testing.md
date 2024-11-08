# Testing

To run the project's automated tests, run `deno task test`.

The remainder of this document describes the testing frameworks and conventions
used within the uFork project. Where possible, tests are embedded alongside the
relevant source code rather than being split into separate files.

## Assembly

Eligible modules export a `test` entrypoint, for example:

     test:                       ; judge <- {caps}
         push #f                 ; #f
         state 0                 ; #f judge
         ref std.send_msg        ; FAIL!

     .export
         test

The `judge` capability is sent the outcome of the test. Any value other than
`#t` is considered a failure, and reported to the user.

To run only the automated tests for assembly, run

    deno run --allow-read=. tools/run_asm_tests.js <path...>

Any module that does not contain a `test` entrypoint is skipped. Tests can also
be run individually in the playground.

## Rust

To run only the automated tests for Rust, run

    cargo test --lib

from the ../vm/rs directory.

## JavaScript

Currently, there are no automated tests for our JavaScript modules. However,
most modules contain a demo that can be run manually using
[Replete](https://github.com/jamesdiacono/Replete). A demo should show how the
module can be used, whilst also providing a clear indication of whether the
module is functioning correctly.

Demos will only be run when `import.meta.main` is `true`. For example,
evaluating the following module using Replete (or running it via `deno run`)
prints `4 doubled is 8`:

    function double(x) {
        return 2 * x;
    }

    if (import.meta.main) {
        globalThis.console.log("4 doubled is " + double(4));
    }

    export default Object.freeze(double);

In demos, qualify all calls to `console.log` with `globalThis`. This reassures
JSLint that the call has not been accidentally left behind following a debugging
session.
