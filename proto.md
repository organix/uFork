# Actor Protocol Design

Actor protocols are based on asynchronous messages.
All computation in uFork is driven by
the execution of an actor's behavior
as a reaction to the dispatch of a message-event.
A particular actor will only process
one message-event at a time.
The effects of the event are applied transactionally
when (and if) the actor behavior terminates with a commit.
Effects are limited to:

  * Creating new actors
  * Sending new messages to known actors
  * Designating a new behavior/state for handling subsequent messages

Messages are immutable data-structures.
They can be as simple as a single primitive value,
or complex structures composed of
nested pairs and/or dictionaries.
Primitive values include:

  * Fixnums
  * Quad-memory references
  * Capabilities

Pairs and dictionaries
are structures held in quad-memory.
Actor states are defined just like messages.
Actor behaviors are quad-memory references
to graphs of instructions.

## Simple Messages

The simplest form of message
is a single primitive value.
Since message-events are asynchronous,
sending is decoupled from receiving.
The sender never knows when (or if) a message arrives.
The receiver doesn't know when a message was sent,
or the identity of the sender.

The most common use of single-value messages
is the delivery of _result_ values.
Sometimes a _request_ (that produces a result)
consists of simply a _capability_
designating the actor to whom the result is sent.

For example,
the _clock_ device
expects a message
consisting of only a _customer_ capability.
On receipt of such a message,
the clock device sends a _fixnum_ time value
to the actor designated as the customer.
Each of the messages in this protocol,
both the request and the result,
are simple single values.

Simple values also include the five literal constants:

  * `#?` (undefined)
  * `#nil` (empty list)
  * `#unit`
  * `#t` (boolean true)
  * `#f` (boolean false)

## Pair-List Messages

Most messages require more information
than can be conveyed in a single value.
List-like structures can be created
by combining pairs of values.

A _pair_ combines two values (simple or complex)
called the _head_ and the _tail_.
A pair can be printed as `(head . tail)`
in order to emphasize its components.

A _list_ can be represented by a sequence of pairs,
where the _head_ of each pair is an element of the list,
and the _tail_ of each pair is another list.
The base-case is the empty list,
represented by the `#nil` literal in uFork assembly,
and usually printed as `()`.

A list is usually printed in a more compact form than a pair.
The list `(1 2 3)` is an abbreviation for
the pair structure `(1 . (2 . (3 . #nil)))`.
uFork instructions provide convenient accessors for pair-lists.
An index argument _n_ succinctly designates a component:

  * Positive _n_ designates elements of the list, starting at `1`
  * Negative _n_ designates list tails, starting at `-1`
  * Zero designates the whole list/value

```
  0                -1                -2                -3
---->(head . tail)---->(head . tail)---->(head . tail)---->...
    +1 |              +2 |              +3 |
       V                 V                 V
```

If the index is out-of-bounds, the result is `#?` (undefined).
As an example, consider indexing into the list `(1 2 3)`:

 Index | Value
-------|----------
 0     | `(1 2 3)`
 1     | `1`
-1     | `(2 3)`
 2     | `2`
-2     | `(3)`
 3     | `3`
-3     | `()`
 4     | `#?`
-4     | `#?`

