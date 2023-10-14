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
        send 2              ; --
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

### Statements

Statements begin with an operator (such as `alu`), followed by zero or more
operands. An operand is either an enumeration (such as `sub`) or an expression
(such as `2` or `std.commit`). Statements are indented by at least one space.

Each statement may be preceeded by one or more labels (and the first statement
must be). Labels are not indented. Labels within a module must have unique
names.

### Expressions

Expressions appear only in operand position.

There are five _literal_ values:

- `#?` (undefined)
- `#nil` (empty list)
- `#unit` (inert result)
- `#t` (true)
- `#f` (false)

_Fixnums_ are signed integers that fit within a single machine word, for example
`7` or `-1000`. An explicit radix may be provided, such as `16#F0a1`. Character
literals are recognized inside single-quotes, such as `'A'`, `'z'`, or `'\n'`.

All values have a _type_, queryable with the `typeq` instruction. The following
types are currently supported:

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

Names must start with a letter.
Names may contain letters and numbers.
Groups of letters and numbers may be separated
by underscore (`_`) or hyphen (`-`).
The following are all valid names:

- `send_0`
- `CONT_ID`
- `isNil`
- `take-2nd`

Exotic names may be enclosed in double-quotes (`"`).
They may contain any non-control character except double-quote.
These names are usually used by code-generators.

There is also a compound form of name, which refers to an imported value.
A period (`.`) separates the module name from the import name:

    if std.cust_send

### Ref

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

### Instructions

