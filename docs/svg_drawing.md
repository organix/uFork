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

Prefix      | Parameters                                | Operation
------------|-------------------------------------------|--------------------------------------------------------
`M`         | _x_ _y_                                   | absolute move to (_x_, _y_)
`m`         | _dx_ _dy_                                 | relative move to (_x_+_dx_, _y_+_dy_)
`L`         | _x_ _y_                                   | absolute line to (_x_, _y_)
`l`         | _dx_ _dy_                                 | relative line to (_x_+_dx_, _y_+_dy_)
`H`         | _x_                                       | absolute horizontal line to (_x_, _y_)
`h`         | _dx_                                      | relative horizontal line to (_x_+_dx_, _y_)
`V`         | _y_                                       | absolute vertical line to (_x_, _y_)
`v`         | _dy_                                      | relative vertical line to (_x_, _y_+_dy_)
`C`         | _x1_ _y1_  _x2_ _y2_ _x_ _y_              | absolute cubic curve to (_x_, _y_)
`c`         | _x1_ _y1_  _x2_ _y2_ _dx_ _dy_            | relative cubic curve to (_x_+_dx_, _y_+_dy_)
`S`         | _x2_ _y2_ _x_ _y_                         | absolute smooth cubic curve to (_x_, _y_)
`s`         | _x2_ _y2_ _dx_ _dy_                       | relative smooth cubic curve to (_x_+_dx_, _y_+_dy_)
`Q`         | _x1_ _y1_  _x_ _y_                        | absolute quadratic curve to (_x_, _y_)
`q`         | _x1_ _y1_  _dx_ _dy_                      | relative quadratic curve to (_x_+_dx_, _y_+_dy_)
`T`         | _x_ _y_                                   | absolute smooth quadratic curve to (_x_, _y_)
`t`         | _dx_ _dy_                                 | relative smooth quadratic curve to (_x_+_dx_, _y_+_dy_)
`A`         | _rx_ _ry_ _rot_ _large_ _sweep_ _x_ _y_   | absolute elliptical arc to (_x_, _y_)
`a`         | _rx_ _ry_ _rot_ _large_ _sweep_ _dx_ _dy_ | relative elliptical arc to (_x_+_dx_, _y_+_dy_)
`Z` or `z`  | &mdash;                                   | close path (line to join start)

In addition, there are extended operations
not directly available as paths.

Prefix     | Parameters                       | Operation
-----------|----------------------------------|------------------------------------------
`X`        | _x_ _y_ _n_ ...                  | _n_ characters of text starting at (_x_, _y_)
`F`        | _r_ _g_ _b_ _a_                  | fill with color (_a_=255 for opaque)
`f`        | _r_ _g_ _b_ _a_                  | fill pending (followed by `D`)
`D`        | _r_ _g_ _b_ _a_ _w_ _cap_ _join_ | draw stroke _w_ wide (0=butt, 1=round, 2=square)
`f`        | _r_ _g_ _b_ _a_ _w_ _cap_ _join_ | draw pending (followed by `F`)

Standard: `AaCcHhLlMmQqSsTtVvZz`

Extended: `DdFfX`

Unused: `BbEeGgIiJjKkNnOoPpRrUuWwxYy`

## I/O Interface

The **I/O Interface** follows the
[_Requestor_](https://github.com/douglascrockford/parseq) pattern
and provides a simple `fixnum` read/write API,
just like the [I/O Device](io_dev.md).

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
