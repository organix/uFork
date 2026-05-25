# Error Handling Strategies

In any computation, errors may occur.
This document outlines the kinds of errors that we anticipate,
and the strategies for handling them.
We describe the error conditions
from least severe to most severe.
Error handling strategies scale
with the severity of the error condition.

## Ignorable Errors

Some error conditions can be ignored
without adversely affecting the computation.
When possible, these conditions are ignored completely.
The error condition has no visible effect.
This can be either an intentional or unintentional no-op.
Examples include:

- `dup` _n_ or `drop` _n_, where _n_ ≤ 0

Some computations must produce a value,
but the value may not be defined for some inputs.
The value `#?` represents "undefined"
and is a valid result from any computation
the must produce a result.
Examples include:

- _n_ _m_ `alu add`, where _n_ or _m_ are not fixnums
- _n_ _m_ `cmp lt`, where _n_ or _m_ are not fixnums
- `nth` _index_, where _index_ is out of bounds
- stack underflow
- _n_ _d_ `alu div`, where _d_ = 0 (result: `#? #?`)

This makes all functions _total_ and _infallible_
rather than _partial_ and _fallible_.
Generally, `#?` as in input produces `#?` as an output.
However, type and identity tests
are defined to always return `#t` or `#f`.
Examples include:

- `typeq` _type_
- `eq` _value_
- `cmp eq` and `cmp ne`

## Recoverable Errors

All actor computation occurs within the context
of a _continuation_ processing an _event_
on behalf of a _sponsor_.
The sponsor maintains quotas for usage of
memory, processor, and communication resources.

When a quota is depleted, event processing is abandoned
(any pending effects are discarded)
and the event is re-queued for later delivery.
Examples include:

- `E_MEM_LIM`, `E_CPU_LIM`, `E_MSG_LIM`

If the sponsor chooses to re-start the computation,
a new continuation is created
to process the event again from the beginning.

## Aborted Errors

If a processing error occurs
while an actor is handling an event,
the continuation is aborted.
The event and all pending effects are discarded.
Examples include:

- `end abort` instruction
- `E_BOUNDS`, `E_NOT_FIX`, `E_NOT_CAP`, `E_ASSERT`

Note that the actor itself is not terminated,
and is perfectly capable of processing additional events.

In a hosted environment (such as running under a debugger),
the host may be notified of the abort condition.
However, this is outside the actor messaging semantics.

## Fatal Errors

If the machine detects a condition
from which it cannot recover,
all processing and communication halts.
Examples include:

- `E_NO_MEM`
- Machine consistency assertions

This fail-stop behavior is only used as a last resort.
