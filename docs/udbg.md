# udbg Debugging Protocol

An asynchronous messaging protocol for remotely controlling and debugging a
uFork core. The protocol follows a publish-subscribe (rather than a
request-response) model, in order to mitigate the effects of network latency.

Message delivery is assumed to be reliable and in order.

## Command messages

Command messages are objects with a `kind` property.

### {kind: "statuses", verbose: _object_}

Specify which status properties are published and how often. By default, no
statuses are published.

The `verbose` object is a mapping from status properties to verbosity levels:

Verbosity   | Meaning
------------|---------------------------
`undefined` | Never published
`false`     | Published only on pause
`true`      | Always published

For example, the verbosity object `{idle: true, txn: false}` means that "idle"
statuses are published in between pauses, "txn" statuses are published only on
pause, and no other statuses are published.

This command does not always take effect immediately, there may be a delay of
one or two steps.

### {kind: "play"}

Start running the core. The playing state persists even through periods of
idleness, automatically continuing when the core is awoken by a device.

The driver will pause only when a "pause" command is received or an "auto_pause"
condition is satisfied.

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

Each of these correspond to a status property of the same name, which will be
included in the status message published upon pausing.

Specifying "debug" or "instr" will cause maximum execution speed to be
significantly reduced.

### {kind: "refill", resources: _object_}

Refill the root sponsor with the given `resources`, an object like
{memory, events, cycles}.

### {kind: "auto_refill", enabled: _boolean_}

Enables or disables automatic refilling of the root sponsor.
When `enabled` is true, the "play" command behaves as if the root
sponsor is inexhaustible. Enabled by default.

## Status messages

Status messages provide real-time updates on the state of the core. Each status
message represents the state of the core at a particular moment in time.

Unlike command messages, status messages do not have a `kind` property. Rather,
each property represents some aspect of core state, and is only included in the
status message if the client has expressed interest via a "statuses" command.

For example, the following status message would be published upon the core
encountering an audit (assuming that "audit" had been specified in
an "auto_pause" command and "playing", "ram", and "audit" had been specified in
a "statuses" command).

    {
        playing: {value: false},
        ram: {bytes: ...},
        audit: {code: ..., evidence: ...}
    }

### playing: {value: _boolean_}

Whether the driver is currently "playing". This does not necessarily
mean the core is running, just that the core will run when it is given
some work. The driver is initially paused (false).

### ram: {bytes: _Uint8Array_}

Current contents of quad RAM.

### rom: {bytes: _Uint8Array_, debugs: _object_, module_texts: _object_}

Current contents of quad ROM. The `debugs` object contains debug objects
like {src, label, start, end}, keyed by pointer. The `module_texts`
object contains the source text of each loaded module, keyed by src.

### auto_pause: {on: _array_}
### auto_refill: {enabled: _boolean_}
### statuses: {verbose: _object_}

Current value as set by the command of the same name.

The remaining statuses (listed above for the "auto_pause" command) are special
in that they are mutually exclusive within each status message. For example, it
is impossible for a status message to contain both `instr` and `audit`
properties.

### audit: {code: _integer_, evidence: _raw_}

An audit has occurred. See `on_audit` in core.js.

### debug: {}

A breakpoint has been reached.

### fault: {code: _integer_}

The core halted with a fault signal, for example `E_FAIL`.

### idle: {}

The core has become idle, producing the signal `E_OK`.

### instr: {}

An instruction finished executing.

### txn: {sender: _raw_, events: _array_, wake: _boolean_}

An actor or device transaction has reached its conclusion.
See `on_txn` in core.js.

## Example conversation

    COMMAND {kind: "statuses", verbose: {idle/playing/ram/txn: false}
    COMMAND {kind: "auto_pause", on: ["txn", "idle"]}
    COMMAND {kind: "play"}
    STATUS  {playing: {value: true}}
    STATUS  {playing: {value: false}, ram: {...}, txn: {...}}
    COMMAND {kind: "play"}
    STATUS  {playing: {value: true}}
    STATUS  {playing: {value: false}, ram: {...}, idle: {}}
