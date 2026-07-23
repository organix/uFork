# Director - An Actor Scripting Language

_Director_ is a simple actor scripting language
that provides a surface-syntax for **uFork** programs.
A compiler toolchain (written in JavaScript)
generates loadable [IR](ir.md)
just like [ASM](asm.md) does.

## Language Syntax

### Built-In Constants

Syntax      | Meaning
------------|--------
`?`         | undefined value
`True`      | boolean **true** value
`False`     | boolean **false** value
`Null`      | type of undefined
`Boolean`   | boolean type (`True` and `False`)
`Number`    | number type
`Text`      | text type
`List`      | list type
`Dict`      | dictionary type
`Actor`     | actor address type
`Script`    | script type
`Type`      | type of types

### `Number` Literals

Syntax      | Examples
------------|--------
<_sign_><_digits_> | 0 12 -345 +6_789
<_base_>`#`<_digits_> | 16#C0de 2#1100_0000_1101_1110

### `Text` Literals

Syntax      | Examples
------------|--------
`"`<_characters_>`"` | "" "foo" "1st" "Say less." "a line of text\n"

### `List` Literals

Syntax      | Examples
------------|--------
`[`<_expr_>`, ` ...`]` | [] [?, True, 42, "foo"]

### `Dict` Literals

Syntax      | Examples
------------|--------
`{`<_expr_>`: `<_expr_>`, ` ...`}` | {} {"one": 1, 0: False, True: ?}

### `Script` Literals

A `Script` is a sequence of statements.
The sequence begins with an indent.
Statements are separated by newlines.
The sequence ends with a dedent.
Statements include:

Syntax      | Effect
------------|--------
`nothing`   | no effect
`let `<_name_>` be `<_expr_> | bind value of _expr_ to _name_ in the current `Actor`'s state `Dict`
`send `<_expr_>` to `<_expr_> | send a message `Dict` to an `Actor`
`create `<_expr_>` with `<_expr_> | create an `Actor` with a `Script` and state `Dict`
`become `<_expr_> | replace the current `Actor`'s `Script`
`become `<_expr_>` with `<_expr_> | replace the current `Actor`'s `Script` and state `Dict`
`commit` | end event-processing transaction and release effects
`abort `<_expr_> | end event-processing transaction (with a reason) and discard effects
`if `<_expr_>` `<_expr_> | if the condition is `True`, execute the `Script`
`if `<_expr_>` `<_expr_>` else `<_expr_> | if the condition is `True`, execute the first `Script`, otherwise the second
`if `<_expr_>` `<_expr_>`elif `<_expr_>` `<_expr_> ... | execute the first `Script` with a `True` condition, otherwise `nothing`
`if `<_expr_>` `<_expr_>`elif `<_expr_>` `<_expr_> ... ` else `<_expr_> | execute the first `Script` with a `True` condition, otherwise the last
`do` <_expr_> | execute a `Script` as if it were included here

### Expressions

Expression evaluation always occurs in the context
of an `Actor` processing an event.
The information available for event-processing
comes from one of only four places:
1. The event's message `Dict`
2. The `Actor`'s state `Dict`
3. The constants defined in the module
4. The built-in definitions of the language

Syntax      | Value
------------|--------
<_literal_> | literal value
<_name_>    | value bound to _name_ in the current `Actor`'s state `Dict`, or module definition
`@@`        | the current `Actor`'s address
`@`         | the message `Dict` of the current event
<_expr_>`[`<_expr_>`]` | the component at the specified index, or `?`
<_expr_>`.`<_name_> | equivalent to <_expr_>`["`<_name_>`"]`
<_oper_>`[`<_expr_>`, ` ...`]` | value of the built-in operator, or `?`
<_expr_>` `<_infix_>` `<_expr_> | equivalent to <_oper_>`[`<_expr_>`, `<_expr_>`]`
