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
most modules contain a demo that can be run manually with
[Replete](https://github.com/jamesdiacono/Replete). A demo should show how the module can be used, whilst also providing a clear indication of whether the
module is functioning correctly.

Each line of a demo begins with `//debug`, a tagged comment ensuring that
the demo does not run in production. When asked to evaluate a module's source
code, Replete has been configured to first use
[ecomcon](https://github.com/douglascrockford/ecomcon/) to remove occurrences
of `//debug` and thus activate the demo. For example, evaluating the following
module with Replete prints `4 doubled is 8`:

    function double(x) {
        return 2 * x;
    }

    //debug console.log("4 doubled is " + double(4));

    export default Object.freeze(double);
