# uFork

[uFork](https://github.com/organix/uFork) is a pure-actor virtual machine with
object-capabilities and memory-safety. This document describes an intermediate
representation format for uFork modules.

    {
        "lang": "uFork",
        "ast": <module>
    }

Each [CRLF](https://github.com/organix/crlf) object describes a single module.
The `ast` is a _module_ object.

## Module

A _module_ describes its imports, its definitions, and its exports.

    {
        "kind": "module",
        "import": {
            <name>: <specifier>,
            <name>: <specifier>,
            ...
        },
        "define": {
            <name>: <value>,
            <name>: <value>,
            ...
        },
        "export": [
            <name>,
            <name>,
            ...
        ]
    }

Each _import_ consists of a _name_ and _specifier_ string. The import's _name_
is private to the module, and can be any string whatsoever. The _specifier_
tells the loader where to find the module. The format of _specifier_ strings
depends on the system.

Each _definition_ consists of a _name_ and a _value_. The _name_ can be any
string. The _value_ is a _literal_, _fixnum_, _type_, _pair_, _dict_, _instr_,
or _ref_.

Definitions are private by default. Only definitions whose names are included in
the `export` array will be accessible by other modules.

In the following example, URLs and relative paths are used as _specifier_
strings. The `apple` definition remains private whereas the `orange` definition
is exported.

    {
        "kind": "module",
        "import": {
            "std": "https://ufork.org/lib/std.json",
            "pear": "./pear.json"
        },
        "define": {
            "apple": ...,
            "orange": ...
        },
        "export": [
            "orange"
        ]
    }

## Ref

Anywhere a _value_ is expected, a _ref_ may be provided instead. A _ref_ refers
to a value by name.

    {
        "kind": "ref",
        "module": <name>,
        "name": <name>
    }

If the `module` property is specified, the _ref_ refers to an imported value.
Otherwise it refers to one of the definitions. For example,

    {
        "kind": "ref",
        "module": "std",
        "name": "commit"
    }

refers to the "std" module's `commit` export, and

    {
        "kind": "ref",
        "name": "apple"
    }

refers to the `apple` definition.

## Literal

There are five _literal_ values: _undef_, _nil_, _unit_, _true_, and _false_.

    {"kind": "literal", "value": "undef"}

_undef_ represents the absence of a value, usually indicating some kind of
 error.

    {"kind": "literal", "value": "nil"}

_nil_ is used to terminate recursive data structures, for example a list
 of _pairs_.

    {"kind": "literal", "value": "unit"}

_unit_ represents the absence of information, without indicating an error.

    {"kind": "literal", "value": "true"}
    {"kind": "literal", "value": "false"}

The boolean values are _true_ and _false_.

## Fixnum

A _fixnum_ is a signed integer that fits in a machine word. Some valid _fixnum_
values are `200`, `-3` and `0`.

## Type

There are several _types_. These can be used as immediate values for the "typeq"
instruction.

    {"kind": "type", "name": "literal"}
    {"kind": "type", "name": "fixnum"}
    {"kind": "type", "name": "type"}
    {"kind": "type", "name": "pair"}
    {"kind": "type", "name": "dict"}
    {"kind": "type", "name": "instr"}
    {"kind": "type", "name": "actor"}

## Pair

A _pair_ is a data structure containing two values.

    {
        "kind": "pair",
        "head": <value>,
        "tail": <value>
    }

Lists can be built out of _pairs_. For example,

    {
        "kind": "pair",
        "head": 4,
        "tail": {
            "kind": "pair",
            "head": 5,
            "tail": {
                "kind": "literal",
                "value": "nil"
            }
        }
    }

is a list containing 4 and 5.

## Dict

A _dict_ is a data structure used to build dictionaries. Each _dict_ has a key,
a value, and another _dict_ (or _nil_).

    {
        "kind": "dict",
        "key": <value>,
        "value": <value>,
        "next": <dict/nil>
    }

For example,

    {
        "kind": "dict",
        "key": 0,
        "value": {
            "kind": "literal",
            "value": "false"
        },
        "next": {
            "kind": "dict",
            "key": {
                "kind": "literal",
                "value": "true"
            },
            "value": 1,
            "next": {
                "kind": "literal",
                "value": "nil"
            }
        }
    }

is a dictionary with two entries: `0: false` and `true: 1`.

## Instruction

An _instr_ represents a single machine instruction. Instructions are linked
together to form instruction streams.

    {
        "kind": "instr",
        "op": <string>,
        "imm": <value>,
        "k": <instr>,
        "debug": <debug>
    }

The `op` is the name of the instruction. Most instructions take an immediate
`imm` value: either a fixnum, a string label, or some other value. The `k`
value points to the next instruction, and is not present on "end" instructions.

 `op`           | `imm`
----------------|---------------------------------------------------------------
"typeq"         | _type_
"quad"          | _fixnum_
"get"           | "T", "X", "Y", "Z"
"dict"          | "has", "get", "add", "set", "del"
"deque"         | "new", "empty", "push", "pop", "put", "pull", "len"
"pair"          | _fixnum_
"part"          | _fixnum_
"nth"           | _fixnum_
"push"          | _value_
"depth"         |
"drop"          | _fixnum_
"pick"          | _fixnum_
"dup"           | _fixnum_
"roll"          | _fixnum_
"alu"           | "not", "and", "or", "xor", "add", "sub", "mul"
"eq"            | _value_
"cmp"           | "eq", "ge", "gt", "lt", "le", "ne"
"msg"           | _fixnum_
"state"         | _fixnum_
"my"            | "self", "beh", "state"
"send"          | _fixnum_
"signal"        | _fixnum_
"new"           | _fixnum_
"beh"           | _fixnum_
"end"           | "abort", "stop", "commit", "release"
"sponsor"       | "new", "memory", "events", "instrs", "reclaim", "start", "stop"
"is_eq"         | _value_
"is_ne"         | _value_

In addition, there is an "if" instruction. Rather than having a single
continuation field (`k`), it has two: the consequent (`t`) and the alternative
(`f`).

    {
        "kind": "instr",
        "op": "if",
        "t": <instr>,
        "f": <instr>
    }

For example, the following instruction stream examines the first element of a
message. If it is 42, the transaction is committed. Otherwise the transaction
is aborted.

    {
        "kind": "instr",
        "op": "msg",
        "imm": 1,
        "k": {
            "kind": "instr",
            "op": "eq",
            "imm": 42,
            "k": {
                "kind": "instr",
                "op": "if",
                "t": {"kind": "instr", "op": "end", "imm": "commit"},
                "f": {"kind": "instr", "op": "end", "imm": "abort"}
            }
        }
    }

## Debugging

An optional `debug` property may appear on any kind of object. Its purpose it to
provide debugging information, specifically a location in source code.

    {
        "kind": "debug",
        "file": <string>,
        "line": <number>
    }
