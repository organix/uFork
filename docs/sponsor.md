# Sponsored Actor Configurations

A _Configuration_ is a set of Actors
and a set of pending Events.
An _Actor_ in a Configuration
is a mapping between a _Capability_ (an address)
that designates the Actor
and a _Behavior_.
An _Event_ designates a Sponsor,
a target Actor,
and immutable _Message_ data.
A _Behavior_ defines the _Effects_ caused
by an Actor processing an Event.

_Effects_ define a transformation
from the current Configuration state
to a new Configuration state.
The Effects produced by an Actor
are applied in an all-or-nothing manner,
as a transaction on the Configuration.
The Configuration state is consistent
between Effect commits.
This can provide a stable checkpoint
for persistence, suspension, migration, upgrade, and restart.

A _Sponsor_ is responsible for
managing Configuration resources.
All the resources used by an Actor to handle an Event;
including processor time, memory, and communications;
are controlled by a Sponsor.
Sponsors are associated with Events,
since Events represent the work to be done,
regardless of which Actor(s) perform the work.

## Sponsorhip Hierarchy

All work done by a uFork processor
is driven by actor message-events.
Each event has a _sponsor_
representing limits to resources
that may be consumed
while processing an event.

The system is started by a bootstrap event.
The bootstrap event is sponsored
by the _root_ sponsor.
The bootstrap behavior creates new actors
to build a configuration,
and sends new messages
to initiate processing.
By default, new messages use the sponsor
of the event that caused them to be sent.
However, the sender may choose
to designate a specific sponsor
for any message it sends.

An actor's behavior does not have direct access
to the sponsor for the event it is processing.
Any resources used to handle an event
are automatically charged to the sponsor for that event.
An actor can create a new sponsor
with a subset of the current sponsor's resources.
The new sponsor is called the _peripheral_ sponsor.
The original sponsor is called the _controller_ sponsor.
Controllers and peripherals form a sponsorship hierarchy.

## Actor Failure

If an actor encounters a condition
which prevents it from continuing
to process an event,
it signals a failure
to the sponsor of the event.
This failure signal
causes all processing
associated with the sponsor
to be suspended,
and the _controller_
for this _peripheral_
is notified.
The controller's signal-handler (an actor)
handles the signal-message (an event)
under the sponsorship of the controller.

Resource exhaustion is an obvious cause of failure,
however there are several other constraint violations
that may also cause a failure.
All failures are handled by the same mechanism,
suspending the _peripheral_
and notifying the _controller_.
If the root sponsor fails,
it is suspended (like any sponsor),
and the host environment is notified.

## Instruction-Level Sponsorship

Instruction granularity is more
fine-grained than event granularity.
Since sponsor limits are checked,
(and violations reported)
during instruction execution,
we need an instruction-level sponsorship model.
Each instruction is associated with an _event_,
and each event may have a different _sponsor_.

```
                                              +-->[memory,events,cycles,#?]
                                              |
                                        +-->[sponsor,controller,status,NIL]
                                        |                        |
             +-->[memory,events,cycles,signal]<------------------+
             |
       +-->[sponsor,to,msg,NIL]
       |
[ip,sp,ep,kp]
```

The _signal_ field of the sponsor
is either `#?` for top-level events,
or a pointer to a pre-allocated signal event.
The signal event is used
to communicate _status_ to the _controller_.

The pre-allocated signal event
is not initially part of the event queue.
When the _peripheral_ needs to signal the _controller_,
the signal event is added to the event queue.
The _sponsor_ of the signal event
is the sponsor of the _controller_.
The _status_ of the signal event
is the sponsor of the _peripheral_.
The _signal_ field of the _peripheral_ sponsor
is set to a fixnum _error_ code.
When the _signal_ is a fixnum,
the sponsor is considered **idle**
and no events are dispatched
or instructions executed
for this sponsor.

```
                                              +-->[memory,events,cycles,#?]
                                              |
                         event_queue ... -->[sponsor,controller,status,NIL]
                                                                 |
             +-->[memory,events,cycles,error]<-------------------+
             |
       +-->[sponsor,to,msg,NIL]
       |
[ip,sp,ep,kp]
```

### Sponsor Instructions

These instructions are related to sponsorship.

 Input                        | Instruction         | Output       | Description
------------------------------|---------------------|--------------|-------------------------------------
—                             | `sponsor` `new`     | _sponsor_    | create a new empty _sponsor_
_sponsor_ _n_                 | `sponsor` `memory`  | _sponsor_    | transfer _n_ memory quota to _sponsor_
_sponsor_ _n_                 | `sponsor` `events`  | _sponsor_    | transfer _n_ events quota to _sponsor_
_sponsor_ _n_                 | `sponsor` `cycles`  | _sponsor_    | transfer _n_ cycles quota to _sponsor_
_sponsor_                     | `sponsor` `reclaim` | _sponsor_    | reclaim all quotas from _sponsor_
_sponsor_ _control_           | `sponsor` `start`   | —            | run _sponsor_ under _control_
_sponsor_                     | `sponsor` `stop`    | —            | reclaim all quotas and remove _sponsor_

## Processor Run-Loop

The run-loop is the main entry-point for a host to run the uFork processor.
The `limit` parameter controls the number of run-loop iterations.
If the `limit` is positive, it defines the maximum number of iterations.
Otherwise, the run-loop will continue until either an error is signalled
or the processor runs out of work (event-queue and continuation-queue empty).

During each iteration of the run-loop, the processor will try to execute
an instruction and then try to dispatch an event. Each instruction is
executed in the context of an event, which always has a sponsor. If an
error occurs (including exceeding the sponsor's quota), it is stored in
the _signal_ field of the sponsor. If the sponsor is the root-sponsor,
the run-loop is terminated and the error signal is returned to the host.
For a peripheral sponsor, the sponsor's controller is notified using a
pre-allocated event, and no error is reported to the run-loop.

If no error is reported from the instruction execution (or no instruction
is executed), then an attempt is made to dispatch an event. Each event
in the event-queue has a sponsor. If an error occurs while dispatching an
event, it is handled just like an instruction-execution error. This means
that there may or may not be a continuation associated with an error.

If no error is reported from the event dispatch (or no event is dispatched),
then the step limit is checked. If the step-limit is reached, the _signal_
field of the root-sponsor is returned to the host. If both the event-queue
and the continuation-queue are empty, the root-sponsor _signal_ field is
set to `ZERO` (aka `E_OK`), and that value is returned to the host.

 Signal   | Root Sponsor      | Peripheral Sponsor
----------|-------------------|--------------------
`E_OK`    | no more work      | sponsor stopped
+_fixnum_ | error (suspended) | error (suspended)
`#?`      | runnable          | —
_ctl_cap_ | —                 | runnable

### Peripheral Sponsor Signaling

When an error is signaled for a peripheral,
the controller is notified by sending the peripheral sponsor
in a message to the actor in the _ctl_cap_
with the controller as sponsor.
The _signal_ field of the peripheral sponsor
will contain the error code (a non-zero fixnum).
While in this state,
events and continuations associated with the peripheral
will be suspended, circulating in their queues.
If the controller executes a "sponsor stop" instruction,
the _signal_ field of the peripheral controller
is set to `ZERO` (aka `E_OK`).
When an event or continuation reaches the front of the queue
with their sponsor in this state,
the event or continuation is discarded
and the garbage-collector cleanly removes
all their associated memory from the system.
