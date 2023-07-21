# Virtual Machine Semantics

The [**uFork** virtual machine](../ufork.md)
is designed to support machine-level actors.
All instructions execute within the context of an actor handling a message-event.
There is no support for procedure/function call/return.
Instead actors are used to implement procedure/function abstractions.
There is no support for address arithmetic or load/store of arbitrary memory.
Mutation is always local to an actor's private state.
Immutable values are passed between actors via message-events.
External events (such as "interrupts")
are turned into message-events.

## Representation

The quad-cell is the primary internal data-structure in **uFork**.
It consists of four integers (current compile options are 16, 32, and 64 bits).

 t        | x        | y        | z
----------|----------|----------|----------
type/proc | head/car | tail/cdr | link/next

The integers in each field carry a _type tag_
in their 2 most-significant bits (MSBs).
The 1st MSB is {0=indirect-reference, 1=direct-value}.
The 2nd MSB is {0=transparent, 1=opaque}.
The resulting type-heirarchy looks like this:

```
                    any-value
                   0 /     \ 1
               indirect   direct (fixnum)
              0 /    \ 1
(quad) transparent  opaque (ocap)
```

Direct values (fixnums) are stored in 2's-complement representation,
where the 2nd MSB is the sign bit of the integer value.

Indirect values (references) desigate quad-cells (with fields {_t_, _x_, _y_, _z_}).

Opaque values (object-capabilities) cannot be dereferenced
except by the virtual-processor (to implement _actor_ primitive operations).

Transparent values designate quad that may be written as well as read.

### Data Structures

Quad-cells are used to encode most of the important data-structures in uFork.

 Structure                              | Description
----------------------------------------|---------------------------------
{t:Event_T, x:target, y:msg, z:next}    | actor event queue entry
{t:IP, x:SP, y:EP, z:next}              | continuation queue entry
{t:Instr_T, x:opcode, y:data, z:next}   | machine instruction (typical)
{t:Symbol_T, x:hash, y:string, z:value} | immutable symbolic-name
{t:Pair_T, x:head, y:tail}              | pair-lists of user data (cons)
{t:Pair_T, x:item, y:rest}              | stack entry holding _item_
{t:Actor_T, x:beh, y:sp, z:?}           | idle actor
{t:Actor_T, x:beh', y:sp', z:events}    | busy actor, intially {z:()}
{t:Fexpr_T, x:actor, y:?, z:?}          | interpreter (cust ast env)
{t:Fexpr_T, x:self, y:msgs, z:beh}      | meta-actor transaction
{t:Dict_T, x:key, y:value, z:next }     | dictionary binding entry
{t:Free_T, z:next}                      | cell in the free-list

### Instructions

The uFork instruction execution engine implements a linked-stack machine,
however the stack is only used for local state in a computation.
The _input_ for each instruction is taken from the stack
and the _output_ is placed back onto the stack.
Instructions all have a `t` field containing `Instr_T` type marker.
The operation code is carried in the `x` field of the instruction.
Many instructions also have an immediate value,
usually carried in the `y` field of the instruction.
For the typical case of a instruction with a single continuation,
the "next instruction" is carried in the `z` field of the instruction.

 Input            | Instruction                   | Output   | Description
