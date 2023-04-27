# Object Capabilities in uFork

A key feature of **uFork**
is pervasive use of Object-Capability Security,
enforced at the machine-code level.
All _values_ are type-tagged,
dividing them into three broad categories:

  * Direct value (fixnum)
  * Quad-memory reference (navigable)
  * Object capability (opaque)

The primary use for _object capabilities_ (ocaps)
is to designate an _actor_
to whom asynchronous _messages_
may be sent.

## Proxies and Stubs

Actor references are local to a computational domain.
Within a domain we assume reliable message delivery.
Between domains there is the possibility of message loss.

```
domain0:                          domain1:
+----------------+                +----------------+
|                | ping           | ping           |
|    +---------- ( stub ] . . . . [ proxy ) <-+    |
|    v           |                |           |    |
| ( ping )       |                |       ( pong ) |
|    |      pong |           pong |           ^    |
|    +-> ( proxy ] . . . . [ stub ) ----------+    |
|                |                |                |
+----------------+                +----------------+
```

The diagram above illustrates the relationships
between actors, stubs, and proxies
spanning separate domains.
The `ping` actor lives in `domain0`.
The `pong` actor lives in `domain1`.
There are two independent one-way links
between `ping` and `pong`.
Each _actor_ has a corresponding _stub_
that allows injection of messages
for that actor into the domain.
For any given _stub_ there may be several _proxies_
that represent remote-references to that stub/actor.
Note that not all actors will necessarily have proxies or stubs.

## Garbage Collection

Within a _domain_ it is possible to trace all active references
and determine when an actor (or other storage) is unreachable,
at which time the storage can be reclaimed and reused.
However, once a reference crosses domain boundaries,
this is no longer possible using only local information.
Proxies and stubs can assist in collecting distributed garbage.

A _stub_ represents a reference to local _actor_
from one or more remote domains.
A _proxy_ represents a local reference to an _actor_
in a remote domain.
When the garbage-collector reclaims a proxy
(because there are no more local references to it),
a notification is sent to the remote stub.
When a stub determines that there are no
active proxy references,
the stub may be removed.
While a stub exists,
it will prevent the garbage-collector
from reclaiming the actor/storage
to which it refers.
Essentially, all stubs are part of the _root set_
for the garbage-collector.

## Device Interfaces

Devices provide interfaces that allow interaction outside the domain.
They are represented as _actors_ within the domain,
and as such they can be the target of asynchronous message-events.
They may also inject messages into the domain.

A device may need to manage resources outside of the domain,
and therefore not visible to the garbage-collector.
In this case, it may create a _proxy_ for the resource,
and give customers a reference to the proxy.
That way, when all customer-references to the proxy are dropped,
the device will be notified
and can perform its own clean-up
of non-GC-visible resources.

In a similar fashion,
the device may need to prevent garbage-collection
of resources within the domain,
even if there are no other references.
In this case, a _stub_ may be created
to retain the GC-managed resource.
