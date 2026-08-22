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
By default, further activities (new Events)
caused by processing the Event
are associated with the same Sponsor.
Thus resources are tracked
along the causal chain of Events.

When an activity exhausts its Sponsored quota,
the Sponsor is suspended
and a message is sent to an Actor
acting as the Controller for the Sponsor.
This Event, naturally, must have a different Sponsor
since the current Sponsor has exhausted its quota.
All activity associated with the suspended Sponsor
is eventually suspended by the [Event Scheduler](scheduler.md).

The Root Sponsor represents the top level
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
is to perpetually refill exhausted quotas.
The [Run-Loop](run_loop.md) documentation has more details.

## Sponsorship Hierarchy

The system is started with a [Bootstrap Event](boot.md)
which is sponsored by the Root Sponsor.
This is the root-cause of all system activity.
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
it is given a subset of the current Sponsor's resources,
thus the sponsorship hierarchy
transitively enforces quotas.
Then the creating Actor/Event can designate this new Sponsor
explicity when creating a new Event.

Quota exhaustion is a [Recoverable Error](errors.md).
If the Sponsor is reactivated,
suspended Events are retried.
Technically, Actors are not suspended, only Events.
The Actor remains available
to process Events with active Sponsors.

## Sponsor Instructions

These instructions are related to sponsorship.

 Input                        | Instruction         | Output       | Description
------------------------------|---------------------|--------------|-------------------------------------
—                             | `sponsor` `new`     | _sponsor_    | create a new empty _sponsor_
_sponsor_ _n_                 | `sponsor` `memory`  | _sponsor_    | transfer _n_ memory quota to _sponsor_
_sponsor_ _n_                 | `sponsor` `events`  | _sponsor_    | transfer _n_ events quota to _sponsor_
_sponsor_ _n_                 | `sponsor` `cycles`  | _sponsor_    | transfer _n_ cycles quota to _sponsor_
_sponsor_                     | `sponsor` `reclaim` | _sponsor_    | reclaim all quotas from _sponsor_
_sponsor_ _control_           | `sponsor` `start`   | —            | activate _sponsor_ under _control_
_sponsor_                     | `sponsor` `stop`    | —            | reclaim all quotas and remove _sponsor_

A Sponsor occupies two quad-cells in memory,
the Sponsor and its Quota.
The fields of the Sponsor are {T: `#sponsor_t`, X: _quota_, Y: _signal_, Z: _waiting_}.
The fields of the Quota are {T: _memory_, X: _events_, Y: _cycles_, Z: `#?`}.
When the Sponsor is active, the _signal_ is a pre-allocated Event to the Controller.
When the Sponsor is suspended, the _signal_ field is a `fixnum` error code.
The Sponsor's _waiting_ field holds suspended Events (maintained by the processor).

The fields of the _signal_ event are {T: _sponsor_, X: _controller_, Y: _suspended_, Z: `#nil`}.
The _sponsor_ field is the Sponsor of the Controller.
The _controller_ field is the Actor that will handle the signal.
The _suspended_ field is the Sponsor that was suspended.
Note that this is a normal Event structure
that will be linked into the event queue for eventual dispatch.
The _suspended_ Sponsor is the message delivered to the Controller,
from which the Controller can read the `fixnum` error code in the _signal_ field
and further manipulate the suspended Sponsor.
