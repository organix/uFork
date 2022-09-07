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
for persistence, suspension, migration, and restart.

## Sponsor Life-Cycle

A Sponsor is created with an initial Configuration
and a _Controller_ to whom it reports life-cycle messages.
From the perspective of the Controller,
the new Sponsor is a _Peripheral_.
A Sponsor begins is an `IDLE` state,
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

The Controller can send the following messages to a Periperal:

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
