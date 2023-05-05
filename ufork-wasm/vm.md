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
It consists of four integers (current WASM target is 32 bits).

 t        | x        | y        | z
----------|----------|----------|----------
type/proc | head/car | tail/cdr | link/next

The integers in each field carry a _type tag_
in their 4 most-significant bits (MSBs).
The 1st MSB is {0=indirect-reference, 1=direct-value}.
The 2nd MSB is {0=transparent, 1=opaque}.
The 3rd MSB is {0=immutable, 1=mutable}.
The 4th MSB is reserved for a garbage-collection phase/generation marker.
The resulting type-heirarchy looks like this:

```
                   any-value
                  0 /     \ 1
              indirect   direct (fixnum)
             0 /    \ 1
      transparent  opaque (ocap)
     0 /       \ 1
immutable     mutable
  (rom)      0 /   \ 1
           (ram0) (ram1)
```

Direct values (fixnums) are stored in 2's-complement representation,
where the 2nd MSB is the sign bit of the integer value.

Indirect values (references) desigate quad-cells (with fields {_t_, _x_, _y_, _z_}).

Opaque values (object-capabilities) cannot be dereferenced
except by the virtual-processor (to implement _actor_ primitive operations).

Mutable values designate a quad that may be written as well as read.
Since actor-state is mutable, the quad representing the actor must stored in writable memory.

The assembly language semantics provide no way to convert between _fixnums_, _ocaps_, and quad-cell references.

### Data Structures

Quad-cells are used to encode most of the important data-structures in uFork.

 Structure                              | Description
----------------------------------------|---------------------------------
{t:sponsor, x:target, y:msg, z:next}    | actor event queue entry
{t:IP, x:SP, y:EP, z:next}              | continuation queue entry
{t:Instr_T, x:opcode, y:data, z:next}   | machine instruction (typical)
{t:Pair_T, x:head, y:tail}              | pair-lists of user data (cons)
{t:Pair_T, x:item, y:rest}              | stack entry holding _item_
{t:Actor_T, x:beh, y:sp, z:?}           | idle actor
{t:Actor_T, x:beh', y:sp', z:events}    | busy actor, intially {z:()}
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
_T_               | {x:VM_cell, y:1, z:_K_}       | _cell_   | create cell {t:_T_} **--RESERVED--**
_T_ _X_           | {x:VM_cell, y:2, z:_K_}       | _cell_   | create cell {t:_T_, x:_X_} **--RESERVED--**
_T_ _X_ _Y_       | {x:VM_cell, y:3, z:_K_}       | _cell_   | create cell {t:_T_, x:_X_, y:_Y_} **--RESERVED--**
_T_ _X_ _Y_ _Z_   | {x:VM_cell, y:4, z:_K_}       | _cell_   | create cell {t:_T_, x:_X_, y:_Y_, z:_Z_} **--RESERVED--**
_cell_            | {x:VM_get, y:T, z:_K_}        | _t_      | get _t_ from _cell_ **--RESERVED--**
_cell_            | {x:VM_get, y:X, z:_K_}        | _x_      | get _x_ from _cell_ **--RESERVED--**
_cell_            | {x:VM_get, y:Y, z:_K_}        | _y_      | get _y_ from _cell_ **--RESERVED--**
_cell_            | {x:VM_get, y:Z, z:_K_}        | _z_      | get _z_ from _cell_ **--RESERVED--**
_dict_ _key_      | {x:VM_dict, y:HAS, z:_K_}     | _bool_   | `TRUE` if _dict_ has a binding for _key_, otherwise `FALSE`
_dict_ _key_      | {x:VM_dict, y:GET, z:_K_}     | _value_  | the first _value_ bound to _key_ in _dict_, or `UNDEF`
_dict_ _key_ _value_ | {x:VM_dict, y:ADD, z:_K_}  | _dict'_  | add a binding from _key_ to _value_ in _dict_
_dict_ _key_ _value_ | {x:VM_dict, y:SET, z:_K_}  | _dict'_  | replace or add a binding from _key_ to _value_ in _dict_
_dict_ _key_      | {x:VM_dict, y:DEL, z:_K_}     | _dict'_  | remove a binding from _key_ to _value_ in _dict_
&mdash;           | {x:VM_deque, y:NEW, z:_K_}    | _deque_  | create a new empty _deque_
_deque_           | {x:VM_deque, y:EMPTY, z:_K_}  | _bool_   | `TRUE` if _deque_ is empty, otherwise `FALSE`
_deque_ _value_   | {x:VM_deque, y:PUSH, z:_K_}   | _deque'_ | insert _value_ as the first element of _deque_
_deque_           | {x:VM_deque, y:POP, z:_K_}    | _deque'_ _value_ | remove the first _value_ from _deque_, or `UNDEF`
_deque_ _value_   | {x:VM_deque, y:PUT, z:_K_}    | _deque'_ | insert _value_ as the last element of _deque_
_deque_           | {x:VM_deque, y:PULL, z:_K_}   | _deque'_ _value_ | remove the last _value_ from _deque_, or `UNDEF`
_deque_           | {x:VM_deque, y:LEN, z:_K_}    | _n_      | count elements in the _deque_
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
_bool_            | {x:VM_if, y:_T_, z:_F_}       | &mdash;  | continue _F_ if "falsey", otherwise continue _T_
&mdash;           | {x:VM_msg, y:0, z:_K_}        | _msg_    | copy event message to stack
&mdash;           | {x:VM_msg, y:_n_, z:_K_}      | _msg_<sub>_n_</sub> | copy message item _n_ to stack
&mdash;           | {x:VM_msg, y:-_n_, z:_K_}     | _tail_<sub>_n_</sub> | copy message tail _n_ to stack
&mdash;           | {x:VM_state, y:0, z:_K_}      | _state_  | copy _actor_ state to stack
&mdash;           | {x:VM_state, y:_n_, z:_K_}    | _state_<sub>_n_</sub> | copy state item _n_ to stack
&mdash;           | {x:VM_state, y:-_n_, z:_K_}   | _tail_<sub>_n_</sub> | copy state tail _n_ to stack
&mdash;           | {x:VM_my, y:SELF, z:_K_}      | _actor_  | push _actor_ address on stack
&mdash;           | {x:VM_my, y:BEH, z:_K_}       | _beh_    | push _actor_ behavior on stack
&mdash;           | {x:VM_my, y:STATE, z:_K_}     | _v_<sub>_n_</sub> ... _v_<sub>1</sub> | flatten _actor_ state onto stack
_msg_ _actor_     | {x:VM_send, y:-1, z:_K_}      | &mdash;  | send _msg_ to _actor_
_m_<sub>_n_</sub> ... _m_<sub>1</sub> _actor_ | {x:VM_send, y:_n_, z:_K_}   | &mdash; | send (_m_<sub>1</sub> ... _m_<sub>_n_</sub>) to _actor_
_state_ _beh_     | {x:VM_new, y:-1, z:_K_}       | _actor_  | create new _actor_ with code _beh_ and data _state_
_v_<sub>_n_</sub> ... _v_<sub>1</sub> _beh_ | {x:VM_new, y:_n_, z:_K_} | _actor_ | create new _actor_ code _beh_ and state (_v_<sub>1</sub> ... _v_<sub>_n_</sub>)
_state_ _beh_     | {x:VM_beh, y:-1, z:_K_}       | &mdash;  | replace code with _beh_ and data with _state_
_v_<sub>_n_</sub> ... _v_<sub>1</sub> _beh_ | {x:VM_beh, y:_n_, z:_K_} | &mdash; | replace code with _beh_ and state with (_v_<sub>1</sub> ... _v_<sub>_n_</sub>)
_reason_          | {x:VM_end, y:ABORT}           | &mdash;  | abort actor transaction with _reason_
&mdash;           | {x:VM_end, y:STOP}            | &mdash;  | stop current continuation (thread)
&mdash;           | {x:VM_end, y:COMMIT}          | &mdash;  | commit actor transaction
&mdash;           | {x:VM_end, y:RELEASE}         | &mdash;  | commit transaction and free actor **--DEPRECATED--**
_actual_          | {x:VM_is_eq, y:_expect_, z:_K_} | &mdash; | assert `actual` == `expect`, otherwise halt!
_actual_          | {x:VM_is_ne, y:_expect_, z:_K_} | &mdash; | assert `actual` != `expect`, otherwise halt!

