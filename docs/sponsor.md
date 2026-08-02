# Actor Sponsorship

All activity within a _Theater_ of _Actors_
must be supported by a _Sponsor_.
The Sponsor enforces quotas
on three categories of resources:
Memory (storage),
Events (communication),
and Cycles (processor time).

Since all activity is driven by Events,
a Sponsor is associated with each Event
(rather than the target Actor, for example).
Resources used to process the Event
are charged to the associated Sponsor.
By default, further activity (new Events)
caused by processing the Event
is associated with the same Sponsor.
Thus resources are tracked
along the causal chain of Events.

When an activity exhausts its Sponsored quota,
the Sponsor is suspended
and a message is sent to an Actor
acting as the Controller for Sponsor.
This Event, naturally, must have a different Sponsor
since the current Sponsor has exhausted its quota.
All activity associated with the suspended Sponsor
is eventually suspended [Event Scheduler](scheduler.md).

The Root Sponsor represents the top-level
of the sponsorship hierarchy (like an O/S kernel).
When the Root Sponsor is exhausted,
there is no "higher-level" Sponsor to handle it.
If this is a _virtual_ processor,
the host environment is notified
and must decide when/if to resume processing.
If this is a _hardware_ processor,
the processor will halt with a completion signal
and the embedded environment
must decide when/if to resume processing.
The usual policy for the Root Sponsor
is to perpertually refill exhausted quotas.

## Sponsorhip Hierarchy

The system is started with a [Bootstrap Event](boot.md)
which is sponsored by the Root Sponsor.
This is the root cause of all system activity.
Any event that wants to exercise
finer-grained control over resources
must explicitly create a subordinate Sponsor.
The subordinate Sponsor is activated
by providing a Controller Actor
to handle signals from the subordinate.
Messages to the Controller will by sponsored
by the original Sponsor.

For security purposes,
an Actor processing an Event
does **not** have access
to the associated Sponsor.
It cannot examine (or change) its own quota.
It simply attempts to perform operations
that consume resources,
and is suspended if the Sponsor is exhausted.
This includes creation of a new Sponsor.

When a new Sponsor is created
it is given a subset of the current Sponsor's resources.
Thus the sponsorship hierarchy
transitively enforces quotas.
The creating Actor/Event then provides this new Sponsor
explicity when creating a new Event.
Quota exhaustion is a [Recoverable Error](errors.md).

## Sponsor Instructions

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

A Sponsor occupies two quad-cells in memory,
the Sponsor and its Quota.
The fields of the Sponsor are {T: `#sponsor_t`, X: quota, Y: signal, Z: waiting}.
The fields of the Quota are {T: memory, X: events, Y: cycles, Z: `#?`}, all `fixnum`.
When the Sponsor is active, the _signal_ is a pre-allocated Event to the Controller.
When the Sponsor is suspended, the _signal_ field is a `fixnum` error code.
The Sponsor's _waiting_ field is used to hold suspended Events (maintained by the processor).

The fields of the _signal_ event are {T: sponsor, X: controller, Y: suspended, Z: `#nil`}.
The _sponsor_ field is the Sponsor of the Controller.
The _controller_ field is the Actor that will handle the signal.
The _suspended_ field is the Sponsor that was suspended.
Note that this is a normal Event structure
that will be linked into the event queue for eventual dispatch.
The suspended Sponsor is the message delivered to the Controller,
from which the Controller can read the `fixnum` error code in the _signal_ field
and further manipulate the suspended Sponsor.

----
# WARNING! The rest of this document is OUT OF DATE and does NOT match the current design

_**TODO:** Describe the run-loop semantics elsewhere, referencing the [Event Scheduler](scheduler.md)._

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
