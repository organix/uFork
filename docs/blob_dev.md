# uFork Binary Large-Object (Blob) Device

The **Blob Device** manages dynamically-allocated byte-arrays.
Each allocation is an actor/capability that implements
a random-access _read_ and _write_ byte interface.

## Allocation Request

Allocation requests are sent directly to the Blob Device.
An _allocation_ request looks like `(customer . size)`.
The `size` is the number of bytes requested.
A capability designating the allocated Blob
is sent to the `customer`,
or `#?` if the allocation could not be satisfied.

## Blob Requests

Blob capabilities issued by the Blob Device respond
to _read_, _write_, _size_, and _source_ requests.
For maximum composability, blob actors implemented in
userspace should respond to all four kinds of request.

The garbage-collector automatically releases allocations
when they are no longer referenced.

### Size Request

A _size_ request is simply a `customer`.
The number of bytes in this allocation
is sent to the `customer` as a _fixnum_.

### Read Request

A _read_ request looks like `(customer . offset)`.
The byte value at `offset` is sent to the `customer`.
If `offset` is out of bounds, the value is `#?`.

### Write Request

A _write_ request looks like `(customer offset . value)`.
The byte `value` is written at `offset`,
and `#t` is sent to the `customer`.
If `offset` is out of bounds, the write has no effect,
and `#f` is sent to the `customer`.

### Source Request

The _source_ request is intended to faciliate
direct memory access (DMA) between devices,
even when a blob is composed of other blobs
(via [blob.slice](../lib/blob.asm), for example).
Generally, _source_ requests are issued by the system.

A _source_ request looks like `(offset size . customer)`.
The source `blob` at `offset` is located and
`(base length . blob)` is sent to the `customer`.
The `base` and `length` together delineate
a range of bytes within `blob`.
The `length` never exceeds the requested `size`.

A source blob is any blob that can not be decomposed
any further, such as a blob issued by the Blob Device.

## JavaScript implementation

There is no allocation size limit.
Blobs are stored on the JavaScript heap,
so blob memory expands as necessary.
See [blob_dev.js](../vm/js/blob_dev.js).

## Rust implementation

There is a moderate (~64K maximum) allocation size limit.
The amount of blob memory available is limited to the
compiled constant `BLOB_RAM_MAX`.
See [blob_dev.rs](../vm/rs/src/blob_dev.rs).

### Memory Layout

Blob memory is managed outside of
the uFork accessable quad-space.
The following snippet of JavaScript
illustrates the layout of Blob memory.

```
let buf = new Uint8Array([              // buffer (9 + 22 = 31 octets)
    0x88,                               // Array
    0x82, 16, 2, 0,                     // length (2 elements)
    0x82, 16, 22, 0,                    // size (13 + 9 = 22 octets)
    0x8B,                               // [0] = Ext (9 + 4 = 13 octets free)
    0x82, 16, 0, 0,                     //       meta (0 offset)
    0x82, 16, 4, 0,                     //       size (4 octets)
    0xDE, 0xAD, 0xBE, 0xEF,             //       data (4 octets)
    0x8A,                               // [1] = Blob (5 + 4 = 9 octets used)
    0x82, 16, 4, 0,                     //       size (4 octets)
    0xCA, 0xFE, 0xBA, 0xBE]);           //       data (4 octets)
```

In this example
there is one _free_ block
and one _allocated_ block.
