# Requestors

Actors with the following message signature are called "requestors". Requestors
are like services that support cancellation and failure notification. The
message sent to a requestor is called a "request", which optionally contains an
_input_ value.

    (to_cancel callback . input) -> requestor

The _callback_ actor is sent a "result" like `(ok . value/error)` once the
request completes (which could be never).

On success, the result's head is `#t` and its tail is an optional _output_
value. We say that a requestor "produces" its _output_ value.

    (#t . output) -> callback

On failure, the result's head is `#f` and its tail is an optional _error_
reason.

    (#f . error) -> callback

If _to_cancel_ is an actor, the requestor may send it a _cancel_ actor.

    cancel -> to_cancel

If there comes a time when the reply is no longer needed, the _cancel_ actor can
be used to cancel the operation. Its sole purpose is to avoid unnecessary work,
it is not an undo. The message sent to the cancel actor is taken to be
the _reason_ for the cancellation, and can be any value.

    reason -> cancel

With this terminology in hand, it is possible to specify requestors very
consisely. Here is an example specification of `double`, a requestor that
doubles its input value.

> The `double` requestor takes a fixnum and produces a fixnum twice the size.
  It fails if the input is not a fixnum.

From this specification, the signatures of the request and result messages are
known to be

    (to_cancel callback . n) -> double
    (#t . 2*n) -> callback
    (#f . error) -> callback

The requestor pattern was invented by Douglas Crockford, and was first
implemented in JavaScript. See https://crockford.com/parseq.html.
