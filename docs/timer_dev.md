# uFork Timer Device

The **Timer Device** sends a message after a "real-time" delay.
See the [Clock Device](clock_dev.md) description for limitations
of the underlying clock.

## Delayed-Message Request

A _delayed-message_ request looks like `(delay target message)`.
The `message` is sent to the `target` actor
after a nominal `delay` in milliseconds as a `fixnum`.

## Requestor-Style Interface

The **Timer Device** also provides an interface
following the [_requestor_](../lib/rq/README.md) pattern.

A _timer_ request looks like `(to_cancel callback delay . result)`,
where `to_cancel` is the optional customer for a _cancel_ capability
and `callback` is the customer that will receive `result`
after a nominal `delay` in milliseconds as a `fixnum`.

The `result` should be `(value)` to indicate success,
or `(#? . error)` to indicate failure.

**NOTE:** Cancellation does _not_ trigger a failure.

### Cancellation

In a _timer_ request, if `to_cancel` is a capability,
the device **may** send a _cancel_ capability to that customer.
If the _cancel_ capability is sent a message (any message),
the request **may** be cancelled
(if it has not already sent the `result`).

## Reference Implementation

A [reference implementation](https://ufork.org/playground/?src=https://ufork.org/lib/timer.asm)
(implementing just the _delayed-message_ request)
is written in [uFork Assembly Language](asm.md)
and built on top of the [Clock Device](clock_dev.md).
However, host platforms often provide
an optimized implementation directly.