The [uFork instructions](ufork-wasm/asm.md#instructions)
for sending a message
or defining an actor's behavior/state
provide convenient support
for creating pair-lists from stack elements.
Pair structures can also be conveniently
composed from stack elements,
or decomposed onto the stack.

### Explicit Customers

Call-return is a common pattern in actor protocols.
It is used for sequencing
when a computation is dependent on
the result of another computation.
A _call_ is a normal one-way asynchronous message
containing an actor who will receive the _return_ value.
The receiving actor is referred to as the _customer_.
This pattern is sometimes called
"[continuation-passing style](https://en.wikipedia.org/wiki/Continuation-passing_style)".
This actor protocol is strictly more flexible
than synchronous call-return
because the customer does not have to be the caller.
For example, the customer could be the next actor in a processing pipeline.

The usual convention is to provide the _customer_
as the first element of a list-structured message.
Viewed as a pair, a _call_ looks like `(customer . request)`.
If the _request_ is `()`,
the call degenerates to the one-element list `(customer)`.
This convention is most appropriate
for representing arguments lists
in function/procedure calls.

Note that some services
(like the _clock_ device described above)
expect the entire message to be just the _customer_.
The idioms in [`lib.asm`](ufork-wasm/lib/lib.asm)
include adapters (`wrap`/`unwrap`)
to convert between these conventions.

### Behavior Signatures

All processing in uFork is performed by executing [instructions](ufork-wasm/asm.md#instructions)
in the context of handling an actor message-event.
An instruction graph defines the _behavior_ of an actor.
The _signature_ of a behavior describes
the expected actor _state_ structure and _message_ structure.
We write a behavior signature as `state <- message`.

Consider the adapter [`wrap_beh`](ufork-wasm/lib/lib.asm),
which expects the state to be a single-element list designating the receiver
and the message to be a single value:

```
wrap_beh:               ; (rcvr) <- msg
    msg 0               ; msg
    state 1             ; msg rcvr
    send 1              ; --
    end commit
```

An actor with "wrap" behavior
creates a single-element list
containing the message
and sends it to the receiver.

Now consider the adapter [`unwrap_beh`](ufork-wasm/lib/lib.asm),
which expects the state to be a single-element list designating the receiver
and the message to be a single-element list:

```
unwrap_beh:             ; (rcvr) <- (msg)
    msg 1               ; msg
    state 1             ; msg rcvr
    send -1             ; --
    end commit
```

An actor with "unwrap" behavior
extracts the message from a single-element list
and sends it to the receiver.

Finally, consider a constant-function [`const_beh`](ufork-wasm/lib/lib.asm),
which expects the state to be a single value,
and the message to be a pair-list
with the _customer_ as the first element:

```
const_beh:              ; value <- (cust . _)
    state 0             ; value
    msg 1               ; value cust
    send -1             ; --
    end commit
```

An actor with "constant" behavior
sends the state _value_
to the _customer_ at the head of the argument-list.
The `. _)` at the end of the message-pattern
indicates that the tail of the argument-list is ignored.

### Object-Oriented Protocols

While an _explicit customer_
is appropriate for _functional_ or _procedural_ actor protocols,
an _object-oriented_ actor protocol requires the addition
of a _method selector_ to the message.
We still need a _customer_ to receive the _result_,
so prepending the selector to the argument-list
produces the message pattern `(selector customer . request)`.

There is no shared mutable state in an actor system.
There can be lots of shared **immutable** state,
and each actor manages their own **private** mutable state.
In uFork, the actor's state isn't _directly_ mutable,
but it can be replaced (along with the behavior)
as part of a message-handling transaction.
This suggests an _object-oriented_ representation
where a single actor is the _state holder_,
and messages with _methods selectors_ may cause
changes to the actor's private state.

Consider the behavior of an actor representing a "mutable" [storage-cell](ufork-wasm/lib/cell.asm):

```
read_tag:
    ref 0
write_tag:
    ref 1
CAS_tag:
    ref -1

cell_beh:               ; (value) <- (tag cust . req)
    msg 1               ; tag
    eq read_tag         ; tag=="read"
    if read             ; --
    msg 1               ; tag
    eq write_tag        ; tag=="write"
    if write            ; --
    msg 1               ; tag
    eq CAS_tag          ; tag=="CAS"
    if CAS              ; --
    end abort
```

The first part of the behavior is essentially a _method dispatch table_
comparing the method-selector _tag_ against an enumeration of fixnum constants.
If a match is found, the behavior branches to the appropriate handler code.
If no match is found, the message-event transaction is aborted.

```
read:                   ; (value) <- (tag cust)
    state 1             ; value
    msg 2               ; value cust
    send -1             ; --
    end commit
```

The "read" handler expects a message matching `(tag cust)`.
Note that this is a subset of the top-level pattern `(tag cust . req)`
where `req` is `()`.
Reading the cell entails sending the current state `value`
to the customer actor `cust`.

```
write:                  ; (value) <- (tag cust value')
    msg -2              ; (value')
    my beh              ; (value') beh
    beh -1              ; --
    my self             ; SELF
    msg 2               ; SELF cust
    send -1             ; --
    end commit
```

The "write" handler expects a message matching `(tag cust value')`.
Writing the cell entails updating the actor's state
with the new `value'`,
while maintaining the same behavior (instructions).
In addition, the actor sends a reference to itself
to the designated customer `cust`.
The provides a _synchronization signal_.
The `cust` will receive this message
only **after** the "write" has completed.
Also note that the transactional one-at-a-time processing
of message-events ensures atomic access to the "shared" state.

However, this does **not** prevent dangerous interleaving
of "read" and "write" events!
Although the _cell_ actor is never in an inconsistent state,
and mutation is hidden safely within the actor,
two _clients_ of the cell may execute
overlapping read/modify/write sequences
and cause corruption.
The "CAS" ([compare-and-swap](https://en.wikipedia.org/wiki/Compare-and-swap)) request
provides a mechanism to avoid this corruption.

```
CAS:                    ; (value) <- (tag cust old new)
    msg 3               ; old
    state 1             ; old value
    cmp eq              ; old==value
    if_not read         ; --
    msg -3              ; (new)
    my beh              ; (new) beh
    beh -1              ; --
    ref read
```

The "CAS" handler expects a message matching `(tag cust old new)`.
If `old` does not match the state `value`,
treat this as "read" request
(returning the _current_ `value` to `cust`).
If `old` **does** match the state `value`,
update the `value` to `new`
and branch to the "read" handler
(returning the _previous_ `value` to `cust`).
Notice that the state update only takes effect
when the event-handling transaction commits,
so the "read" handler always returns the original `value`.

The "CAS" handler demonstrates an important design principle.
State-changing operations should generally
determine a new value and update the private state
in one atomic transaction.
Also, the state-changing operation must be defined
on the actor holding the state,
since no actor can mutate another actor's state directly.

#### Object-Oriented Facets

Now that we have an object-oriented state-holder,
lets consider how to control the availability
of various operations to different clients.
If multiple clients have direct access to the cell,
they each have the authority to perform
all of the available operations.
Instead we will provide _facets_
for each available operation on a particular cell.

Each _facet_ is represented by a distinct actor,
separate from each other and from the state-holder.
The behavior of a facet is an idiomatic [`label_beh`](ufork-wasm/lib/lib.asm),
which expects the state to be a list containing
the receiver and the label.
The message is arbitrary (simple or complex).

```
label_beh:              ; (rcvr label) <- msg
    msg 0               ; msg
    state 2             ; msg label
    pair 1              ; (label . msg)
    state 1             ; (label . msg) rcvr
    send -1             ; --
    end commit
```

An actor with "label" behavior
prepends the `label` to the `msg`
and sends it to the `rcvr`.
By configuring the cell as the `rcvr`,
and the method-selector as the `label`,
we have a _facet_ actor that performs
a particular operation on a particular object.
We can control the authority to perform
specific operations
by passing the appropriate facet(s)
to potential clients,
without exposing the state-holder directly.
From the client's perspective,
the facet **is** the cell,
with the desired operation encoded in the capability.

The `factory` behavior below
(with an empty state)
expects a message containing
a customer `cust` and
an initial cell value `init`:

```
factory:                ; () <- (cust init)
    msg 2               ; init
    push cell_beh       ; init cell_beh
    new 1               ; cell=cell_beh.(init)

    push CAS_tag        ; cell "CAS"
    pick 2              ; cell "CAS" cell
    push label_beh      ; cell "CAS" cell label_beh
    new 2               ; cell CAS_facet=label_beh.(cell "CAS")
    roll -2             ; CAS_facet cell

    push write_tag      ; CAS_facet cell "write"
    pick 2              ; CAS_facet cell "write" cell
    push label_beh      ; CAS_facet cell "write" cell label_beh
    new 2               ; CAS_facet cell write_facet=label_beh.(cell "write")
    roll -2             ; CAS_facet write_facet cell

    push CAS_tag        ; CAS_facet write_facet cell "read"
    roll 2              ; CAS_facet write_facet "read" cell
    push label_beh      ; CAS_facet write_facet "read" cell label_beh
    new 2               ; CAS_facet write_facet read_facet=label_beh.(cell "read")
    msg 1               ; CAS_facet write_facet read_facet cust
    send 3              ; --
    end commit
```

An actor with "factory" behavior
creates a _cell_ with value `init`.
Then it creates _facets_ for each cell operation.
A list of the facets `(read write CAS)`
is sent to the customer `cust`.
The cell is never directly exposed.

## Summary

[Turing Machines](https://en.wikipedia.org/wiki/Turing_machine)
and the
[Lambda Calculus](https://en.wikipedia.org/wiki/Lambda_calculus)
are considered to be
"[universal](https://en.wikipedia.org/wiki/Computability_theory)"
[models of computation](https://en.wikipedia.org/wiki/Model_of_computation).
This is true if we only consider
[deterministic algorithms](https://en.wikipedia.org/wiki/Deterministic_algorithm).
However,
[Actors](https://en.wikipedia.org/wiki/Actor_model)
are strictly more powerful
because they allow us to capture the semantics of
[Open Systems](https://en.wikipedia.org/wiki/Open_system_(systems_theory))
with
[non-determinism](https://en.wikipedia.org/wiki/Unbounded_nondeterminism)
and useful forms of
[non-termination](https://en.wikipedia.org/wiki/Divergence_(computer_science)).
We have shown how several commonly-used computational models
(including
[Procedural](https://en.wikipedia.org/wiki/Procedural_programming),
[Functional](https://en.wikipedia.org/wiki/Functional_programming),
and
[Object-Oriented](https://en.wikipedia.org/wiki/Object-oriented_programming))
can be expressed with Actors.
