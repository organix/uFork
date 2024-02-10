# SVG Drawing Device

The **SVG Drawing Device** acts like a serial printer,
translating a `fixnum` sequence into drawing commands
for an SVG element on an HTML page.

## Drawing Commands

Each drawing command begins with a letter
indicating the requested drawing operation.
This prefix determines the number of `fixnum` parameters that follow.
The commands are based on the
[SVG Path Specifition](https://www.w3.org/TR/SVG11/paths.html).
The following table summarizes the supported operations:

Prefix     | Parameters     | Operation
-----------|----------------|------------------------------------------
`M`        | _x_ _y_        | absolute move to (_x_, _y_)
`m`        | _dx_ _dy_      | relative move to (_x_+_dx_, _y_+_dy_)
`L`        | _x_ _y_        | absolute line to (_x_, _y_)
`l`        | _dx_ _dy_      | relative line to (_x_+_dx_, _y_+_dy_)
`Z` or `z` | &mdash;        | close path (line to beginning)

## I/O Interface
The **I/O Interfacee** interface follows the
[_Requestor_](https://github.com/douglascrockford/parseq) pattern
and provides a simple `fixnum` read/write API.

### Read Request

A _read_ request looks like `(to_cancel callback)`,
where `to_cancel` is the optional customer for a cancel capability,
and `callback` is the customer that will receive the result.
The result looks like `(fixnum)` on success,
and `(#? . error)` on failure.

**WARNING:** It is an error to send another read request
before receiving a result on your callback.

### Write Request

A _write_ request looks like `(to_cancel callback fixnum)`,
where `to_cancel` is the optional customer for a cancel capability,
and `callback` is the customer that will receive the result.
The result looks like `(#unit)` on success,
and `(#? . error)` on failure.

**WARNING:** It is an error to send another write request
before receiving a result on your callback.

### Cancellation

In either _read_ or _write_ requests, if `to_cancel` is a capability,
the device **may** send a _cancel_ capability to that customer.
If the _cancel_ capability is sent a message (any message),
the request **may** be cancelled, if it has not already sent a result.

**NOTE:** The initial implementation doesn't send a _cancel_ capability.
