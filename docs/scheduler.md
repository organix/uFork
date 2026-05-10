# Event/Execution Scheduler

The blog post "[Memory Safety Simplifies Microprocessor Design](https://dalnefre.com/wp/2022/08/memory-safety-simplifies-microprocessor-design/)"
describes a scheduling strategy that involves recycling undeliverable events
to the back of the event queue so they can be retried later.
Given that the [Actor Model](https://dalnefre.com/wp/2024/04/classic-actor-semantic-model/)
allows non-deterministic message-event delivery ordering,
this seemed like a simple but effective strategy.
However, we've discovered that it can lead to a kind of "schedule resonance"
that delays a critical message indefinitely.

This document describes a new strategy that keeps events in roughly FIFO order.
This is not _required_ by the actor model,
but does _comply_ with the fairness constraint.

## Event Queue

The _event queue_ remains central to the scheduler.
New events enter the system at the tail of this queue.
When an event is removed from the head of the queue,
one of three things can happen.

  1. Defer by Sponsor
  1. Defer by busy target
  1. Create continuation

If the _sponsor_ of the event determines it is not deliverable,
the event is added to the _waiting queue_ of the sponsor.
If the _target actor_ of the event is busy,
the event is added to the _inbox_ of the actor.
Otherwise, a _continuation_ is created to process the event
and the target actor is marked busy.

## Continuation Queue

The _continuation queue_ holds the execution contexts
for all events currently being processed.
The target actors remain busy during processing.
They naturally must be distinct,
as each actor can only process one event at a time.
Execution of a continuation can end one of three ways.

  1. Transaction abort
  1. Transaction commit
  1. Sponsor suspension

If an error occurs during processing,
or the actor executes `end abort`,
the transaction effects are discarded
and the event is consumed.
If the actor executes `end commit`,
the transaction effects are applied
(any new events are added to the event queue)
and the event is consumed.
If the sponsor determines that processing should be suspended,
the transaction effects are discarded
and the event is added to the waiting queue of the sponsor.

## Actor Inbox

Normally, when a continuation ends the actor is marked available
to start processing another event from the event queue.
However, before releasing the actor the scheduler checks the actor's inbox.
If there are any events in the inbox,
the first event is removed and dispatched.
If the sponsor of the new event determines it is not deliverable,
the event is added to the waiting queue of the sponsor,
and the process is repeated.
Otherwise, a continuation is created to process the new event
and the target actor remains busy.

## Sponsor Waiting Queue

Events may accumulate in the waiting queue of a suspended sponsor.
If the sponsor is stopped, the waiting events are discarded.
If the sponsor is (re-)started, the waiting events
are added to the tail of the event queue.