------------------|-------------------------------|----------|------------------------------
_v_               | {x:VM_typeq, y:_T_, z:_K_}    | _bool_   | `TRUE` if _v_ has type _T_, otherwise `FALSE`
_T_               | {x:VM_cell, y:1, z:_K_}       | _cell_   | create cell {t:_T_}
_T_ _X_           | {x:VM_cell, y:2, z:_K_}       | _cell_   | create cell {t:_T_, x:_X_}
_T_ _X_ _Y_       | {x:VM_cell, y:3, z:_K_}       | _cell_   | create cell {t:_T_, x:_X_, y:_Y_}
_T_ _X_ _Y_ _Z_   | {x:VM_cell, y:4, z:_K_}       | _cell_   | create cell {t:_T_, x:_X_, y:_Y_, z:_Z_}
_cell_            | {x:VM_get, y:T, z:_K_}        | _t_      | get _t_ from _cell_
_cell_            | {x:VM_get, y:X, z:_K_}        | _x_      | get _x_ from _cell_
_cell_            | {x:VM_get, y:Y, z:_K_}        | _y_      | get _y_ from _cell_
_cell_            | {x:VM_get, y:Z, z:_K_}        | _z_      | get _z_ from _cell_
_cell_ _T_        | {x:VM_set, y:T, z:_K_}        | _cell'_  | set _t_ to _T_ in _cell_
_cell_ _X_        | {x:VM_set, y:X, z:_K_}        | _cell'_  | set _x_ to _X_ in _cell_
_cell_ _Y_        | {x:VM_set, y:Y, z:_K_}        | _cell'_  | set _y_ to _Y_ in _cell_
_cell_ _Z_        | {x:VM_set, y:Z, z:_K_}        | _cell'_  | set _z_ to _Z_ in _cell_
... _tail_ _head_ | {x:VM_pair, y:_n_, z:_K_}     | _pair_   | create {t:Pair_T, x:_head_, y:_tail_} (_n_ times)
_pair_            | {x:VM_part, y:_n_, z:_K_}     | ... _tail_ _head_ | split _pair_ into _head_ and _tail_ (_n_ times)
_pair_            | {x:VM_nth, y:_n_, z:_K_}      | _item_<sub>_n_</sub> | extract item _n_ from a _pair_ list
_pair_            | {x:VM_nth, y:-_n_, z:_K_}     | _tail_<sub>_n_</sub> | extract tail _n_ from a _pair_ list
&mdash;           | {x:VM_push, y:_value_, z:_K_} | _value_  | push literal _value_ on stack
_v_<sub>_n_</sub> ... _v_<sub>1</sub> | {x:VM_depth, z:_K_} | _v_<sub>_n_</sub> ... _v_<sub>1</sub> _n_ | count items on stack
_v_<sub>_n_</sub> ... _v_<sub>1</sub> | {x:VM_drop, y:_n_, z:_K_} | &mdash; | remove _n_ items from stack
_v_<sub>_n_</sub> ... _v_<sub>1</sub> | {x:VM_pick, y:_n_, z:_K_} | _v_<sub>_n_</sub> ... _v_<sub>1</sub> _v_<sub>_n_</sub> | copy item _n_ to top of stack
_v_<sub>_n_</sub> ... _v_<sub>1</sub> | {x:VM_dup, y:_n_, z:_K_} |_v_<sub>_n_</sub> ... _v_<sub>1</sub> _v_<sub>_n_</sub> ... _v_<sub>1</sub> | duplicate top _n_ items on stack
_v_<sub>_n_</sub> ... _v_<sub>1</sub> | {x:VM_roll, y:_n_, z:_K_} | _v_<sub>_n_-1</sub> ... _v_<sub>1</sub> _v_<sub>_n_</sub> | roll item _n_ to top of stack
_v_<sub>_n_</sub> ... _v_<sub>1</sub> | {x:VM_roll, y:-_n_, z:_K_} | _v_<sub>1</sub> _v_<sub>_n_</sub> ... _v_<sub>2</sub> | roll top of stack to item _n_
_n_               | {x:VM_alu, y:NOT, z:_K_}      | ~_n_     | bitwise not _n_
_n_ _m_           | {x:VM_alu, y:AND, z:_K_}      | _n_&_m_  | bitwise _n_ and _m_
_n_ _m_           | {x:VM_alu, y:OR, z:_K_}       | _n_\|_m_ | bitwise _n_ or _m_
_n_ _m_           | {x:VM_alu, y:XOR, z:_K_}      | _n_^_m_  | bitwise _n_ exclusive-or _m_
_n_ _m_           | {x:VM_alu, y:ADD, z:_K_}      | _n_+_m_  | sum of _n_ and _m_
_n_ _m_           | {x:VM_alu, y:SUB, z:_K_}      | _n_-_m_  | difference of _n_ and _m_
_n_ _m_           | {x:VM_alu, y:MUL, z:_K_}      | _n_\*_m_ | product of _n_ and _m_
_m_               | {x:VM_eq, y:_n_, z:_K_}       | _bool_   | `TRUE` if _n_ == _m_, otherwise `FALSE`
_n_ _m_           | {x:VM_cmp, y:EQ, z:_K_}       | _bool_   | `TRUE` if _n_ == _m_, otherwise `FALSE`
_n_ _m_           | {x:VM_cmp, y:GE, z:_K_}       | _bool_   | `TRUE` if _n_ >= _m_, otherwise `FALSE`
_n_ _m_           | {x:VM_cmp, y:GT, z:_K_}       | _bool_   | `TRUE` if _n_ > _m_, otherwise `FALSE`
_n_ _m_           | {x:VM_cmp, y:LT, z:_K_}       | _bool_   | `TRUE` if _n_ < _m_, otherwise `FALSE`
_n_ _m_           | {x:VM_cmp, y:LE, z:_K_}       | _bool_   | `TRUE` if _n_ <= _m_, otherwise `FALSE`
_n_ _m_           | {x:VM_cmp, y:NE, z:_K_}       | _bool_   | `TRUE` if _n_ != _m_, otherwise `FALSE`
_n_ _c_           | {x:VM_cmp, y:CLS, z:_K_}      | _bool_   | `TRUE` if _n_ in _c_, otherwise `FALSE`
_bool_            | {x:VM_if, y:_T_, z:_F_}       | &mdash;  | continue _F_ if "falsy", otherwise continue _T_
&mdash;           | {x:VM_msg, y:0, z:_K_}        | _msg_    | copy event message to stack
&mdash;           | {x:VM_msg, y:_n_, z:_K_}      | _msg_<sub>_n_</sub> | copy message item _n_ to stack
&mdash;           | {x:VM_msg, y:-_n_, z:_K_}     | _tail_<sub>_n_</sub> | copy message tail _n_ to stack
&mdash;           | {x:VM_my, y:SELF, z:_K_}      | _actor_  | push current _actor_ address on stack
&mdash;           | {x:VM_my, y:BEH, z:_K_}       | _beh_    | push current _actor_ behavior on stack
&mdash;           | {x:VM_my, y:STATE, z:_K_}     | _v_<sub>1</sub> ... _v_<sub>_n_</sub> | push current _actor_ state on stack
_msg_ _actor_     | {x:VM_send, y:0, z:_K_}       | &mdash;  | send _msg_ to _actor_
_m_<sub>_n_</sub> ... _m_<sub>1</sub> _actor_ | {x:VM_send, y:_n_, z:_K_}   | &mdash; | send (_m_<sub>1</sub> ... _m_<sub>_n_</sub>) to _actor_
_beh_             | {x:VM_new, y:0, z:_K_}        | _actor_  | create new _actor_ with behavior _beh_
_v_<sub>1</sub> ... _v_<sub>_n_</sub> _beh_ | {x:VM_new, y:_n_, z:_K_} | _actor_ | create new _actor_ with (_v_<sub>1</sub> ... _v_<sub>_n_</sub> . _beh_)
_beh_             | {x:VM_beh, y:0, z:_K_}        | &mdash;  | replace behavior with _beh_
_v_<sub>1</sub> ... _v_<sub>_n_</sub> _beh_ | {x:VM_beh, y:_n_, z:_K_} | &mdash; | replace behavior with (_v_<sub>1</sub> ... _v_<sub>_n_</sub> . _beh_)
_reason_          | {x:VM_end, y:ABORT}           | &mdash;  | abort actor transaction with _reason_
&mdash;           | {x:VM_end, y:STOP}            | &mdash;  | stop current continuation (thread)
&mdash;           | {x:VM_end, y:COMMIT}          | &mdash;  | commit actor transaction
&mdash;           | {x:VM_end, y:RELEASE}         | &mdash;  | commit transaction and free actor
_chars_           | {x:VM_cvt, y:LST_NUM, z:_K_}  | _fixnum_ | convert _chars_ to _fixnum_
_chars_           | {x:VM_cvt, y:LST_SYM, z:_K_}  | _symbol_ | convert _chars_ to _symbol_
_char_            | {x:VM_putc, z:_K_}            | &mdash;  | write _char_ to console
&mdash;           | {x:VM_getc, z:_K_}            | _char_   | read _char_ from console
_value_           | {x:VM_debug, y:_tag_, z:_K_}  | &mdash;  | debug_print _tag_: _value_ to console

