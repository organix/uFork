# Director - An Actor Scripting Language

_Director_ is a simple actor scripting language
that provides a surface-syntax for **uFork** programs.
A compiler toolchain (written in JavaScript)
generates loadable [IR](ir.md)
just like [ASM](asm.md) does.

## An Example

```
std: import["std.lib"]

svc:
fib_svc:  // {} <- {"cust", "n"}
    if @.n > 1
        let k_fib be create fib_k0 with {"cust": @.cust}
        send {"cust": k_fib, "n": (@.n - 1)} to @@
        send {
            "cust": k_fib
            "n": (@.n - 2)
        } to create fib_svc with {}
    else
        send {"value": @.n} to @.cust

fib_k0:  // {"cust"} <- {"value"}
    let value be @.value
    become fib_k1

fib_k1:  // {"cust", "value"} <- {"value"}
    send {"value": (value + @.value)} to cust

boot:  // {} <- {dev_caps}
    let debug_dev be @["debug"]
    let fib be create fib_svc with {}
    send {"cust": debug_dev, "n": 9} to fib

export[boot, svc]
```

## Language Syntax

### Literal Constants

#### Values

Syntax      | Meaning
------------|--------
`?`         | undefined value
`True`      | boolean **true** value
`False`     | boolean **false** value

#### Types

Syntax      | Meaning
------------|--------
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

A [_Rational_](https://en.wikipedia.org/wiki/Rational_number) number.
**NOTE:** _Floating Point_ numbers are _Rational_ approximations of _Real_ numbers.

Syntax      | Examples
------------|--------
<_sign_><_digits_> | 0 12 -345 +6_789
<_base_>`#`<_digits_> | 16#C0de 2#1100_0000_1101_1110

### `Text` Literals

A sequence of characters (Unicode codepoints).

Syntax      | Examples
------------|--------
`"`<_characters_>`"` | "" "foo" "1st" "Can't say." "a line of text\n"

### `List` Literals

A sequence of values.

Syntax      | Examples
------------|--------
`[`<_expr_>`, ` …`]` | [] [?, True, 42, "foo"]

### `Dict` Literals

A sequence of \{_key_, _value_\} members.

Syntax      | Examples
------------|--------
`{`<_expr_>`: `<_expr_>`, ` …`}` | {} {"one": 1, 0: False, True: ?}

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
`become `<_expr_> | replace the current `Actor`'s `Script`
`become `<_expr_>` with `<_expr_> | replace the current `Actor`'s `Script` and state `Dict`
`commit` | end event-processing transaction and release effects
`abort `<_expr_> | end event-processing transaction (with a reason) and discard effects
`if `<_expr_>` `<_script_> | if the condition is `True`, execute the `Script`
`if `<_expr_>` `<_script_>` else `<_script_> | if the condition is `True`, execute the first `Script`, otherwise the second
`if `<_expr_>` `<_script_>`elif `<_expr_>` `<_script_> … | execute the first `Script` with a `True` condition, otherwise `nothing`
`if `<_expr_>` `<_script_>`elif `<_expr_>` `<_script_> … ` else `<_script_> | execute the first `Script` with a `True` condition, otherwise the last
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
`create `<_expr_>` with `<_expr_>   | create an `Actor` with a `Script` and state `Dict`
<_literal_>                         | literal value
<_name_>                            | value bound to _name_ in the current `Actor`'s state `Dict` (or module definitions)
`@@`                                | the current `Actor`'s address
`@`                                 | the message `Dict` of the current event
<_expr_>`[`<_expr_>`]`              | the component at the specified index, or `?`
<_expr_>`.`<_name_>                 | equivalent to <_expr_>`["`<_name_>`"]`
<_oper_>`[`<_expr_>`, ` …`]`        | value of the built-in operator, or `?`
<_expr_>` `<_infix_>` `<_expr_>     | equivalent to <_oper_>`[`<_expr_>`, `<_expr_>`]`

#### Symbolic Operators

Symbol  | Operator          | Description
--------|-------------------|--------------
`\|\|`  | `or[`_b_, …`]`    | `Boolean` "or"
`&&`    | `and[`_b_, …`]`   | `Boolean` "and"
`==`    | `eq[`_v_, …`]`    | Equal to
`!=`    | `neq[`_v_, …`]`   | Not equal
`<`     | `lt[`_n_, …`]`    | Less than
`<=`    | `leq[`_n_, …`]`   | Less or equal
`>`     | `gt[`_n_, …`]`    | Greater than
`>=`    | `geq[`_n_, …`]`   | Greater or equal
`+`     | `add[`_n_, …`]`   | `Number` addition
`-`     | `sub[`_n_, …`]`   | `Number` subtraction
`*`     | `mul[`_n_, …`]`   | `Number` mutiplication
`/`     | `div[`_n_, …`]`   | `Number` division
`^`     | `pow[`_n_, …`]`   | `Number` exponentiation (right binding)
`^`     | `join[`_s_, …`]`  | Sequence concatenation (right binding)
`!`     | `not[`_b_`]`      | `Boolean` "not" (prefix, no space)
`-`     | `neg[`_n_`]`      | `Number` negation (prefix, no space)
`(` _expr_ `)` | —          | Grouping sub-expression

#### Intrinsic Operators

Operator                        | Description
--------------------------------|--------------
`type_of[`_value_`]`            | `Type` of _value_
`keys[`_dict_`]`                | `List` of unique keys in _dict_
`members[`_dict_`]`             | `List` of `{`_k_, _v_`}` pairs in _dict_
`prune[`_dict_`]`               | Canonical representation of _dict_
`floor[`_n_`]`                  | Integer ≤ _n_
`trunc[`_n_`]`                  | `ceil[`_n_`]` if _n_ < 0, else `floor[`_n_`]`
`ceil[`_n_`]`                   | Integer ≥ _n_
`max[`_n_, …`]`                 | Greatest `Number`
`min[`_n_, …`]`                 | Least `Number`
`slice[`_s_, _from_, _upto_`]`  | Sequence elements \[_from_, _upto_\)
`length[`_s_`]`                 | Number of elements in _s_