### Object Graph

The diagram below shows a typical graph of quad-cells
representing the contents of the `e_queue` (event queue)
and the `k_queue` (continuation queue).
These two queues, and the interrupt-handling actors,
form the root-set of objects for garbage-collection.

```
e_queue: [head,tail]----------------------------+
          |                                     V
          +-->[sponsor,to,msg,next]---> ... -->[sponsor,to,msg,NIL]
                       |   |
                       |   +--> actor message content
                       V
                      [Actor,code,data,?]
                              |    |
                              |    +--> actor state
                              |
                              +--> actor behavior

k_queue: [head,tail]--------------------+
          |                             V
          +-->[ip,sp,ep,kp]---> ... -->[ip,sp,ep,NIL]
               |  |  |
               |  |  +-->[sponsor,to,msg,NIL]
               |  |               |   |
               |  |               |   +--> ...
               |  |               V
               |  |              [Actor,code,data,effects]--->[Actor,code',data',events]---> ... -->[sponsor,to,msg,NIL]
               |  V
               | [Pair,car,cdr,?]
               |        |   |
               |        |   +--> ... -->[Pair,car,NIL,?]
               |        V
               |       item
               V
              [Instr,EQ,0,k]
                          |
                          +--> [Instr,IF,t,f]
                                         | |
                                         | +--> ...
                                         V
                                         ...
```

### Pair-List Indexing

Instructions like `VM_msg`, `VM_state`, and `VM_nth`
have an immediate index argument (_n_)
to succinctly designate parts of a pair-list.

  * Positive _n_ designates elements of the list, starting at `1`
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

If the index is out-of-bounds, the result is `?` (undefined).
