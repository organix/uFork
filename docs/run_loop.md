# Processor Run-Loop

The run-loop is the main entry-point for a host to run the uFork processor.
The `limit` parameter controls the number of run-loop iterations.
If the `limit` is positive, it defines the maximum number of iterations.
Otherwise, the run-loop will continue until either an error is signalled
or the processor runs out of work (event-queue and continuation-queue empty).

During each iteration of the run-loop, the processor will try to execute
an instruction and then try to dispatch an event. Each instruction is
executed in the context of an event, which always has a sponsor. If a
[recoverable error](errors.md) occurs (e.g.: sponsor quota exceeded),
it is stored in the _signal_ field of the sponsor. If the sponsor is
the root-sponsor, the run-loop is terminated and the error signal is
returned to the host. Otherwise, the [sponsor's controller](sponsor.md)
is notified (using a pre-allocated event), and the run-loop continues.

The host policy determines what happens if/when the run-loop terminates.
In some environments, a debugger/monitor gains control. Root-sponsor
resources may automatically be refilled, and the run-loop restarted.

If no error is reported from the instruction execution (or no instruction
is executed), then an attempt is made to dispatch an event. Each event
in the event-queue has a sponsor. If an error occurs while dispatching an
event, it is handled just like an instruction-execution error. This means
that there may or may not be a continuation associated with an error.

If no error is reported from the event dispatch (or no event is dispatched),
then the step-limit is checked. If the step-limit is reached, the _signal_
field of the root-sponsor is returned to the host. If both the event-queue
and the continuation-queue are empty, the root-sponsor _signal_ field is
set to `ZERO` (aka `E_OK`), and that value is returned to the host.

 Signal   | Root Sponsor      | Peripheral Sponsor
----------|-------------------|--------------------
`E_OK`    | no more work      | sponsor stopped
+_fixnum_ | error (suspended) | error (suspended)
`#?`      | runnable          | —
_ctl_evt_ | —                 | runnable
