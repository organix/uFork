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
in their 3 most-significant bits (MSBs).
The 1st MSB is {0=indirect-reference, 1=direct-value}.
The 2nd MSB is {0=transparent, 1=opaque}.
The 3rd MSB is {0=immutable, 1=mutable}.
The resulting type-heirarchy looks like this:

```
                   any-value
                  0 /     \ 1
              indirect   direct (fixnum)
             0 /    \ 1
      transparent  opaque (ocap)
     0 /       \ 1
immutable     mutable
  (rom)        (ram)
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
{t:Actor_T, x:beh, y:sp, z:effect}      | busy actor
{t:Actor_T, x:beh', y:sp', z:events}    | effect accumulator, intially z: ()
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

The semantics for each instruction are described in the [assembly-language manual](asm.md).

### Object Graph

The diagram below shows a typical graph of quad-cells
representing the contents of the `e_queue` (event queue)
and the `k_queue` (continuation queue).
These two queues, and the interrupt-handling actors,
form the root-set of objects for [garbage-collection](gc.md).

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
               |  |              [Actor,code,data,effect]--->[Actor,code',data',events]---> ... -->[sponsor,to,msg,NIL]
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
