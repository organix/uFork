# uFork Console Input/Output Device

The **I/O Device** interface follows the
[_Requestor_](https://github.com/douglascrockford/parseq) pattern
and provides a simple `fixnum` read/write API.

## Read Request

A _read_ request looks like `(to_cancel callback)`,
where `to_cancel` is the optional customer for a cancel capability,
and `callback` is the customer that will receive the result.
The result looks like `(fixnum)` on success,
and `(#? . error)` on failure.

**WARNING:** It is an error to send another read request
before receiving a result on your callback.

## Write Request

A _write_ request looks like `(to_cancel callback fixnum)`,
where `to_cancel` is the optional customer for a cancel capability,
and `callback` is the customer that will receive the result.
The result looks like `(#unit)` on success,
and `(#? . error)` on failure.

**WARNING:** It is an error to send another write request
before receiving a result on your callback.

## Cancellation

In either _read_ or _write_ requests, if `to_cancel` is a capability,
the device **may** send a _cancel_ capability to that customer.
If the _cancel_ capability is sent a message (any message),
the request **may** be cancelled, if it has not already sent a result.

**NOTE:** The initial implementation doesn't send a _cancel_ capability.
