# uFork Filesystem device

The **Filesystem** device provides access to the filesystem.

The uFork interface is implemented as a [dynamic device](host_dev.md) with a
[requestor](requestor.md) interface.

## File request

A file request produces a file capability.

    file_request -> fs_dev

The input value of the `file_request` is a pair list like

    fs_file,path,create

where `fs_file` is exported by [dev.asm](../lib/dev.asm), `path` is a blob
containing the UTF-8 encoded file path, and `create` is a boolean indicating
whether the file should be created if necessary.

The request fails if `create` is `#f` and the file does not exist.

## File actor

Files are represented as actors with a [requestor](requestor.md) interface.

A file actor maintains a cursor, which is the current position within the file
in bytes. Reads and writes always begin at this cursor. A file actor's cursor
is initially at the beginning of the file, position `0`.

Requests sent to a file actor that is busy processing an existing request will
fail. Any system resources in use by the file actor are released automatically
once it is garbage collected and all requests to it have ended.

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

A request with input `#nil` truncates the file at the cursor.

The cursor is not moved.

### Seek request

A request with input `origin,offset` moves the cursor to `offset` bytes
relative to the `origin`. The `offset` is a signed fixnum and the `origin` is
one of the following values exported by [dev.asm](../lib/dev.asm):

 `origin`    | Meaning
-------------|----------------
`fs_begin`   | beginning of file
`fs_cursor`  | current cursor position
`fs_end`     | end of file

If the requested cursor position was within the file, `#t` is produced.
Otherwise the cursor is clamped to the beginning or end of the file and `#f` is
produced.
