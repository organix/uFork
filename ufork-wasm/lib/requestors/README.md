# Requestors

Actors with the following message signature are called "requestors". Requestors
support cancellation and failure notification. They take an optional
input 'value'. The message sent to a requestor is a "request".

    (to_cancel callback . value) -> requestor

If 'to_cancel' is an actor, the requestor may send it a 'cancel' actor.

    cancel -> to_cancel

If there comes a time when the reply is no longer needed, the 'cancel' actor can
be used to cancel the operation. Its sole purpose is to avoid unnecessary work,
it is not an undo. The message sent to the cancel actor is taken to be
the 'reason' for the cancellation, and can be any value.

    reason -> cancel

The 'callback' actor is sent a "result" when the request completes (which could
be never). The result is a pair whose tail indicates success or failure.

On success, the result's tail is falsy and its head is the output value.

    (value) -> callback

On failure, the result's tail is the error and must not be falsy. The head
is #?.

    (#? . error) -> callback
