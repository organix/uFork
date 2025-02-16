# udbg (interactive debugging protocol)

This directory provides facilities for the interactive debugging of uFork WASM
cores running under remote JavaScript hosts.

The following diagram illustrates the components involved in attaching a
debugger to a running core.

    +---------------+
    |  Debugger UI  |   Displays the core's state and provides user controls.
    +-------+-------+
            |
    +-------+-------+
    | Bridge client |   Relays messages to and from the bridge server.
    +-------+-------+
            |
            |
    - - - - - - - - -   Communication via postMessage or WebSockets.
            |
            |
    +-------+-------+
    | Bridge server |   Relays messages to and from bridge clients.
    +-------+-------+
            |
    +-------+-------+
    |  Core Driver  |   Asynchronous message-based interface for a core.
    +-------+-------+
            |
    +-------+-------+
    |     Core      |   JavaScript interface (ufork.js) for a WASM core.
    +---------------+

Between the debugger UI and the core driver, all communication is with messages.
The message protocol is described in ./core_driver.js.
