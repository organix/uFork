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
Within the a domain we assume reliable message delivery.
Between domains there is the possibility of message loss.

```
domain0:                          domain1:
+----------------+                +----------------+
|                | ping           | ping           |
|    +---------- ( stub ] . . . . [ proxy ) <-+    |
|    v           |                |           |    |
| ( ping )       |                |       ( pong ) |
|    |      pong |           pong |           ^    |
|    +-> ( proxy ] . . . . ] stub ) ----------+    |
|                |                |                |
+----------------+                +----------------+
```

The diagram above illustrates the relationships
between actors, proxies, and stubs
spanning separate domains.
The "ping" actor lives in "domain0".
The "pong" actor lives in "domain1".
Each _actor_ has a corresponding _stub_
that allows injections of messages
for that actor into the domain.
For any given _stub_ there may be several _proxies_
that represent remote-references to an actor.
Note that not all actors will necessarily have proxies or stubs.

## Garbage Collection

Within a _domain_ it is possible to traces all active references
and determine when an actor (or other storage) is unreachable,
at which time the storage can be reclaimed and reused.
However, once a reference crosses domain boundaries,
this is no longer possible, using only local information.
Proxies and stubs can assist in collecting distributed garbage.

A _stub_ represents a reference to local _actor_
from one or more remote domains.
A _proxy_ represents a reference to an _actor_
in a remote domain.
When the garbage-collector reclaims a proxy
(because there are no more local references to it),
a notification is sent to the remote stub.
When a stub determines that there are no
active proxy references,
the stub may be removed.
While a stub exists,
it will prevent the garbage-collector
from reclaiming the actor
to which it refers.