### Object Graph

The diagram below shows a typical graph of quad-cells
representing the contents of the `e_queue` (event queue)
and the `k_queue` (continuation queue).
These two queues, plus the global symbol table,
and the interrupt-handling actors,
form the root-set of objects for [garbage-collection](gc.md).

```
e_queue: [head,tail]--------------------------+
          |                                   V
          +-->[Event,to,msg,next]---> ... -->[Event,to,msg,NIL]
                     |   |
                     |   +--> actor message content
                     V
                    [Actor,beh,sp,?]
                            |  |
                            |  +--> actor state (initial SP)
                            |
                            +--> actor behavior (initial IP)

k_queue: [head,tail]--------------------+
          |                             V
          +-->[ip,sp,ep,kp]---> ... -->[ip,sp,ep,NIL]
               |  |  |
               |  |  +-->[Event,to,msg,NIL]
               |  |             |   |
               |  |             |   +--> ...
               |  |             V
               |  |            [Actor,beh',sp',events]---> ... -->[Event,to,msg,NIL]
               |  V
               | [Pair,car,cdr,?]
               |        |   |
               |        |   +--> ... -->[Pair,car,NIL,?]
               |        V
               |       item
               V
              [Op,EQ,0,k]
                       |
                       +--> [Op,IF,t,f]
                                   | |
                                   | +--> ...
                                   V
                                   ...
```

