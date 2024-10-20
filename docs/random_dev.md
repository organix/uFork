# uFork Random Number Generator Device

The **Random Device** generates random `fixnums`.
The JavaScript reference implementation provides **secure** random numbers.
Other host platforms should do likewise, if possible.

## Fixnum Request

A _fixnum_ request looks like `customer`,
where `customer` is the actor that will receive the _result_.
The _result_ may be any `fixnum`.

## Limited Request

A _limited_ request looks like `(customer . limit)`,
where `customer` is the actor that will receive the _result_,
and `limit` is the (positive or negative) range limit.
The _result_ may be any `fixnum` between 0 and `limit`, inclusive.

## Bounded Request

A _bounded_ request looks like `(customer a . b)`,
where `customer` is the actor that will receive the _result_,
and the bounds are `a` and `b` (either may be larger).
The _result_ may be any `fixnum` between `a` and `b`, inclusive.
