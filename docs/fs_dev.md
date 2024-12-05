# uFork Filesystem device

The **Filesystem** device provides access to the filesystem.

The uFork interface is implemented as a [dynamic device](host_dev.md) with a
[requestor](requestor.md) interface.

## Open request

An open request produces a file capability.

    open_request -> fs_dev

The input value of the `open_request` is a pair like

    (#open . path)

where `#open` is the `fs_open` export of [dev.asm](../lib/dev.asm), and `path`
is a blob containing the UTF-8 encoded file path.

## Files

Each file is represented as an actor with a [requestor](requestor.md)
interface similar to the [I/O device](io_dev.md), except that a stream of
[blobs](blob_dev.md) are read and written rather than a stream of characters.

A file actor maintains a cursor, the current position within the file in bytes.
Reads and writes always begin at this cursor. When a file is first opened the
cursor is at position `0`, the beginning of the file.

File requests fail if made whilst another request to the same file is in
progress.

The underlying file handle is automatically closed once a file capability is
garbage collected.

### Read request

A request with fixnum input `size` reads at most `size` bytes from the file,
producing a blob. Attempting to read a file whose cursor is positioned at the
end of the file produces `#nil`. The blob being empty or smaller than `size`
does not indicate that the cursor is at the end of the file.

The cursor position is incremented by the number of bytes read.

### Write request

A request with blob input `blob` writes the blob's bytes to the file, starting
at the cursor, then produces `#?`. The file is enlarged as necessary.

The cursor position is incremented by the number of bytes written.

### Truncate request

A request with `#nil` as the input value, the file is truncated at the
cursor.

The cursor is not moved.

### Seek request

A request like `(offset . origin)` moves the cursor to `offset` bytes relative
to the `origin`. The `offset` is a signed fixnum and the `origin` is one of
3 values:

- `0`: beginning of the file
- `1`: current cursor position
- `2`: end of file

If the requested cursor position landed within the file, `#t` is produced.
Otherwise the cursor is clamped to the beginning or end of the file and `#f` is
produced.