### Pair-List Indexing

Instructions like `VM_nth` and `VM_msg` have an immediate index argument (_n_)
to succinctly designate parts of a pair-list.

  * Positive _n_ designates elements of the list, starting at `1`.
  * Negative _n_ designates list tails, starting at `-1`.
  * Zero designates the whole list/value (for messages).

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

If the index is out-of-bounds, the result is `?` (undefined).

### Character Classes

The `{x:VM_cmp, y:CLS}` instruction
produces `TRUE` if a character value
is part of the specified class,
or `FALSE` otherwise.
The class is defined as a union
of the named classes:

  * `CTL` Control Character
  * `DGT` Decimal Digit
  * `UPR` Uppercase Letter
  * `LWR` Lowercase Letter
  * `DLM` Delimiter
  * `SYM` Name Symbol
  * `HEX` Hexadecimal Digit
  * `WSP` Whitespace

The tables below define which characters are included in each class.

| ch | dec | hex | CTL | DGT | UPR | LWR | DLM | SYM | HEX | WSP |
|----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| ^@ |   0 |  00 |  x  |     |     |     |     |     |     |     |
| ^A |   1 |  01 |  x  |     |     |     |     |     |     |     |
| ^B |   2 |  02 |  x  |     |     |     |     |     |     |     |
| ^C |   3 |  03 |  x  |     |     |     |     |     |     |     |
| ^D |   4 |  04 |  x  |     |     |     |     |     |     |     |
| ^E |   5 |  05 |  x  |     |     |     |     |     |     |     |
| ^F |   6 |  06 |  x  |     |     |     |     |     |     |     |
| ^G |   7 |  07 |  x  |     |     |     |     |     |     |     |
| ^H |   8 |  08 |  x  |     |     |     |     |     |     |     |
| ^I |   9 |  09 |  x  |     |     |     |     |     |     |  x  |
| ^J |  10 |  0a |  x  |     |     |     |     |     |     |  x  |
| ^K |  11 |  0b |  x  |     |     |     |     |     |     |  x  |
| ^L |  12 |  0c |  x  |     |     |     |     |     |     |  x  |
| ^M |  13 |  0d |  x  |     |     |     |     |     |     |  x  |
| ^N |  14 |  0e |  x  |     |     |     |     |     |     |     |
| ^O |  15 |  0f |  x  |     |     |     |     |     |     |     |
| ^P |  16 |  10 |  x  |     |     |     |     |     |     |     |
| ^Q |  17 |  11 |  x  |     |     |     |     |     |     |     |
| ^R |  18 |  12 |  x  |     |     |     |     |     |     |     |
| ^S |  19 |  13 |  x  |     |     |     |     |     |     |     |
| ^T |  20 |  14 |  x  |     |     |     |     |     |     |     |
| ^U |  21 |  15 |  x  |     |     |     |     |     |     |     |
| ^V |  22 |  16 |  x  |     |     |     |     |     |     |     |
| ^W |  23 |  17 |  x  |     |     |     |     |     |     |     |
| ^X |  24 |  18 |  x  |     |     |     |     |     |     |     |
| ^Y |  25 |  19 |  x  |     |     |     |     |     |     |     |
| ^Z |  26 |  1a |  x  |     |     |     |     |     |     |     |
| ^[ |  27 |  1b |  x  |     |     |     |     |     |     |     |
| ^\ |  28 |  1c |  x  |     |     |     |     |     |     |     |
| ^] |  29 |  1d |  x  |     |     |     |     |     |     |     |
| ^^ |  30 |  1e |  x  |     |     |     |     |     |     |     |
| ^_ |  31 |  1f |  x  |     |     |     |     |     |     |     |

