# udbg Debugging Protocol

An asynchronous messaging protocol for remotely controlling and debugging a
uFork core. The protocol follows a publish-subscribe (rather than a
request-response) model, in order to mitigate the effects of network latency.

Message delivery is assumed to be reliable and in order.
Messages are objects with a `kind` property.

## Command messages

### {kind: "statuses", verbose: _object_}

Specify what kinds of status message will be published and how often. By
default, no status messages are published.

The `verbose` object is a mapping from status kinds to a verbosity level:

Verbosity   | Meaning
------------|---------------------------
`undefined` | Never published
`false`     | Published only on pause
`true`      | Always published

### {kind: "play"}

Start running the core. The playing state persists even through periods of
idleness, automatically continuing when the core is awoken by a device.

The driver will pause only when a "pause" command is received or an "auto_pause"
condition is satisfied.

TODO undocumented "steps" parameter

### {kind: "pause"}

Manually stop running the core.

### {kind: "auto_pause", on: _array_}

Specify conditions under which the driver will automatically pause.
The `on` array contains zero or more of the following strings:

    "audit"
    "debug"
    "fault"
    "idle"
    "instr"
    "txn"

Each of these strings correspond to a status message of the same name, which is
published upon pausing. The status message will be preceeded by a "ram" status
and followed by a "playing" message.

Specifying "debug" or "instr" will cause maximum execution speed to be
significantly reduced. TODO verify this

### {kind: "refill", resources: _object_}

Refill the root sponsor with the given `resources`, an object like
{memory, events, cycles}.

### {kind: "auto_refill", enabled: _boolean_}

Enables or disables automatic refilling of the root sponsor.
When `enabled` is true, the "play" command behaves as if the root
sponsor is inexhaustible. Enabled by default.

## Status messages

Status messages provide real-time updates on the state of the core. Status
messages of a particular kind are only published if the client has expressed
interest with a "statuses" command.

Status messages are published in a predictable order. A "ram" status is
followed by a step status (such as "audit" or "instr"), which is then
followed by a "playing" status.

### {kind: "audit", code: _integer_, evidence: _raw_}

An audit has occurred. See `on_audit` in core.js.

### {kind: "debug"}

A breakpoint has been reached.

### {kind: "fault", code: _integer_}

The core halted with a fault signal, for example `E_FAIL`.

### {kind: "idle"}

The core has become idle, producing the signal `E_OK`.

### {kind: "instr"}

An instruction finished executing.

### {kind: "txn", sender: _raw_, events: _array_, wake: _boolean_}

An actor or device transaction has reached its conclusion.
See `on_txn` in core.js.

TODO how does this work for manual pausing? Does the driver hold on to the last
of each step statuses and publish them when it receives a "pause" command? Or
does it wait for an additional step after being told to pause? Maybe start with
a slow POC where the debugger always proceeds one step at a time.

### {kind: "playing", value: _boolean_}

Whether the driver is currently "playing". This does not necessarily
mean the core is running, just that the core will run when it is given
some work. The driver is initially paused (false).

### {kind: "ram", bytes: _Uint8Array_}

Current contents of quad RAM.

### {kind: "rom", bytes: _Uint8Array_, debugs: _object_, module_texts: _object_}

Current contents of quad ROM. The `debugs` object contains debug objects
like {src, label, start, end}, keyed by pointer. The `module_texts`
object contains the source text of each loaded module, keyed by src.

### {kind: "auto_pause", on: _array_}
### {kind: "auto_refill", enabled: _boolean_}
### {kind: "statuses", verbose: _object_}

Current value as set by the command of the same name.

## Example conversation

    COMMAND {kind: "statuses", verbose: {fault/playing/ram/txn: false}
    COMMAND {kind: "auto_pause", on: ["txn", "fault"]}
    COMMAND {kind: "play"}
    STATUS  {kind: "playing", value: true}
    STATUS  {kind: "ram", ...}
    STATUS  {kind: "txn", ...}
    STATUS  {kind: "playing", value: false}
    COMMAND {kind: "play"}
    STATUS  {kind: "playing", value: true}
    STATUS  {kind: "ram", ...}
    STATUS  {kind: "fault", ...}
    STATUS  {kind: "playing", value: false}
