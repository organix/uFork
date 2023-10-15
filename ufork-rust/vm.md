# Virtual Machine Semantics

## Contents

 * [Introduction](#introduction)
 * [Representation](#representation)
 * [Data Structures](#data-structures)
    * Reserved ROM
    * Reserved RAM
    * Memory Descriptor
    * Event and Continuation Queues
    * Root Sponsor
 * [Object Graph](#object-graph)
    * Pair-List Indexing
 * [Instructions](#instructions)
    * Instruction Summary
    * Instruction Details
        * [`alu`](#alu-instruction) instruction
        * [`assert`](#assert-instruction) instruction
        * [`beh`](#beh-instruction) instruction
        * [`cmp`](#cmp-instruction) instruction
        * [`debug`](#debug-instruction) instruction
        * [`deque`](#deque-instruction) instruction
        * [`dict`](#dict-instruction) instruction
        * [`drop`](#drop-instruction) instruction
        * [`dup`](#dup-instruction) instruction
        * [`end`](#end-instruction) instruction
        * [`eq`](#eq-instruction) instruction
        * [`if`](#if-instruction) instruction
        * [`jump`](#jump-instruction) instruction
        * [`msg`](#msg-instruction) instruction
        * [`my`](#my-instruction) instruction
        * [`new`](#new-instruction) instruction
        * [`nth`](#nth-instruction) instruction
        * [`pair`](#pair-instruction) instruction
        * [`part`](#part-instruction) instruction
        * [`pick`](#pick-instruction) instruction
        * [`push`](#push-instruction) instruction
        * [`roll`](#roll-instruction) instruction
        * [`send`](#send-instruction) instruction
        * [`signal`](#signal-instruction) instruction
        * [`sponsor`](#sponsor-instruction) instruction
        * [`state`](#state-instruction) instruction
        * [`typeq`](#typeq-instruction) instruction
        * [`quad`](#quad-instruction) instruction

## Introduction

The [**uFork** virtual machine](../ufork.md)
is designed to support machine-level actors.
All instructions execute within the context
of an actor handling a message-event.
There is no support for address arithmetic or load/store of arbitrary memory.
Mutation is always local to an actor's private state.
Immutable values are passed between actors via message-events.
External events (such as "interrupts")
are turned into message-events.

## Representation

The quad-cell is the primary internal data-structure in **uFork**.
It consists of four unsigned integers
(the current WASM target uses 32-bit words).

 T        | X        | Y        | Z
----------|----------|----------|----------
type/proc | head/car | tail/cdr | link/next

The integers in each field carry a _type tag_
in their 3 most-significant bits (MSBs).
The 1st MSB is {0=indirect-reference, 1=direct-value}.
The 2nd MSB is {0=immutable, 1=mutable}.
The 3rd MSB is {0=transparent, 1=opaque}.
The resulting type-heirarchy looks like this:

```
                   any-value
                  0 /     \ 1
        (ptr) indirect   direct (fixnum)
             0 /    \ 1
  (rom) immutable  mutable
                  0 /   \ 1
     (ram) transparent opaque (ocap)
```

Direct values (fixnums) are stored in 2's-complement representation,
where the 2nd MSB is the sign bit of the integer value.

Indirect values (pointers) designate quad-cells (with fields [_T_, _X_, _Y_, _Z_]).

Mutable values designate a quad that may be written as well as read.
Since actor-state is mutable, the quad representing the actor must stored in writable memory.

Opaque values (object-capabilities) cannot be dereferenced
except by the virtual-processor (to implement _actor_ primitive operations).

The machine-code semantics provide no way to convert between _fixnums_, _ocaps_, and quad-cell pointers.

## Data Structures

Quad-cells are used to encode most of the important data-structures in uFork.

 Structure                              | Description
----------------------------------------|---------------------------------
[_sponsor_, _target_, _msg_, _next_]    | message-event queue entry
[_IP_, _SP_, _EP_, _next_]              | continuation queue entry
[`#instr_t`, _opcode_, _data_, _next_]  | machine instruction (typical)
[`#pair_t`, _head_, _tail_, `#?`]       | pair-lists of user data (cons)
[`#pair_t`, _item_, _rest_, `#?`]       | stack entry holding _item_
[`#actor_t`, _beh_, _sp_, `#?`]         | idle actor
[`#actor_t`, _beh_, _sp_, _effects_]    | busy actor
[`#actor_t`, _beh'_, _sp'_, _events_]   | effects, initial _events_=()
[`#dict_t`, _key_, _value_, _next_]     | dictionary binding entry
[`FREE_T`, `#?`, `#?`, _next_]          | cell in the free-list

### Reserved ROM

 Name        | Address     | T         | X    | Y    | Z    | Description
-------------|-------------|-----------|------|------|------|------------------
 `#?`        | `^00000000` | `#?`      | `#?` | `#?` | `#?` | Undefined
 `()`        | `^00000001` | `#?`      | `#?` | `#?` | `#?` | Nil (empty list)
 `#f`        | `^00000002` | `#?`      | `#?` | `#?` | `#?` | Boolean False
 `#t`        | `^00000003` | `#?`      | `#?` | `#?` | `#?` | Boolean True
 `#unit`     | `^00000004` | `#?`      | `#?` | `#?` | `#?` | Unit (inert)
 `EMPTY_DQ`  | `^00000005` | `#pair_t` | `()` | `()` | `#?` | Empty Deque
 `#type_t`   | `^00000006` | `#type_t` | `+1` | `#?` | `#?` | Type of Types
 `#fixnum_t` | `^00000007` | `#type_t` | `#?` | `#?` | `#?` | Fixnum Type
 `#actor_t`  | `^00000008` | `#type_t` | `+2` | `#?` | `#?` | Actor (ocap) Type
 `PROXY_T`   | `^00000009` | `#type_t` | `+2` | `#?` | `#?` | Proxy Type
 `STUB_T`    | `^0000000A` | `#type_t` | `+2` | `#?` | `#?` | Stub Type
 `#instr_t`  | `^0000000B` | `#type_t` | `+3` | `#?` | `#?` | Instruction Type
 `#pair_t`   | `^0000000C` | `#type_t` | `+2` | `#?` | `#?` | Pair Type
 `#dict_t`   | `^0000000D` | `#type_t` | `+3` | `#?` | `#?` | Dictionary Type
 `FWD_REF_T` | `^0000000E` | `#type_t` | `-1` | `#?` | `#?` | GC Fwd-Ref Type
 `FREE_T`    | `^0000000F` | `#type_t` | `+0` | `#?` | `#?` | Free-Quad Type

### Reserved RAM

 Address     | T          | X        | Y        | Z        | Description
-------------|------------|----------|----------|----------|------------------
 `^40000000` | _top_      | _next_   | _free_   | _root_   | Memory Descriptor
 `^40000001` | _e_head_   | _e_tail_ | _k_head_ | _k_tail_ | Events and Continuations
 `@60000002` | `#actor_t` | `+0`     | `()`     | `#?`     | Device Actor #0
 `@60000003` | `#actor_t` | `+1`     | `()`     | `#?`     | Device Actor #1
 `@60000004` | `#actor_t` | `+2`     | `()`     | `#?`     | Device Actor #2
 `@60000005` | `#actor_t` | `+3`     | `()`     | `#?`     | Device Actor #3
 `@60000006` | `#actor_t` | `+4`     | `()`     | `#?`     | Device Actor #4
 `@60000007` | `#actor_t` | `+5`     | `()`     | `#?`     | Device Actor #5
 `@60000008` | `#actor_t` | `+6`     | `()`     | `#?`     | Device Actor #6
 `@60000009` | `#actor_t` | `+7`     | `()`     | `#?`     | Device Actor #7
 `@6000000A` | `#actor_t` | `+8`     | `()`     | `#?`     | Device Actor #8
 `@6000000B` | `#actor_t` | `+9`     | `()`     | `#?`     | Device Actor #9
 `@6000000C` | `#actor_t` | `+10`    | `()`     | `#?`     | Device Actor #10
 `@6000000D` | `#actor_t` | `+11`    | `()`     | `#?`     | Device Actor #11
 `@6000000E` | `#actor_t` | `+12`    | `()`     | `#?`     | Device Actor #12
 `^4000000F` | _memory_   | _events_ | _cycles_ | _signal_ | Root Sponsor

### Memory Descriptor

 Address     | T          | X           | Y            | Z
-------------|------------|-------------|--------------|----------
 `^40000000` | _top addr_ | _next free_ | _free count_ | _GC root_

### Event and Continuation Queues

 Address     | T          | X        | Y        | Z
-------------|------------|----------|----------|----------
 `^40000001` | _e_head_   | _e_tail_ | _k_head_ | _k_tail_

### Root Sponsor

 Address     | T          | X        | Y        | Z
-------------|------------|----------|----------|----------
 `^4000000F` | _memory_   | _events_ | _cycles_ | _signal_

## Object Graph

The diagram below shows a typical graph of quad-cells
representing the contents of the `e_queue` (event queue)
and the `k_queue` (continuation queue).
These two queues, the interrupt-handling actors,
and the root sponsor form the root-set of objects
for [garbage-collection](gc.md).

```
e_queue: [e_head,e_tail]------------------------+
          |                                     V
          +-->[sponsor,to,msg,next]---> ... -->[sponsor,to,msg,()]
                       |   |
                       |   +--> actor message content
                       V
                      [#pair_t,code,data,#?]
                                |    |
                                |    +--> actor state
                                |
                                +--> actor behavior

k_queue: [k_head,k_tail]----------------+
          |                             V
          +-->[ip,sp,ep,kp]---> ... -->[ip,sp,ep,()]
               |  |  |
               |  |  +-->[sponsor,to,msg,()]
               |  |               |   |
               |  |               |   +--> ...
               |  |               V
               |  |              [#actor_t,code,data,effect]
               |  |                                   |
               |  |                                   V
               |  |                             [#actor_t,code',data',events]
               |  V                                                    |
               | [#pair_t,car,cdr,#?]                                  +--> ... -->[sponsor,to,msg,()]
               |           |   |
               |           |   +--> ... -->[#pair_t,car,(),#?]
               |           V
               |          item
               V
              [#instr_t,"eq",0,k]
                               |
                               +--> [#instr_t,"if",t,f]
                                                   | |
                                                   | +--> ...
                                                   V
                                                   ...
```

### Pair-List Indexing

Instructions like `msg`, `state`, and `nth`
have an immediate index argument (_n_)
to succinctly designate parts of a pair-list.

  * Positive _n_ designates items of the list, starting at `+1`
  * Negative _n_ designates list tails, starting at `-1`
  * Zero designates the whole list/value

```
  0            -1            -2            -3
---->[car,cdr]---->[car,cdr]---->[car,cdr]---->...
    +1 |          +2 |          +3 |
       V             V             V
```

...or more compactly...

```
0-->[1,-1]-->[2,-2]-->[3,-3]--> ...
     |        |        |
     V        V        V
```

If the index is out-of-bounds, the result is `#?` (undefined).

## Instructions

The uFork instruction execution engine implements a linked-stack machine,
however the stack is only used for local state in a computation.
The _input_ for each instruction is taken from the stack
and the _output_ is placed back onto the stack.
Instructions all have a `T` field containing the `#instr_t` type marker.
The operation code is carried in the `X` field of the instruction.
Most instructions also have an immediate value,
carried in the `Y` field of the instruction.
For the typical case of a instruction with a single continuation,
the "next instruction" is carried in the `Z` field of the instruction.

Instructions are shown in their textual representation as defined in the [assembly-language manual](../ufork-wasm/asm.md).

### Instruction Summary

The following table summarizes
the syntax and semantics of instruction statements.
The **Input** depicts the stack before the operation.
The **Output** depicts the stack after the operation.
The top of the stack is the right-most item.

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
_n_ _m_              | `alu` `lsl`         | _n_<<_m_     | logical shift left _n_ by _m_
_n_ _m_              | `alu` `lsr`         | _n_>>_m_     | logical shift right _n_ by _m_
_n_ _m_              | `alu` `asr`         | _n_>>>_m_    | arithmetic shift right _n_ by _m_
_n_ _m_              | `alu` `rol`         | _n_<<>_m_    | rotate left _n_ by _m_
_n_ _m_              | `alu` `ror`         | _n_<>>_m_    | rotate right _n_ by _m_
_v_                  | `typeq` _T_         | _bool_       | `#t` if _v_ has type _T_, otherwise `#f`
_u_                  | `eq` _v_            | _bool_       | `#t` if _u_ == _v_, otherwise `#f`
_u_ _v_              | `cmp` `eq`          | _bool_       | `#t` if _u_ == _v_, otherwise `#f`
_u_ _v_              | `cmp` `ne`          | _bool_       | `#t` if _u_ != _v_, otherwise `#f`
_n_ _m_              | `cmp` `lt`          | _bool_       | `#t` if _n_ < _m_, otherwise `#f`
_n_ _m_              | `cmp` `le`          | _bool_       | `#t` if _n_ <= _m_, otherwise `#f`
_n_ _m_              | `cmp` `ge`          | _bool_       | `#t` if _n_ >= _m_, otherwise `#f`
_n_ _m_              | `cmp` `gt`          | _bool_       | `#t` if _n_ > _m_, otherwise `#f`
_bool_               | `if` _T_ [_F_]      | —            | if _bool_ is not falsy<sup>*</sup>, continue _T_ (else _F_)
_k_                  | `jump`              | —            | continue at _k_
… _tail_ _head_      | `pair` _n_          | _pair_       | create _pair(s)_ from _head_ and _tail_ (_n_ times)
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
_deque_ _value_      | `deque` `push`      | _deque'_     | insert _value_ as the first item of _deque_
_deque_              | `deque` `pop`       | _deque'_ _value_ | remove the first _value_ from _deque_, or `#?`
_deque_ _value_      | `deque` `put`       | _deque'_     | insert _value_ as the last item of _deque_
_deque_              | `deque` `pull`      | _deque'_ _value_ | remove the last _value_ from _deque_, or `#?`
_deque_              | `deque` `len`       | _n_          | count items in the _deque_
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

<sup>*</sup> For the `if` instruction, the values
`#f`, `#?`, `#nil`, and `0` are considered "[falsy](https://developer.mozilla.org/en-US/docs/Glossary/Falsy)".

### Instruction Details

The semantics of each instruction are detailed below.
A few general rules apply to all instructions.
Unless stated otherwise in the description of an instruction:

 * Attempts to execute a non-instruction signals an error
 * Unknown instruction op-codes signal an error
 * Arguments of an invalid type signal an error
 * Items referenced beyond the bottom of the stack are treated as `#?`

#### `alu` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_n_                  | `alu` `not`         | ~_n_         | bitwise not _n_
_n_ _m_              | `alu` `and`         | _n_&_m_      | bitwise _n_ and _m_
_n_ _m_              | `alu` `or`          | _n_\|_m_     | bitwise _n_ or _m_
_n_ _m_              | `alu` `xor`         | _n_^_m_      | bitwise _n_ exclusive-or _m_
_n_ _m_              | `alu` `add`         | _n_+_m_      | sum of _n_ and _m_
_n_ _m_              | `alu` `sub`         | _n_-_m_      | difference of _n_ and _m_
_n_ _m_              | `alu` `mul`         | _n_\*_m_     | product of _n_ and _m_
_n_ _m_              | `alu` `lsl`         | _n_<<_m_     | logical shift left _n_ by _m_
_n_ _m_              | `alu` `lsr`         | _n_>>_m_     | logical shift right _n_ by _m_
_n_ _m_              | `alu` `asr`         | _n_>>>_m_    | arithmetic shift right _n_ by _m_
_n_ _m_              | `alu` `rol`         | _n_<<>_m_    | rotate left _n_ by _m_
_n_ _m_              | `alu` `ror`         | _n_<>>_m_    | rotate right _n_ by _m_

Compute an ALU function of the arguments on the stack.

 T            | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+13` (alu) | `+0` (not)  | _instr_

 1. Remove item _n_ from the stack (`#?` on underflow)
 1. If _n_ is a fixnum
    1. Invert all bits of fixnum
    1. Push result onto the stack
 1. Otherwise
    1. Push `#?` onto the stack

 T            | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+13` (alu) | `+5` (sub)  | _instr_

 1. Remove item _m_ from the stack (`#?` on underflow)
 1. Remove item _n_ from the stack (`#?` on underflow)
 1. If _n_ and _m_ are both fixnums
    1. Subtract _m_ from _n_
    1. Truncate 2's-complement result
    1. Push result onto the stack
 1. Otherwise
    1. Push `#?` onto the stack

#### `assert` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_actual_             | `assert` _expect_   | —            | assert _actual_ == _expect_, otherwise halt!

Ensure that the item on the stack has the expected value.

 T            | X (op)          | Y (imm)     | Z (k)
--------------|-----------------|-------------|-------------
 `#instr_t`   | `+7` (assert)   | _any_       | _instr_

 1. Remove item _actual_ from the stack (`#?` on underflow)
 1. If _actual_ is not equal to _expect_
    1. Signal an `E_ASSERT` error

#### `beh` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_vₙ_ … _v₁_ _beh_    | `beh` _n_           | —            | replace code with _beh_ and data with (_v₁_ … _vₙ_)
_state_ _beh_        | `beh` `-1`          | —            | replace code with _beh_ and data with _state_
(_beh_ . _state_)    | `beh` `-2`          | —            | replace code with _beh_ and data with _state_
\[_, _, _, _beh_\]   | `beh` `-3`          | —            | replace code with _beh_ and data with \[_, _, _, _beh_\]

Provide a new behavior (code and data) for the current actor.
This is the actor "become" primitive.
There are several ways to provide the code and data
for handling the next event,
however both are always replaced together.

 T            | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+29` (beh) | _positive_  | _instr_

 1. Remove item _beh_ from the stack (`#?` on underflow)
 1. Record _beh_ as the code to execute when handling the next event
 1. Form a list from the number of stack items specified by the immediate argument
 1. Record this list as the private data when handling the next event

 T            | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+29` (beh) | `+0`        | _instr_

 1. Remove item _beh_ from the stack (`#?` on underflow)
 1. Record _beh_ as the code to execute when handling the next event
 1. Record `()` as the private data when handling the next event

 T            | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+29` (beh) | `-1`        | _instr_

 1. Remove item _beh_ from the stack (`#?` on underflow)
 1. Record _beh_ as the code to execute when handling the next event
 1. Remove item _state_ from the stack (`#?` on underflow)
 1. Record _state_ as the private data when handling the next event

 T            | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+29` (beh) | `-2`        | _instr_

 1. Remove an item from the stack (`#?` on underflow)
 1. Record the `X` field of this item as the code to execute when handling the next event
 1. Record the `Y` field of this item as the private data when handling the next event

 T            | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+29` (beh) | `-3`        | _instr_

 1. Remove an item from the stack (`#?` on underflow)
 1. Record the `Z` field of this item as the code to execute when handling the next event
 1. Record this item as the private data when handling the next event

#### `cmp` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_u_ _v_              | `cmp` `eq`          | _bool_       | `#t` if _u_ == _v_, otherwise `#f`
_u_ _v_              | `cmp` `ne`          | _bool_       | `#t` if _u_ != _v_, otherwise `#f`
_n_ _m_              | `cmp` `lt`          | _bool_       | `#t` if _n_ < _m_, otherwise `#f`
_n_ _m_              | `cmp` `le`          | _bool_       | `#t` if _n_ <= _m_, otherwise `#f`
_n_ _m_              | `cmp` `ge`          | _bool_       | `#t` if _n_ >= _m_, otherwise `#f`
_n_ _m_              | `cmp` `gt`          | _bool_       | `#t` if _n_ > _m_, otherwise `#f`

#### `debug` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
—                    | `debug`             | —            | debugger breakpoint

#### `deque` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
—                    | `deque` `new`       | _deque_      | create a new empty _deque_
_deque_              | `deque` `empty`     | _bool_       | `#t` if _deque_ is empty, otherwise `#f`
_deque_ _value_      | `deque` `push`      | _deque'_     | insert _value_ as the first item of _deque_
_deque_              | `deque` `pop`       | _deque'_ _value_ | remove the first _value_ from _deque_, or `#?`
_deque_ _value_      | `deque` `put`       | _deque'_     | insert _value_ as the last item of _deque_
_deque_              | `deque` `pull`      | _deque'_ _value_ | remove the last _value_ from _deque_, or `#?`
_deque_              | `deque` `len`       | _n_          | count items in the _deque_

#### `dict` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_dict_ _key_         | `dict` `has`        | _bool_       | `#t` if _dict_ has a binding for _key_, otherwise `#f`
_dict_ _key_         | `dict` `get`        | _value_      | the first _value_ bound to _key_ in _dict_, or `#?`
_dict_ _key_ _value_ | `dict` `add`        | _dict'_      | add a binding from _key_ to _value_ in _dict_
_dict_ _key_ _value_ | `dict` `set`        | _dict'_      | replace or add a binding from _key_ to _value_ in _dict_
_dict_ _key_         | `dict` `del`        | _dict'_      | remove first binding for _key_ in _dict_

#### `drop` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_vₙ_ … _v₁_          | `drop` _n_          | —            | remove _n_ items from stack

#### `dup` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_vₙ_ … _v₁_          | `dup` _n_           | _vₙ_ … _v₁_ _vₙ_ … _v₁_ | duplicate top _n_ items on stack

#### `end` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_reason_             | `end` `abort`       | —            | abort actor transaction with _reason_
—                    | `end` `stop`        | —            | stop current continuation (thread)
—                    | `end` `commit`      | —            | commit actor transaction

#### `eq` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_u_                  | `eq` _v_            | _bool_       | `#t` if _u_ == _v_, otherwise `#f`

#### `if` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_bool_               | `if` _T_ [_F_]      | —            | if _bool_ is not falsy<sup>*</sup>, continue _T_ (else _F_)

<sup>*</sup> The values `#f`, `#?`, `#nil`, and `0` are considered "[falsy](https://developer.mozilla.org/en-US/docs/Glossary/Falsy)".

#### `jump` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_k_                  | `jump`              | —            | continue at _k_

Continue execution at the address taken from the stack.

 T (type)     | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+1` (jump) | `#?`        | `#?`

 1. Remove item _k_ from the stack (`#?` on underflow)
 1. If _k_ is an instruction
    1. Continue execution at _k_
 1. Otherwise
    1. Signal an error

#### `msg` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
—                    | `msg` `0`           | _msg_        | copy event message to stack
—                    | `msg` _n_           | _msgₙ_       | copy message item _n_ to stack
—                    | `msg` -_n_          | _tailₙ_      | copy message tail _n_ to stack

#### `my` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
—                    | `my` `self`         | _actor_      | push _actor_ address on stack
—                    | `my` `beh`          | _beh_        | push _actor_ behavior on stack
—                    | `my` `state`        | _vₙ_ … _v₁_  | spread _actor_ state onto stack

#### `new` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_vₙ_ … _v₁_ _beh_    | `new` _n_           | _actor_      | create an _actor_ with code _beh_ and data (_v₁_ … _vₙ_)
_state_ _beh_        | `new` `-1`          | _actor_      | create an _actor_ with code _beh_ and data _state_
(_beh_ . _state_)    | `new` `-2`          | _actor_      | create an _actor_ with code _beh_ and data _state_
\[_, _, _, _beh_\]   | `new` `-3`          | _actor_      | create an _actor_ with code _beh_ and data \[_, _, _, _beh_\]

Provide the behavior (code and data) for a new actor.
This is the actor "create" primitive.
There are several ways to provide
the code and data for the new actor,
however both are always specified.

 T            | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+28` (new) | _positive_  | _instr_

 1. Remove item _beh_ from the stack (`#?` on underflow)
 1. Form a list from the number of stack items specified by the immediate argument
 1. Create a new actor with _beh_ for code and this list for data
 1. Push a capability designating the new actor onto the stack

 T            | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+28` (new) | `+0`        | _instr_

 1. Remove item _beh_ from the stack (`#?` on underflow)
 1. Create a new actor with _beh_ for code and `()` for data
 1. Push a capability designating the new actor onto the stack

 T            | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+28` (new) | `-1`        | _instr_

 1. Remove item _beh_ from the stack (`#?` on underflow)
 1. Remove item _state_ from the stack (`#?` on underflow)
 1. Create a new actor with _beh_ for code and _state_ for data
 1. Push a capability designating the new actor onto the stack

 T            | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+28` (new) | `-2`        | _instr_

 1. Remove an item from the stack (`#?` on underflow)
 1. Create a new actor with the `X` field of this item for code and the `Y` field of this item for data
 1. Push a capability designating the new actor onto the stack

 T            | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+28` (new) | `-3`        | _instr_

 1. Remove an item from the stack (`#?` on underflow)
 1. Create a new actor with the `Z` field of this item for code and this item for data
 1. Push a capability designating the new actor onto the stack

#### `nth` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
(_v₁_ … _vₙ_ . _tailₙ_) | `nth` _n_         | _vₙ_         | copy item _n_ from a _pair_ list
(_v₁_ … _vₙ_ . _tailₙ_) | `nth` -_n_        | _tailₙ_      | copy tail _n_ from a _pair_ list

#### `pair` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
… _tail_ _head_      | `pair` _n_          | _pair_       | create _pair(s)_ from _head_ and _tail_ (_n_ times)
_vₙ_ … _v₁_          | `pair` -1           | (_v₁_ … _vₙ_) | capture stack items as a single _pair_ list

Create a _pair_ list from some number of stack items.

 T (type)     | X (op)        | Y (imm)     | Z (k)
--------------|---------------|-------------|-------------
 `#instr_t`   | `+17` (pair)  | _positive_  | _instr_

 1. Remove _n_+1 items from the stack (`#?` on underflow)
 1. Create an _n_ item list from removed stack items
    1. Item  _n_+1 will be the tail of the list
 1. Push the resulting list onto the stack

 T (type)     | X (op)        | Y (imm)     | Z (k)
--------------|---------------|-------------|-------------
 `#instr_t`   | `+17` (pair)  | `+0`        | _instr_

 1. Push `()` onto the stack

 T (type)     | X (op)        | Y (imm)     | Z (k)
--------------|---------------|-------------|-------------
 `#instr_t`   | `+17` (pair)  | _negative_  | _instr_

 1. If _n_ is `-1`
    1. Capture the entire stack as a single item on the stack
 1. Otherwise
    1. Push `#?` onto the stack

#### `part` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_pair_               | `part` _n_          | … _tail_ _head_ | split _pair_ into _head_ and _tail_ (_n_ times)
(_v₁_ … _vₙ_)        | `part` -1           | _vₙ_ … _v₁_   | spread _pair_ list items onto stack

#### `pick` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_vₙ_ … _v₁_          | `pick` _n_          | _vₙ_ … _v₁_ _vₙ_ | copy item _n_ to top of stack
_vₙ_ … _v₁_          | `pick` -_n_         | _v₁_ _vₙ_ … _v₁_ | copy top of stack before item _n_

#### `push` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
—                    | `push` _value_      | _value_      | push literal _value_ on stack

Push an immediate value onto the top of the stack.

 T (type)     | X (op)      | Y (imm)     | Z (k)
--------------|-------------|-------------|-------------
 `#instr_t`   | `+2` (push) | _any_       | _instr_

 1. Push _value_ onto the stack

#### `roll` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_vₙ_ … _v₁_          | `roll` _n_          | _vₙ₋₁_ … _v₁_ _vₙ_ | roll item _n_ to top of stack
_vₙ_ … _v₁_          | `roll` -_n_         | _v₁_ _vₙ_ … _v₂_ | roll top of stack to item _n_

#### `send` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_mₙ_ … _m₁_ _actor_  | `send` _n_          | —            | send (_m₁_ … _mₙ_) to _actor_
_msg_ _actor_        | `send` `-1`         | —            | send _msg_ to _actor_

#### `signal` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_sponsor_ _mₙ_ … _m₁_ _actor_ | `signal` _n_ | —          | send (_m₁_ … _mₙ_) to _actor_ using _sponsor_
_sponsor_ _msg_ _actor_ | `signal` `-1`    | —            | send _msg_ to _actor_ using _sponsor_

#### `sponsor` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
—                    | `sponsor` `new`     | _sponsor_    | create a new empty _sponsor_
_sponsor_ _n_        | `sponsor` `memory`  | _sponsor_    | transfer _n_ memory quota to _sponsor_
_sponsor_ _n_        | `sponsor` `events`  | _sponsor_    | transfer _n_ events quota to _sponsor_
_sponsor_ _n_        | `sponsor` `cycles`  | _sponsor_    | transfer _n_ cycles quota to _sponsor_
_sponsor_            | `sponsor` `reclaim` | _sponsor_    | reclaim all quotas from _sponsor_
_sponsor_ _control_  | `sponsor` `start`   | —            | run _sponsor_ under _control_
_sponsor_            | `sponsor` `stop`    | —            | reclaim all quotas and remove _sponsor_

#### `state` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
—                    | `state` `0`         | _state_      | copy _actor_ state to stack
—                    | `state` _n_         | _stateₙ_     | copy state item _n_ to stack
—                    | `state` -_n_        | _tailₙ_      | copy state tail _n_ to stack

#### `typeq` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_v_                  | `typeq` _T_         | _bool_       | `#t` if _v_ has type _T_, otherwise `#f`

#### `quad` instruction

 Input               | Instruction         | Output       | Description
---------------------|---------------------|--------------|-------------------------------------
_T_                  | `quad` `1`          | _quad_       | create quad \[_T_, `#?`, `#?`, `#?`\]
_X_ _T_              | `quad` `2`          | _quad_       | create quad \[_T_, _X_, `#?`, `#?`\]
_Y_ _X_ _T_          | `quad` `3`          | _quad_       | create quad \[_T_, _X_, _Y_, `#?`\]
_Z_ _Y_ _X_ _T_      | `quad` `4`          | _quad_       | create quad \[_T_, _X_, _Y_, _Z_\]
_quad_               | `quad` `-1`         | _T_          | extract 1 _quad_ field
_quad_               | `quad` `-2`         | _X_ _T_      | extract 2 _quad_ fields
_quad_               | `quad` `-3`         | _Y_ _X_ _T_  | extract 3 _quad_ fields
_quad_               | `quad` `-4`         | _Z_ _Y_ _X_ _T_ | extract 4 _quad_ fields