| ch | dec | hex | CTL | DGT | UPR | LWR | DLM | SYM | HEX | WSP |
|----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
|    |  32 |  20 |     |     |     |     |     |     |     |  x  |
| !  |  33 |  21 |     |     |     |     |     |  x  |     |     |
| "  |  34 |  22 |     |     |     |     |  x  |     |     |     |
| #  |  35 |  23 |     |     |     |     |     |  x  |     |     |
| $  |  36 |  24 |     |     |     |     |     |  x  |     |     |
| %  |  37 |  25 |     |     |     |     |     |  x  |     |     |
| &  |  38 |  26 |     |     |     |     |     |  x  |     |     |
| '  |  39 |  27 |     |     |     |     |  x  |     |     |     |
| (  |  40 |  28 |     |     |     |     |  x  |     |     |     |
| )  |  41 |  29 |     |     |     |     |  x  |     |     |     |
| \* |  42 |  2a |     |     |     |     |     |  x  |     |     |
| +  |  43 |  2b |     |     |     |     |     |  x  |     |     |
| ,  |  44 |  2c |     |     |     |     |  x  |     |     |     |
| -  |  45 |  2d |     |     |     |     |     |  x  |     |     |
| .  |  46 |  2e |     |     |     |     |     |  x  |     |     |
| /  |  47 |  2f |     |     |     |     |     |  x  |     |     |
| 0  |  48 |  30 |     |  x  |     |     |     |     |  x  |     |
| 1  |  49 |  31 |     |  x  |     |     |     |     |  x  |     |
| 2  |  50 |  32 |     |  x  |     |     |     |     |  x  |     |
| 3  |  51 |  33 |     |  x  |     |     |     |     |  x  |     |
| 4  |  52 |  34 |     |  x  |     |     |     |     |  x  |     |
| 5  |  53 |  35 |     |  x  |     |     |     |     |  x  |     |
| 6  |  54 |  36 |     |  x  |     |     |     |     |  x  |     |
| 7  |  55 |  37 |     |  x  |     |     |     |     |  x  |     |
| 8  |  56 |  38 |     |  x  |     |     |     |     |  x  |     |
| 9  |  57 |  39 |     |  x  |     |     |     |     |  x  |     |
| :  |  58 |  3a |     |     |     |     |     |  x  |     |     |
| ;  |  59 |  3b |     |     |     |     |  x  |     |     |     |
| <  |  60 |  3c |     |     |     |     |     |  x  |     |     |
| =  |  61 |  3d |     |     |     |     |     |  x  |     |     |
| >  |  62 |  3e |     |     |     |     |     |  x  |     |     |
| ?  |  63 |  3f |     |     |     |     |     |  x  |     |     |

| ch | dec | hex | CTL | DGT | UPR | LWR | DLM | SYM | HEX | WSP |
|----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| @  |  64 |  40 |     |     |     |     |     |  x  |     |     |
| A  |  65 |  41 |     |     |  x  |     |     |     |  x  |     |
| B  |  66 |  42 |     |     |  x  |     |     |     |  x  |     |
| C  |  67 |  43 |     |     |  x  |     |     |     |  x  |     |
| D  |  68 |  44 |     |     |  x  |     |     |     |  x  |     |
| E  |  69 |  45 |     |     |  x  |     |     |     |  x  |     |
| F  |  70 |  46 |     |     |  x  |     |     |     |  x  |     |
| G  |  71 |  47 |     |     |  x  |     |     |     |     |     |
| H  |  72 |  48 |     |     |  x  |     |     |     |     |     |
| I  |  73 |  49 |     |     |  x  |     |     |     |     |     |
| J  |  74 |  4a |     |     |  x  |     |     |     |     |     |
| K  |  75 |  4b |     |     |  x  |     |     |     |     |     |
| L  |  76 |  4c |     |     |  x  |     |     |     |     |     |
| M  |  77 |  4d |     |     |  x  |     |     |     |     |     |
| N  |  78 |  4e |     |     |  x  |     |     |     |     |     |
| O  |  79 |  4f |     |     |  x  |     |     |     |     |     |
| P  |  80 |  50 |     |     |  x  |     |     |     |     |     |
| Q  |  81 |  51 |     |     |  x  |     |     |     |     |     |
| R  |  82 |  52 |     |     |  x  |     |     |     |     |     |
| S  |  83 |  53 |     |     |  x  |     |     |     |     |     |
| T  |  84 |  54 |     |     |  x  |     |     |     |     |     |
| U  |  85 |  55 |     |     |  x  |     |     |     |     |     |
| V  |  86 |  56 |     |     |  x  |     |     |     |     |     |
| W  |  87 |  57 |     |     |  x  |     |     |     |     |     |
| X  |  88 |  58 |     |     |  x  |     |     |     |     |     |
| Y  |  89 |  59 |     |     |  x  |     |     |     |     |     |
| Z  |  90 |  5a |     |     |  x  |     |     |     |     |     |
| [  |  91 |  5b |     |     |     |     |  x  |     |     |     |
| \\ |  92 |  5c |     |     |     |     |     |  x  |     |     |
| ]  |  93 |  5d |     |     |     |     |  x  |     |     |     |
| ^  |  94 |  5e |     |     |     |     |     |  x  |     |     |
| \_ |  95 |  5f |     |     |     |     |     |  x  |     |     |

