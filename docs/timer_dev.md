# uFork Timer Device

The **Timer Device** sends a message after a "real-time" delay.
See the [Clock Device](clock_dev.md) description for limitations
of the underlying clock.

## Delayed-Message Request

A _delayed-message_ request looks like `delay,target,message`.
The `message` is sent to the `target` actor
after a nominal `delay` in milliseconds as a `fixnum`.

## Requestor Interface

The **Timer Device** is also a [_requestor_](requestor.md). It supports
cancellation.

The input value of a _timer_ request is a pair like `delay,result`. After
`delay` milliseconds, the `result` is sent to the callback specified in the
request. The full request looks like `to_cancel,callback,delay,result`

## uFork Assembly Implementation

A [reference implementation](https://ufork.org/playground/?src=https://ufork.org/lib/timer.asm)
(implementing just the _delayed-message_ request)
is written in [uFork Assembly Language](asm.md)
and built on top of the [Clock Device](clock_dev.md).
However, host platforms often provide
an optimized implementation directly.

## FPGA Implementation

The FPGA implementation (implementing just the _delayed-message_ request)
is written in uCode using the hardware Clock device.

```
timer_dev: [#actor_t,+2,#nil,#?]
            ^
            |
event: [spn,to,msg,next]
                |
                V
               [#pair_t,delay,evt,#?]
                               |
                               V
                              [#pair_t,to,msg,#?]
                                       |   |
                               cust <--+   +--> ...
```

The pending events are linked to the Timer actor
through their `Y` fields,
ordered by their trigger times.
When the Clock is past the trigger time,
the pending event is removed from the timer queue
and added to the event queue for delivery.
```
clock_ms: +240

timer_dev: [#actor_t,+2,pending,#?]
                        |
                        V
              [spn,+100,next,evt]--->[#pair_t,to,msg,#?]
                        |                     |   |
                        :             cust <--+   +--> ...
                        |
                        V
              [spn,+370,#nil,evt]--->[#pair_t,to,msg,#?]
                                              |   |
                                      cust <--+   +--> ...
```
