# Sponsored Actor Configurations

A _Configuration_ is a set of Actors
and a set of pending Events.
An _Actor_ in a Configuration
is a mapping between an _Address_ (a _Capability_)
that designates the Actor
and a _Behavior_.
An _Event_ designates a target Actor,
and immutable _Message_ data.
A _Behavior_ defines the _Effects_ caused
by an Actor processing an Event.
_Effects_ define a transformation
from the current Configuration state
to a new Configuration state.

A _Sponsor_ is the entity responsible for
managing Configuration resources.
All the resources used by Actors in the Configuration;
including processor time, memory, storage, and communications;
are controlled by a Sponsor.
The Sponsor dispatches Events,
invoking the target Actor's Behavior,
parameterized by the Message.
The Effects produced by the Actor
are applied in an all-or-nothing manner,
as a transaction on the Configuration.
The Configuration state is consistent
between Event dispatches.
This can provide a stable checkpoint
for persistence, suspension, migration, upgrade, and restart.

## Sponsor Life-Cycle

A Sponsor is created with an initial Configuration
and a _Controller_ to whom it reports life-cycle messages.
From the perspective of the Controller,
the new Sponsor is a _Peripheral_.
A Sponsor begins in an `IDLE` state,
with no initial resources.

The Controller draws from its own resource pool
and passes resources to the Peripheral Sponsor
as part of a `Run` message.
When a Peripheral receives a `Run` message,
it enters `ACTIVE` state
and begins to dispatch pending Events.

```
   --------              --------
  |        | ---Run---> |        |
  |  IDLE  | <--Pause-- | ACTIVE |
  |        | <--Stop--- |        |
   --------              --------
```

If an Actor cannot obtain enough resources
from the Sponsor
to finish handling an Event,
the transaction must be rolled back
to the Configuration state
before the Event was dispatched.
The Sponsor then enters `IDLE` state
and notifies its _Controller_ with a `Paused` message.

If a Configuration has no more pending Events to dispatch,
it enters `IDLE` state
and notifies its _Controller_ with a `Stopped` message.

The Controller can send the following messages to a Peripheral:

  * Run(Resources)
  * Pause

A Peripheral can send the following messages to its Controller:

  * Paused(Resources)
  * Stopped(Resources)

## Actor Failure

If an Actor detects a condition
where it is unable or unwilling
to continue processing an Event,
it can signal a _Failure_
to its Sponsor.
The Event transaction is aborted,
so there are no Effects.
The Controller and Peripheral Sponsors
may have a variety of policies
for handling a Failure:

  * Ignore the Failure, discard the Event, and continue
  * Log the failed Event, and continue
  * Pause the Periperhal (retaining the Event)
    * The Controller may modify the Configuration and restart the Peripheral
    * The Controller may provide a debugger to examine/modify the Configuration

## Event-Driven Transactions

The design described up to this point
is focused on message-event transactions.
This is reasonable,
since classical Actor-Model semantics
are defined in this way.
However, the **uFork** processor
interleaves instruction execution
for multiple parallel event-handlers.

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
signal event is added to the event queue.
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
_sponsor_ _msg_ _actor_       | `signal` `-1`       | —            | send _msg_ to _actor_ using _sponsor_
_sponsor_ _mₙ_ … _m₁_ _actor_ | `signal` _n_        | —            | send (_m₁_ … _mₙ_) to _actor_ using _sponsor_

## Processor Run-Loop

The run-loop is the main entry-point for a host to run the uFork processor.
The `limit` parameter controls the number of run-loop iterations.
If the `limit` is positive, it defines the maximum number of iterations.
Otherwise, the run-loop will continue until either an error is signalled
or the processor runs out of work (event-queue and continue-queue empty).

During each iteration of the run-loop, the processor will try to execute
an instruction and then try to dispatch an event. Each instruction is
executed in the context of an event, which always has a sponsor. If an
error occurs (including exceeding the sponsor's quota), it is stored in
the _signal_ field of the sponsor. If the sponsor is the root-sponsor,
the run-loop is terminated and the error signal is returned to the host.
For a peripheral sponsor, sponsor's controller is notified using a
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
set to `ZERO` (aka `E_OK`), and the same value is returned to the host.

 Signal   | Root Sponsor | Peripheral Sponsor
----------|--------------|--------------------
`E_OK`    | no more work | sponsor stopped
+_fixnum_ | error (idle) | error (idle)
`#?`      | runnable     | —
_ctl_cap_ | —            | runnable