| ch | dec | hex | CTL | DGT | UPR | LWR | DLM | SYM | HEX | WSP |
|----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| \` |  96 |  60 |     |     |     |     |  x  |     |     |     |
| a  |  97 |  61 |     |     |     |  x  |     |     |  x  |     |
| b  |  98 |  62 |     |     |     |  x  |     |     |  x  |     |
| c  |  99 |  63 |     |     |     |  x  |     |     |  x  |     |
| d  | 100 |  64 |     |     |     |  x  |     |     |  x  |     |
| e  | 101 |  65 |     |     |     |  x  |     |     |  x  |     |
| f  | 102 |  66 |     |     |     |  x  |     |     |  x  |     |
| g  | 103 |  67 |     |     |     |  x  |     |     |     |     |
| h  | 104 |  68 |     |     |     |  x  |     |     |     |     |
| i  | 105 |  69 |     |     |     |  x  |     |     |     |     |
| j  | 106 |  6a |     |     |     |  x  |     |     |     |     |
| k  | 107 |  6b |     |     |     |  x  |     |     |     |     |
| l  | 108 |  6c |     |     |     |  x  |     |     |     |     |
| m  | 109 |  6d |     |     |     |  x  |     |     |     |     |
| n  | 110 |  6e |     |     |     |  x  |     |     |     |     |
| o  | 111 |  6f |     |     |     |  x  |     |     |     |     |
| p  | 112 |  70 |     |     |     |  x  |     |     |     |     |
| q  | 113 |  71 |     |     |     |  x  |     |     |     |     |
| r  | 114 |  72 |     |     |     |  x  |     |     |     |     |
| s  | 115 |  73 |     |     |     |  x  |     |     |     |     |
| t  | 116 |  74 |     |     |     |  x  |     |     |     |     |
| u  | 117 |  75 |     |     |     |  x  |     |     |     |     |
| v  | 118 |  76 |     |     |     |  x  |     |     |     |     |
| w  | 119 |  77 |     |     |     |  x  |     |     |     |     |
| x  | 120 |  78 |     |     |     |  x  |     |     |     |     |
| y  | 121 |  79 |     |     |     |  x  |     |     |     |     |
| z  | 122 |  7a |     |     |     |  x  |     |     |     |     |
| {  | 123 |  7b |     |     |     |     |  x  |     |     |     |
| \| | 124 |  7c |     |     |     |     |  x  |     |     |     |
| }  | 125 |  7d |     |     |     |     |  x  |     |     |     |
| ~  | 126 |  7e |     |     |     |     |     |  x  |     |     |
| ^? | 127 |  7f |  x  |     |     |     |     |     |     |     |

### Common Code Structures

Many instruction streams end with a common suffix.
These immutable continuation sequences are available
to be shared by many behaviors.

```
K_CALL:     [MSG,+0,k]---+
                         |
                         |
RESEND:     [MSG,+0,k]   |    RV_ZERO:    [PUSH,+0,k]-----+
                    |    |                                |
                    v    |                                |
            [SELF,?,k]---+    RV_NIL:     [PUSH,NIL,k]----+
                         |                                |
                         |                                |
RV_SELF:    [SELF,?,k]   |    RV_UNDEF:   [PUSH,UNDEF,k]--+
                    |    |                                |
                    v    |                                |
CUST_SEND:  [MSG,+1,k]<--|--------------------------------+
                    |    |
                    v    |
SEND_0:     [SEND,0,k]<--+    RELEASE_0:  [SEND,0,k]
                    |                             |
                    v                             v
COMMIT:     [END,+1,?]        RELEASE:    [END,+2,?]
```
