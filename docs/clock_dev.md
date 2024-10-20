# uFork Raw Clock Device

The **Clock Device** provides access to a "real-time" clock.
The precision and accuracy of this clock are host/platform dependent.
The JavaScript reference implementation provides microsecond precision.

## Timestamp Request

A _timestamp_ request consists of just a `customer`
to whom a `fixnum` timestamp will be sent.
The timestamp will wrap around become negative on overflow.
The best way to compare timestamps is to subtract them.
(_t_<sub>0</sub> - _t_<sub>1</sub>) will be less than 0
if _t_<sub>0</sub> is before _t_<sub>1</sub>
and the difference is less than half the clock-wrapping period.

## Timestamp Limitations

The timestamps are expected to be monotonically increasing,
modulo wrap-around.
However, they may not actually represent real (wall clock) time.
The clock may pause, or advance by arbitrary amounts,
especially when under the control of a debugger.
The timestamps may advance more slowly than real-time
in order to simulate a slow-motion world,
or faster processor execution speed.

On a uFork processor with 31-bit fixnums and microsecond precision,
the clock-wrapping period is nominally 2,147,483 seconds,
or approximately 24.855 days.
On a uFork processor with 15-bit fixnums and microsecond precision,
the clock-wrapping period is nominally 32.768 seconds.
