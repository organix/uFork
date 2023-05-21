# Actor Protocol Design

Actor protocols are based on asynchronous messages.
All computation in uFork is driven by
execution of an actor's behavior
in response to the dispatch of a message-event.
A particular actor will only process
on message-event at a time.
The effects of the event are applied transactionally
when (and if) the actor behavior terminates with a commit.
Effects are limited to:

  * Creating new actors
  * Sending new messages to known actors
  * Designating a new behavior/state for subsequent messages

Messages are immutable data-structures.
They can be as simple as a single primitive value,
or complex structures composed of pairs and dictionaries.
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
The sender never knows when (of if) a message arrives.
The receivers doesn't know the identity of the sender.

The most common use of single-value messages
is for the notification of result values.
Sometimes a _request_ (that produces a _result_)
consists of simply a _capability_
designating the actor to whom the result is sent.

For example,
the _clock_ device
expects a message
consisting of a _customer_ capability.
On receipt of such a message,
the clock device sends a _fixnum_ time value
to the actor designated as the customer.
Each of the messages in this protocol,
both the request and the result,
are simple single values.

Simple values also include the five literal constants:

  * `#?` (undefined)
  * `#nil`
  * `#unit`
  * `#t` (true)
  * `#f` (false)

## Pair-List Messages

Most messages require more information
that can be conveyed in a single value.
List-like structures can be created
by combining pairs of values.

A _pair_ combines two values (simple or complex)
called the _head_ and the _tail_.
A pair can be printed as `(` _head_ ` . ` _tail_ `)`
in order to emphasize its components.

A _list_ can be represented by a sequence of pairs,
where the _tail_ of each pair is another list.
The base-case is an empty list,
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
An an example, consider indexing into the list `(1 2 3)`.

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

The uFork instructions for sending a message
or defining an actor's behavior/state
provide convenient support
for creating lists from stack elements.

### Explicit Customers

Call-return is a common pattern in actor protocols.
It is used for sequencing
when a computation is dependent on
the result of another computation.
A _call_ is a normal one-way asynchronous message
which contains an actor who will receive the _return_ value.
The receiving actor is referred to as the _customer_.
This pattern is sometimes called "continuation-passing style".
This actor protocol is strictly more-flexible
than synchronous call-return
because the customer does not have to be the caller.
For example, the customer could be the next actor in a processing pipeline.

The usual convention is to provide the _customer_
as the first element of a list-structured message.
Viewed as a pair, a _call_ looks like `(` _customer_ ` . ` _request_ `)`.
If the _request_ is `()`,
the call degenerates to the one-element list `(` _customer_ `)`.
This convention is most appropriate
for representing arguments lists
in function/procedure calls.

Note, that some services
(like the _clock_ device described above)
expect the entire message to be just the _customer_.
The idioms in `lib.asm` include adapters
to convert between these conventions.

### Behavior Signatures

All processing in uFork is performed by executing instructions
in the context of handling an actor message-event.
The instruction graph defines the _behavior_ of an actor.
The _signature_ of a behavior describes
the structure of the expected actor _state_ and _message_.
We write a signature as "_state_ `<-` _message_".

Consider the adapter `wrap_beh`,
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
containing the message,
and sends it to the receiver.

Now consider the adapter `unwrap_beh`,
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
extracts the message from a single-element list,
and sends it to the receiver.

Finally, consider constant-function `const_beh`,
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
