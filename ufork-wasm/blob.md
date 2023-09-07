# Binary Large-Object (Blob) Device

This device manages allocations of non-quad-space memory
with various sizes measured in octets (bytes).

## Example

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
there is one free block
and one allocated block.
