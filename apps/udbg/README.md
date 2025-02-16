# udbg

An interactive debugger that can attach to a uFork core running remotely, be it
in another browser tab or via the network.

To run locally, start [Replete](https://repletejs.org) from your editor (or run
`deno task serve`) and navigate to http://localhost:3675/apps/udbg/index.html.
It will attempt to connect to a listening uFork core at ws://127.0.0.1:8325.
