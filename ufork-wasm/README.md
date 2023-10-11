# uFork Simulator in Rust

This [implementation](vm.md) of the [**uFork** virtual machine](../ufork.md)
is written in [Rust](https://www.rust-lang.org/)
and targets the browser's [WASM engine](https://webassembly.org/).
A browser-based GUI implements a debugger for a uFork processor core.

## Shell Scripts

Frequently-used command-line sequences are captured in a few small shell scripts.

### Build both Debug and Release versions

    $ ./build.sh

### Run the Test Suites

    $ ./test.sh

### Run Browser-based Tools (including the debugger)

    $ ./server.sh

## Documentation

  * Loader [Intermediate Language](crlf.md) specification
  * [Assembly Language](asm.md) reference manual
  * [LISP/Scheme compiler](scheme.md) reference manual
  * [Actor Wire Protocol (AWP)](awp.md) specification
  * [AWP Network](awp_device.md) device description
  * [Virtual Machine](vm.md) implementation details
  * [Sponsor](sponsor.md) semantics
  * [Console Input/Output](io_dev.md) device description
  * [Binary Large-Object (blob)](blob_dev.md) device description
  * [Garbage-collected](gc.md) memory management
