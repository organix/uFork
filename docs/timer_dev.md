# uFork Timer Device

The **Timer Device** sends a message after a "real-time" delay.
See the [Clock Device](clock_dev.md) description for limitations
of the underlying clock.

## Delayed-Message Request

A _delayed-message_ request looks like `(delay target message)`.
The `message` is sent to the `target` actor
after a nominal `delay` in milliseconds as a `fixnum`.

## Requestor Interface

The **Timer Device** is also a [_requestor_](../docs/requestor.md). It support
cancellation.

The input value of a _timer_ request is a pair like `(delay . result)`. After
`delay`milliseconds, the `result` is sent to the callback specified in the
request.

## Reference Implementation

A [reference implementation](https://ufork.org/playground/?src=https://ufork.org/lib/timer.asm)
(implementing just the _delayed-message_ request)
is written in [uFork Assembly Language](asm.md)
and built on top of the [Clock Device](clock_dev.md).
However, host platforms often provide
an optimized implementation directly.
