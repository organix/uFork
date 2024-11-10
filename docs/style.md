# Programming style for the uFork project

## All languages

Indentation is 4 spaces.

Use Unix style line endings (`\n`). Ensure files end with a newline.

Use snake case for identifiers and file names.

    // Good
    u_fix_to_i32

    // Bad
    uFixToI32
    ufixtoi32
    u-fix-to-i32

When describing uFork pair-based data structures, use Scheme list-notation.
A dot surrounded by whitespace separates the two components of a pair.
A list formed from pairs may be abbreviated such that `(a b c)` is equivalent
to `(a . (b . (c . ())))`. A _dotted-tail_ denotes the rest of the list.

    (first second . rest) = -->[*,*]-->[*,*]--> rest
                                |       |
                                V       V
                              first   second

## JavaScript

TL;DR use JSLint (https://github.com/jamesdiacono/JSLint).

Respect the 80 character line limit.

ES modules (i.e. `import`/`export`) only. No CommonJS (i.e. `require`). Freeze
the default exportation. Avoid named exports. No NPM dependencies, although
Deno's standard library (https://deno.land/std) may be used for Deno programs.

    // Good
    import assemble from "./assemble.js";
    import {toFileUrl} from "https://deno.land/std@0.203.0/path/to_file_url.ts";
    export default Object.freeze(assemble);
    export default Object.freeze({assemble, disassemble});

    // Bad
    const assemble = require("./assemble.js");
    import assemble from "assemble";
    export {assemble, disassemble};
    export const disassemble = ...;

Non-library modules should use absolute URLs to import library modules.

    // Good
    import assemble from "https://ufork.org/lib/assemble.js";

    // Bad
    import assemble from "../../../lib/assemble.js";

Where possible, write modules that run in both Deno and the browser.

Prefer named functions to fat arrow functions.

    // Good
    function double(n) {
        return 2 * n;
    }

    // Bad
    const double = (n) => 2 * n;
    const double = function (n) {
        return 2 * n;
    };

Do not pad the braces of object literals.

    // Good
    return {a, b, c};

    // Bad
    return { a, b, c };

Avoid `switch`, prefer `else if`.

    // Good
    if (fruit === "orange") {
        // ...
    } else if (fruit === "apple") {
        // ...
    } else {
        // ...
    }

    // Bad
    switch (fruit) {
        case "orange":
            // ...
            break;
        case "apple":
            // ...
            break;
        default:
            // ...
            break;
    }

Wrap ternary conditional in parens
and place each sub-expression on its own line.

    return (
        (the_token.id === "(string)" || the_token.id === "(number)")
        ? String(the_token.value)
        : the_token.id
    );

Avoid `for` loops, prefer array methods or a `while` loop.

    let strings = ["1.2", "3.4"];

    // Good
    return strings.map(Number);

    // Bad
    let numbers = [];
    for (let i = 0; i < strings.length; i++) {
        numbers.push(Number(strings[i]));
    }
    return numbers;

Avoid `async`/`await`, prefer requestors or Promises.

Avoid `function*`, `yield`, etc.

    // Good
    function make_counter(value) {
        return function () {
            value += 1;
            return value;
        };
    }
    const gen = counter(0);
    gen()               // 1
    gen()               // 2
    gen()               // 3

    // Bad
    function* counter(value) {
        while (true) {
            value += 1;
            yield value;
        }
    }
    const gen = counter(0);
    gen.next().value    // 1
    gen.next().value    // 2
    gen.next().value    // 3

Avoid `class` and `this`.

    // Good
    function make_counter(value) {
        return Object.freeze({
            up() {
                value += 1;
                return value;
            },
            down() {
                value -= 1;
                return value;
            }
        });
    }
    const counter = make_counter(5);
    const up = counter.up;
    up(); // 6;

    // Bad
    class Counter {
        constructor(value) {
            this._value = value;
        }
        up() {
            this._value += 1;
            return this._value;
        }
        down() {
            this._value += 1;
            return this._value;
        }
    }
    const counter = new Counter(5);
    const up = counter.up;
    up(); // NaN

Avoid `null`, prefer `undefined`.

    // Good
    let my_variable;
    return;

    // Bad
    let my_variable = null;
    return null;

Avoid `instanceof`.

    // Good
    const is_array = Array.isArray(value);

    // Bad
    const is_array = value instanceof Array;

Avoid `Proxy` and getter/setters, prefer methods.

## Verilog

Forbid implicit signal declaration  by including the following directive before
any code:

    `default_nettype none

Prefix input signals with `i_`, output signals with `o_`.

    module foo (
        input                   i_clk,                      // system clock
        input             [3:0] i_op,                       // operation selector
        output            [9:0] o_data                      // result value
    );

Always use a `begin`/`end` block, even when it is not required.

    // Good
    if (i_wr_en) begin
        mem[i_waddr] <= i_wdata;
    end

    // Bad
    if (i_wr_en)
        mem[i_waddr] <= i_wdata;

Do not indent `begin`/`end` blocks. Instead, keep `begin` on the preceeding
line, for example:

    // Good
    always @(posedge i_clk) begin
        ...
    end

    // Bad
    always @(posedge i_clk)
        begin
            ...
        end

    // Good
    case (i_op)
        `NO_OP: begin
            o_data <= i_arg0;
        end
        `ADD_OP: begin
            o_data <= i_arg0 + i_arg1;
        end
        `SUB_OP: begin
            o_data <= i_arg0 - i_arg1;
        end
        ...

    // Bad
    case (i_op)
        `NO_OP:
            o_data <= i_arg0;
        `ADD_OP:
            o_data <= i_arg0 + i_arg1;
        `SUB_OP:
            o_data <= i_arg0 - i_arg1;
        ...

Initialize registers where they are declared, unless the declaration appears in
the signal list.

    // Good
    reg [9:0] divider = 0;

    // Bad
    reg [9:0] divider;
    initial divider = 0;

Avoid `always @(*)`.

Begin end-of-line comments at the tabstop at position 57.
Align middle-column (if needed) at position 29.

    // Good
        localparam UC_NOP = 16'h0000;                       // ( -- )
        localparam UC_NOP       = 16'h0000;                 // ( -- )

    // Bad
        localparam UC_NOP       = 16'h0000;                     // ( -- )
        localparam UC_NOP   = 16'h0000; // ( -- )

## Assembly

Include a stack diagram that shows the state of the stack after each instruction
is executed. Align the comments to the tabstop at position 29.

    push c                      ; c
    drop 1                      ; --
    push a                      ; a
    push b                      ; a b

In the stack diagram, label values as they are pushed onto the stack:

    push 1000                   ; a=1000
    push 2000                   ; a b=2000
    pair 1                      ; c=(b . a)

In the stack diagram, depict actor creation like `beh.state`:

    push example_beh            ; (a . b) example_beh
    actor create                ; example=example_beh.(a . b)

At the entry point of each behavior, show the signature of the state and
message like `state <- msg`. For example:

    my_beh:                     ; (count . limit) <- (cust selector . rest)

If the module represents a behavior, the behavior's export should be named
`beh`.

Non-library modules should use absolute URLs to import library modules.

    ; Good
    .import
        std: "https://ufork.org/lib/std.asm"

    ; Bad
    .import
        std: "../../../lib/std.asm"
