# uFork assembly language

This document describes a textual assembly language for uFork.
[uFork](https://github.com/organix/uFork) is a pure-actor virtual machine with
object-capabilities and memory-safety.

## An example

    ; A fibonnacci service behavior.

    ; It expects a message containing a customer and a fixnum. The nth
    ; fibonnacci number is calculated and sent to the customer.

    .import
        std: "./std.asm"

    beh:                    ; () <- (cust n)
        msg 2               ; n
        dup 1               ; n n
        push 2              ; n n 2
        cmp lt              ; n n<2
        if std.cust_send    ; n

        msg 1               ; n cust
        push k              ; n cust k
        new -1              ; n k.cust

        pick 2              ; n k n
        push 1              ; n k n 1
        alu sub             ; n k n-1
        pick 2              ; n k n-1 k
        push beh            ; n k n-1 k beh
        new 0               ; n k n-1 k fib.()
        send 2              ; n k

        roll 2              ; k n
        push 2              ; k n 2
        alu sub             ; k n-2
        roll 2              ; n-2 k
        push beh            ; n-2 k beh
        new 0               ; n-2 k fib.()
        send 2              ;
        ref std.commit

    k:                      ; cust <- m
        state 0             ; cust
        msg 0               ; cust m
        push k2             ; cust m k2
        beh 2               ; k2.(cust m)
        ref std.commit

    k2:                     ; (cust m) <- n
        state 2             ; m
        msg 0               ; m n
        alu add             ; m+n
        state 1             ; m+n cust
        ref std.send_msg

    .export
        beh

## Overview

In many ways, the language is similar to traditional assembly languages:

- At the top level it has directives (such as `.import`), labels and statements.
- Each statement consists of an operator followed by its operands.
- Linear execution is expressed by writing instruction statements one after
  another.
- A semicolon (`;`) marks the remainder of the line as a comment. Blank lines
  and comments may be injected between any two lines.

In some ways, however, it is quite different:

- Code is always within a module. Imports and exports are declared explicitly.
  There is potential for modules to be fetched from the filesystem or via the
  network.
- Statements always produce a value. Often the value is an instruction, but it
  can also be a literal, number, or data structure. Values are immutable. Data
  structures can contain instructions.
- By convention, end-of-line comments often show a picture of the stack
  after an instruction executes, to clarify the effect. The top of the stack
  is the right-most element.

## Statements

Statements begin with an operator (such as `alu`), followed by zero or more
operands. An operand is either an enumeration (such as `sub`) or an expression
(such as `2` or `std.commit`). Statements are indented by at least one space.

Each statement may be preceeded by one or more labels (and the first statement
must be). Labels are not indented. Labels within a module must have unique
names.

## Expressions

Expressions appear only in operand position.

There are five _literal_ values:

- `#?` (undef)
- `#nil`
- `#unit`
- `#t` (true)
- `#f` (false)

_Fixnums_ are signed integers that fit within a single machine word, for example
`-1000` or `7`.

All values have a _type_, queryable with the `typeq` instruction. The following
types are currently supported:

- `#literal_t`
- `#fixnum_t`
- `#type_t`
- `#pair_t`
- `#dict_t`
- `#instr_t`
- `#actor_t`

Values can also be referenced by name. In singular form, _name_ expressions
refer to a labelled statement within the current module. This was used in the
introductory example to push the instruction labelled `beh` onto the stack:

    push beh

Names may not contain spaces, periods, colons, or semicolons. Names may not
start with "#" or a digit. Names may end in a "?" to indicate predicates. The
following are all valid names:

- `send_0`
- `CONT_ID`
- `is_nil?`
- `take-2nd`

There is also a compound form, which refers to an imported value. A period
separates the module name from the import name:

    if std.cust_send

## Ref

The _ref_ statement takes an expression as its operand and produces the value of
that expression.

 Operator    | First operand
-------------|----------------
`ref`        | _expression_

_ref_ allows expressions to be labelled, for example

    my_alias:
        ref my_import.an_inconveniently_long_name

    magic_number:
        ref 42

It also provides an alternative way to continue to a named instruction. The
following are equivalent:

    explicit_k:
        typeq #fixnum_t my_continuation

    implicit_k:
        typeq #fixnum_t
        ref my_continuation

## Instructions

The following table just describes the syntax of instruction statements. Refer
to the [instruction set](ufork-wasm/vm.md#instructions)
for a detailed description of each instruction, including how they manipulate
the stack.

 Operator    | First operand                                 | Second operand
-------------|-----------------------------------------------|------------------
`typeq`      | _type_                                        | [_k_]
`dict`       | `has`/`get`/`add`/`set`/`del`                 | [_k_]
`deque`      | `new`/`empty`/`push`/`pop`/`put`/`pull`/`len` | [_k_]
`pair`       | _n_                                           | [_k_]
`part`       | _n_                                           | [_k_]
`nth`        | _n_                                           | [_k_]
`push`       | _value_                                       | [_k_]
`depth`      | [_k_]                                         |
`drop`       | _n_                                           | [_k_]
`pick`       | _n_                                           | [_k_]
`dup`        | _n_                                           | [_k_]
`roll`       | _n_                                           | [_k_]
`alu`        | `not`/`and`/`or`/`xor`/`add`/`sub`/`mul`      | [_k_]
`eq`         | _value_                                       | [_k_]
`cmp`        | `eq`/`ge`/`gt`/`lt`/`le`/`ne`                 | [_k_]
`msg`        | _n_                                           | [_k_]
`state`      | _n_                                           | [_k_]
`my`         | `self`/`beh`/`state`                          | [_k_]
`send`       | _n_                                           | [_k_]
`new`        | _n_                                           | [_k_]
`beh`        | _n_                                           | [_k_]
`end`        | `abort`/`stop`/`commit`/`release`             |
`is_eq`      | _expect_                                      | [_k_]
`is_ne`      | _expect_                                      | [_k_]
`if`         | _t_                                           | [_f_]
`if_not`     | _f_                                           | [_t_]

Every instruction (except `end`) takes a continuation (_k_, _f_, or _t_) as its
final operand. In the following example, the `msg` instruction continues to
the `end` instruction.

    beh:
        msg 1 done
    done:
        end commit

But it is not necessary to label every instruction, because the last
continuation operand defaults to the next instruction when omitted. The same
two instructions could more easily be written

    beh:
        msg 1
        end commit

In contrast to traditional assembly languages, instructions will not continue
through a label. This means that it is not possible to write

    beh:
        msg 1
    done:
        end commit

## Data

The `pair_t` and `dict_t` statements construct data structures from their
operands.

 Instruction | First operand    | Second operand    | Third operand
-------------|------------------|-------------------|---------------------------
`pair_t`     | _head_           | [_tail_]          |
`dict_t`     | _key_            | _value_           | [_next_]

Like with instructions, the final operand defaults to the next statement when
omitted. In the following example, `a` is a list of three elements, `0`, `1`,
and `2`.

    a:
        pair_t 0
        pair_t 1
        pair_t 2
        ref #nil

Pairs do not have to construct lists. Here, `b` is a pair that simply holds the
values true and false.

    b:
        pair_t #t #f

Here, `c` is a dictionary containing entries `0: false` and `true: 1`.

    c:
        dict_t 0 #f
        dict_t #t 1
        ref #nil

## Grammar

The grammar is written in
[McKeeman form](https://www.crockford.com/mckeeman.html).

Each source unit consists of a single _module_. A _module_ may begin with
comments or blank lines. It must contain at least one labelled _statement_,
declare at least one _export_, and end in a newline character.

    module
        maybe_newlines import_declaration definitions export_declaration

The _import_declaration_, _definitions_ and _export_declaration_ are all
optional.

    import_declaration
        ""
        ".import" newlines imports

    imports
        import
        import imports

    import
        indent name ':' spaces '"' specifier '"' newlines

    specifier
        nonquote
        nonquote specifier

    nonquote
        character - '"'

    definitions
        ""
        definition definitions

    definition
        labels statements

    labels
        label
        label labels

    label
        name ':' newlines

    statements
        statement
        statement statements

    statement
        indent operator operands newlines

    operator
        azs
        azs '_' operator

    azs
        az
        az azs

    az
        'a' . 'z'

    operands
        ""
        spaces value operands

    value
        literal
        fixnum
        type
        ref

    literal
        undef
        nil
        unit
        true
        false

    undef
        "#?"

    nil
        "#nil"

    unit
        "#unit"

    true
        "#t"

    false
        "#f"

    fixnum
        '-' one_to_nine
        '-' one_to_nine digits
        base_ten
        base_ten '#' base_any
        quote character_literal quote

    base_ten
        digit
        one_to_nine digits

    digits
        digit
        digit digits

    digit
        '0'
        one_to_nine

    one_to_nine
        '1' . '9'

    base_any
        alphameric
        alphameric base_any

    character_literal
        "\b"
        "\t"
        "\n"
        "\r"
        "\'"
        "\\"
        character - quote - '\'

    quote
        '0027'

    type
        "#literal_t"
        "#fixnum_t"
        "#type_t"
        "#pair_t"
        "#dict_t"
        "#instr_t"
        "#actor_t"

    ref
        name
        name '.' name

Unicode names are not currently supported due to the security concerns described
at http://cweb.github.io/unicode-security-guide/, but if support were to be
added it would build on the XID_Start and XID_Continue classes mentioned in
https://unicode.org/reports/tr31/.

    name
        alpha trailing

    trailing
        ""
        '?'
        '_' alphameric trailing
        '-' alphameric trailing
        alphameric trailing

    alphameric
        alpha
        digit

    alpha
        'a' . 'z'
        'A' . 'Z'

The module must declare at least one export.

    export_declaration
        ""
        ".export" newlines exports

    exports
        export
        export exports

    export
        indent name newlines

A line may end in a comment. A line may be followed by any number of blank lines
or comment lines.

    maybe_newlines
        ""
        newlines

    newlines
        newline
        newline newlines

    newline
        crlf
        maybe_spaces ';' maybe_comment crlf

    crlf
        '000D' '000A'
        '000A'
        '000D'

    maybe_spaces
        ""
        spaces

    maybe_comment
        ""
        comment

    comment
        nonspace
        character comment

    nonspace
        character - ' '

    character
        '0020' . '007E'
        '00A0' . '10FFFF'

    indent
        spaces

    spaces
        space
        space spaces

    space
        '0020'