The following table just describes
the syntax and semantics of instruction statements.
The **Input** depicts the stack before the operation.
The **Output** depicts the stack after the operation.
The top of the stack is the right-most element.

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
—                    | `push` _value_      | _value_      | push literal _value_ on stack
_vₙ_ … _v₁_          | `dup` _n_           | _vₙ_ … _v₁_ _vₙ_ … _v₁_ | duplicate top _n_ items on stack
_vₙ_ … _v₁_          | `drop` _n_          | —            | remove _n_ items from stack
_vₙ_ … _v₁_          | `pick` _n_          | _vₙ_ … _v₁_ _vₙ_ | copy item _n_ to top of stack
_vₙ_ … _v₁_          | `pick` -_n_         | _v₁_ _vₙ_ … _v₁_ | copy top of stack before item _n_
_vₙ_ … _v₁_          | `roll` _n_          | _vₙ₋₁_ … _v₁_ _vₙ_ | roll item _n_ to top of stack
_vₙ_ … _v₁_          | `roll` -_n_         | _v₁_ _vₙ_ … _v₂_ | roll top of stack to item _n_
_n_                  | `alu` `not`         | ~_n_         | bitwise not _n_
_n_ _m_              | `alu` `and`         | _n_&_m_      | bitwise _n_ and _m_
_n_ _m_              | `alu` `or`          | _n_\|_m_     | bitwise _n_ or _m_
_n_ _m_              | `alu` `xor`         | _n_^_m_      | bitwise _n_ exclusive-or _m_
_n_ _m_              | `alu` `add`         | _n_+_m_      | sum of _n_ and _m_
_n_ _m_              | `alu` `sub`         | _n_-_m_      | difference of _n_ and _m_
_n_ _m_              | `alu` `mul`         | _n_\*_m_     | product of _n_ and _m_
_v_                  | `typeq` _T_         | _bool_       | `#t` if _v_ has type _T_, otherwise `#f`
_u_                  | `eq` _v_            | _bool_       | `#t` if _u_ == _v_, otherwise `#f`
_u_ _v_              | `cmp` `eq`          | _bool_       | `#t` if _u_ == _v_, otherwise `#f`
_u_ _v_              | `cmp` `ne`          | _bool_       | `#t` if _u_ != _v_, otherwise `#f`
_n_ _m_              | `cmp` `lt`          | _bool_       | `#t` if _n_ < _m_, otherwise `#f`
_n_ _m_              | `cmp` `le`          | _bool_       | `#t` if _n_ <= _m_, otherwise `#f`
_n_ _m_              | `cmp` `ge`          | _bool_       | `#t` if _n_ >= _m_, otherwise `#f`
_n_ _m_              | `cmp` `gt`          | _bool_       | `#t` if _n_ > _m_, otherwise `#f`
_bool_               | `if` _T_ [_F_]      | —            | if _bool_ is not falsy<sup>*</sup>, continue _T_ (else _F_)
_bool_               | `if_not` _F_ [_T_]  | —            | if _bool_ is falsy<sup>*</sup>, continue _F_ (else _T_)
_k_                  | `jump`              | —            | continue at _k_
… _tail_ _head_      | `pair` _n_          | _pair_       | create _pair_ from _head_ and _tail_ (_n_ times)
_vₙ_ … _v₁_          | `pair` -1           | (_v₁_ … _vₙ_) | capture stack items as a single _pair_ list
_pair_               | `part` _n_          | … _tail_ _head_ | split _pair_ into _head_ and _tail_ (_n_ times)
(_v₁_ … _vₙ_)        | `part` -1           | _vₙ_ … _v₁_   | spread _pair_ list items onto stack
(_v₁_ … _vₙ_ . _tailₙ_) | `nth` _n_         | _vₙ_         | copy item _n_ from a _pair_ list
(_v₁_ … _vₙ_ . _tailₙ_) | `nth` -_n_        | _tailₙ_      | copy tail _n_ from a _pair_ list
_dict_ _key_         | `dict` `has`        | _bool_       | `#t` if _dict_ has a binding for _key_, otherwise `#f`
_dict_ _key_         | `dict` `get`        | _value_      | the first _value_ bound to _key_ in _dict_, or `#?`
_dict_ _key_ _value_ | `dict` `add`        | _dict'_      | add a binding from _key_ to _value_ in _dict_
_dict_ _key_ _value_ | `dict` `set`        | _dict'_      | replace or add a binding from _key_ to _value_ in _dict_
_dict_ _key_         | `dict` `del`        | _dict'_      | remove first binding for _key_ in _dict_
—                    | `deque` `new`       | _deque_      | create a new empty _deque_
_deque_              | `deque` `empty`     | _bool_       | `#t` if _deque_ is empty, otherwise `#f`
_deque_ _value_      | `deque` `push`      | _deque'_     | insert _value_ as the first element of _deque_
_deque_              | `deque` `pop`       | _deque'_ _value_ | remove the first _value_ from _deque_, or `#?`
_deque_ _value_      | `deque` `put`       | _deque'_     | insert _value_ as the last element of _deque_
_deque_              | `deque` `pull`      | _deque'_ _value_ | remove the last _value_ from _deque_, or `#?`
_deque_              | `deque` `len`       | _n_          | count elements in the _deque_
_T_                  | `quad` `1`          | _quad_       | create quad \[_T_, `#?`, `#?`, `#?`\]
_X_ _T_              | `quad` `2`          | _quad_       | create quad \[_T_, _X_, `#?`, `#?`\]
_Y_ _X_ _T_          | `quad` `3`          | _quad_       | create quad \[_T_, _X_, _Y_, `#?`\]
_Z_ _Y_ _X_ _T_      | `quad` `4`          | _quad_       | create quad \[_T_, _X_, _Y_, _Z_\]
_quad_               | `quad` `-1`         | _T_          | extract 1 _quad_ field
_quad_               | `quad` `-2`         | _X_ _T_      | extract 2 _quad_ fields
_quad_               | `quad` `-3`         | _Y_ _X_ _T_  | extract 3 _quad_ fields
_quad_               | `quad` `-4`         | _Z_ _Y_ _X_ _T_ | extract 4 _quad_ fields
—                    | `msg` `0`           | _msg_        | copy event message to stack
—                    | `msg` _n_           | _msgₙ_       | copy message item _n_ to stack
—                    | `msg` -_n_          | _tailₙ_      | copy message tail _n_ to stack
—                    | `state` `0`         | _state_      | copy _actor_ state to stack
—                    | `state` _n_         | _stateₙ_     | copy state item _n_ to stack
—                    | `state` -_n_        | _tailₙ_      | copy state tail _n_ to stack
—                    | `my` `self`         | _actor_      | push _actor_ address on stack
—                    | `my` `beh`          | _beh_        | push _actor_ behavior on stack
—                    | `my` `state`        | _vₙ_ … _v₁_  | spread _actor_ state onto stack
_mₙ_ … _m₁_ _actor_  | `send` _n_          | —            | send (_m₁_ … _mₙ_) to _actor_
_msg_ _actor_        | `send` `-1`         | —            | send _msg_ to _actor_
_sponsor_ _mₙ_ … _m₁_ _actor_ | `signal` _n_ | —          | send (_m₁_ … _mₙ_) to _actor_ using _sponsor_
_sponsor_ _msg_ _actor_ | `signal` `-1`    | —            | send _msg_ to _actor_ using _sponsor_
_vₙ_ … _v₁_ _beh_    | `new` _n_           | _actor_      | create an _actor_ with code _beh_ and data (_v₁_ … _vₙ_)
_state_ _beh_        | `new` `-1`          | _actor_      | create an _actor_ with code _beh_ and data _state_
(_beh_ . _state_)    | `new` `-2`          | _actor_      | create an _actor_ with code _beh_ and data _state_
\[_, _, _, _beh_\]   | `new` `-3`          | _actor_      | create an _actor_ with code _beh_ and data \[_, _, _, _beh_\]
_vₙ_ … _v₁_ _beh_    | `beh` _n_           | —            | replace code with _beh_ and data with (_v₁_ … _vₙ_)
_state_ _beh_        | `beh` `-1`          | —            | replace code with _beh_ and data with _state_
(_beh_ . _state_)    | `beh` `-2`          | —            | replace code with _beh_ and data with _state_
\[_, _, _, _beh_\]   | `beh` `-3`          | —            | replace code with _beh_ and data with \[_, _, _, _beh_\]
_reason_             | `end` `abort`       | —            | abort actor transaction with _reason_
—                    | `end` `stop`        | —            | stop current continuation (thread)
—                    | `end` `commit`      | —            | commit actor transaction
—                    | `sponsor` `new`     | _sponsor_    | create a new empty _sponsor_
_sponsor_ _n_        | `sponsor` `memory`  | _sponsor_    | transfer _n_ memory quota to _sponsor_
_sponsor_ _n_        | `sponsor` `events`  | _sponsor_    | transfer _n_ events quota to _sponsor_
_sponsor_ _n_        | `sponsor` `cycles`  | _sponsor_    | transfer _n_ cycles quota to _sponsor_
_sponsor_            | `sponsor` `reclaim` | _sponsor_    | reclaim all quotas from _sponsor_
_sponsor_ _control_  | `sponsor` `start`   | —            | run _sponsor_ under _control_
_sponsor_            | `sponsor` `stop`    | —            | reclaim all quotas and remove _sponsor_
_actual_             | `assert` _expect_   | —            | assert _actual_ == _expect_, otherwise halt!
—                    | `debug`             | —            | debugger breakpoint

