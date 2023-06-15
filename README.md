# μFork

A pure-actor virtual machine with object-capabilities and memory-safety.
The **uFork** processor architecture features
instruction-level concurrency,
automatic memory-management,
and fine-grained resource limits.

![μFork logo](ufork-wasm/www/favicon-128.png)

The blog post
"[Memory Safety Simplifies Microprocessor Design](http://www.dalnefre.com/wp/2022/08/memory-safety-simplifies-microprocessor-design/)"
describes the high-level architecture,
and the rationale behind it.

![uFork Rust/WASM debugger](screenshot20230410.png)

## Implementations

The initial prototype is [implemented in **C**](c_src/README.md)
and hosts a Scheme REPL with actor extensions.

The [Rust/WASM version](ufork-wasm/README.md)
is intended to be a more-robust implementation.
Multiple instances of the WASM component
can be instantiated to simulate a multi-core
or distributed system.

An FPGA implementation is planned for the future.

## Documentation

  * [uFork Project Summary](summary.md)
  * [uFork Virtual Machine](ufork.md) Reference Manual
  * Specification for [Sponsor](sponsor.md) semantics
  * Meta-circular [LISP/Scheme interpreter](lisp.md) evolution
  * [uFork Design Notes](design.md)

## License

[Apache License](LICENSE), Version 2.0

## Project Support

![Logo NLnet: abstract logo of four people seen from above](NLnet_banner.png){width=128} ![Logo NGI Zero: letterlogo shaped like a tag](NGI0Entrust_tag.svg){width=25%}

[This project](https://nlnet.nl/project/uFork/)
was funded through the [NGI0 Entrust](https://nlnet.nl/entrust) Fund,
a fund established by [NLnet](https://nlnet.nl/) with financial support from
the European Commission's [Next Generation Internet](https://ngi.eu/) programme,
under the aegis of DG Communications Networks,
Content and Technology under grant agreement N<sup>o</sup> 101069594.
