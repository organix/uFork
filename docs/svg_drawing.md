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
`E`        | &mdash;                          | erase all drawing elements

Standard: `AaCcHhLlMmQqSsTtVvZz`

Extended: `DdFfXE`

Unused: `BbeGgIiJjKkNnOoPpRrUuWwxYy`

## I/O Interface

The **I/O Interface** is a requestor with the same interface as the
[I/O Device](io_dev.md). It does not yet support cancellation.

### Read Request

When sent a request with input `#?`, it produces the next pointer event
(mouse, pen, touch, etc.) from the drawing device.
A pointer event is a three-tuple _x_,_y_,_b_
where _x_ and _y_ are `fixnum` coordinates
and _b_ is the button state as a `fixnum` bitmask.
The primary button occupies least-significant position.
If multiple pointer events occur before a read request,
the most-recent is returned.

**WARNING:** It is an error to request a read whilst one is in progress.

### Write Request

When sent a request with input `fixnum`,
it writes that value to the drawing device and produces `#?`.
When sent a request with a nil-terminated pair-list of `fixnum`s,
it writes each value in sequential order to the drawing device and produces `#?`.

For example, `'X',5,21,3,'F','o','o','F',0,127,0,255,#nil`
draws the text "Foo" filled with medium green starting at 5,21.

**WARNING:** It is an error to request a write whilst one is in progress.

## Demonstration

A demonstration using this device in available
[in the playground](https://ufork.org/playground/?src=https://ufork.org/debugger/examples/svg_demo.asm&dev=svg).
