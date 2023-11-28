# μFork Simulator in WASM

This implementation of the [**uFork** virtual machine](../../docs/ufork.md)
is written in [Rust](https://www.rust-lang.org/)
and targets the browser's [WASM engine](https://webassembly.org/).

Only [WASM 1.0 (MVP)](https://github.com/WebAssembly/design/blob/main/MVP.md)
features are used in this implementation.

The virtual machine semantics are described in [vm.md](../../docs/vm.md).

A [browser-based GUI](../../apps/debugger/README.md) implements a debugger for a
uFork processor core.
