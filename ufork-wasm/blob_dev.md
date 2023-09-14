# uFork Binary Large-Object (Blob) Device

The **Blob Device** manages dynamically-allocated byte-arrays.
There is a moderate (~64K maximum) allocation size limit.
Each allocation is an actor/capability that implements
a random-access _read_ and _write_ byte interface.

## Allocation Request

Allocation requests are sent directly to the Blob Device.
An _allocation_ request looks like `(customer size)`.
The `size` is the number of bytes requested.
A capability designating the allocation
is sent to the `customer`.
The allocation actor/capability handles
_read_, _write_, and _size_ requests.
The garbage-collector automatically releases allocations
when they are no longer referenced.

## Size Request

A _size_ request looks like `(customer)`.
The number of bytes in this allocation
is sent to the `customer` as a _fixnum_.

## Read Request

A _read_ request looks like `(customer offset)`.
The byte value at `offset` is sent to the `customer`.
If `offset` is out of bounds, the value is `#?`.

## Write Request

A _write_ request looks like `(customer offset value)`.
The byte `value` is written at `offset`,
and `#unit` is sent to the `customer`.
If `offset` is out of bounds, the write has no effect.

## Memory Layout

Blob memory is managed outside of
the uFork accessable quad-space.
The following snippent of JavaScript
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
