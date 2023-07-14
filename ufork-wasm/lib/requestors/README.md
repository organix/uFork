# Requestors

Actors with the following message signature are called "requestors". Requestors
support cancellation and failure notification. They take an optional 'value'.
The message sent to a requestor is a "request".

    (to_cancel callback . value) -> requestor

If 'to_cancel' is an actor, the requestor may send it a 'cancel' actor.

    cancel -> to_cancel

If there comes a time when the reply is no longer needed, the 'cancel' actor can
be used to cancel the operation. Its sole purpose is to avoid unnecessary work.
It is not an undo.

    -> cancel

The 'callback' actor receives a pair when the request completes (which could be
never). The value of the tail indicates success or failure.

On success, the tail of the pair is falsy and the head of the pair is the
resulting value.

    (value) -> callback

On failure, the tail is the reason and must be truthy. The head is #?.

    (#? . reason) -> callback