<sup>*</sup> For conditionals (`if` and `if_not`) the values
`#f`, `#?`, `#nil`, and `0` are considered "[falsy](https://developer.mozilla.org/en-US/docs/Glossary/Falsy)".

Every instruction (except `end`) takes a continuation as its
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

The `std.asm` module contains (among others)
the following definition:

    commit:
        end commit

This allows the previous example to be written as:

```
.import
    std: "./std.asm"

beh:
    msg 1
    ref std.commit
```

In practice, most instructions are implicitly continued
at the subsequent instruction.

#### Pair-List Indexing

Instructions like `msg`, `state`, and `nth`
have an immediate index argument (_n_)
to succinctly designate parts of a pair-list.

  * Positive _n_ designates elements of the list, starting at `1`
  * Negative _n_ designates list tails, starting at `-1`
  * Zero designates the whole list/value

```
  0              -1              -2              -3
---->[head,tail]---->[head,tail]---->[head,tail]---->...
    +1 |            +2 |            +3 |
       V               V               V
```

...or more compactly...

```
0-->[1,-1]-->[2,-2]-->[3,-3]--> ...
     |        |        |
     V        V        V
```

If the index is out-of-bounds, the result is `#?` (undefined).

### Data

The `pair_t` and `dict_t` statements construct data structures from their
operands. The `type_t` statement makes custom types. The `quad_1`, `quad_2`,
`quad_3`, and `quad_4` statements construct quads, taking a type as the _T_
operand.

 Instruction | First operand | Second operand | Third operand | Fourth operand
-------------|---------------|----------------|---------------|----------------
`pair_t`     | _head_        | [_tail_]       |               |
`dict_t`     | _key_         | _value_        | [_next_]      |
`type_t`     | [_arity_]     |                |               |
`quad_1`     | [_T_]         |                |               |
`quad_2`     | _T_           | [_X_]          |               |
`quad_3`     | _T_           | _X_            | [_Y_]         |
`quad_4`     | _T_           | _X_            | _Y_           | [_Z_]

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

An identical pair could be constructed using `quad_3` instead.

    b:
        quad_3 #pair_t #t #f

Here, `c` is a dictionary containing entries `0: false` and `true: 1`.

    c:
        dict_t 0 #f
        dict_t #t 1
        ref #nil

Quads can also be constructed with custom types.

    ternary:
        type_t 3

    custom_quad:
        quad_4 ternary 1 2 3

## Grammar

The grammar is written in
[McKeeman form](https://www.crockford.com/mckeeman.html).

Each source unit consists of a single _module_. A _module_ may begin with
comments or blank lines, and must end with a newline character.

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
        indent name ':' spaces string newlines

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
        single_quote character_literal single_quote

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
        character - single_quote - '\'

    single_quote
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
        string

    trailing
        ""
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

    string
        '"' nonquotes '"'

    nonquotes
        ""
        nonquote nonquotes

    nonquote
        character - '"'

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
