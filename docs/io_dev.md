# uFork Console Input/Output Device

The **I/O Device**  is implemented as a [_requestor_](requestor.md) that
responds to two kinds of requests. It does not yet support cancellation.

## Read Request

When sent a request with input `#?`, it produces the next character read
from the input stream (as a fixnum).

**WARNING:** It is an error to request a read whilst one is in progress.

## Write Request

When sent a request with input `fixnum`, it writes that character to the
output stream and produces `#?`.

**WARNING:** It is an error to request a write whilst one is in progress.
