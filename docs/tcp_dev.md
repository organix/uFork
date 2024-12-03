# uFork TCP networking device

uFork programs can use the TCP device to communicate over the network using
TCP, a reliable binary stream protocol that is not secure.

The uFork interface is implemented as a [dynamic device](host_dev.md) with a
[requestor](requestor.md) interface.

## Config

The config holds the bind address of the local party and the addresses of remote
parties. It is specified upon creation of the TCP device and does not change.

An address is selected from the config using its petname, a non-negative integer
indexing into the array.

Addresses are strings like `<hostname>:<port>`.

A config might look something like

    ["0.0.0.0:3000", "2.2.2.2:3000", "3.3.3.3:3000"]

where petname `0` refers to a bind address and petnames `1` and `2` refer to
remote addresses.

## Listening

    listen_request -> tcp_dev

Listens for connections, producing a `stop` capability on success that
can be used to stop listening:

    _ -> stop

The input value of the `listen_request` is a pair list like

    (petname on_open . on_close)

where the `petname` is a fixnum that selects a bind address from the config, the
`on_open` actor receives connections as they are opened, and the `on_close`
actor receives connections as they are closed.

## Connecting

    connect_request -> tcp_dev

Requests a new connection with a remote party. The input value of the
`connect_request` is a petname fixnum that selects a remote address from the
config. On success, the requestor produces a connection actor.

## Connections

Each connection is represented as an actor with a [requestor](requestor.md)
interface similar to the [I/O device](io_dev.md), except that a stream of
[blobs](blob_dev.md) are read and written rather than a stream of characters.

### Read request

When sent a request with input `#?`, it produces the next blob received over the
connection, or `#nil` if the connection was closed by the other party.

Fails if the connection failed or the previous read request has not yet
completed.

### Write request

When sent a request with an input blob, it writes that blob to the connection
and produces `#?`. Fails if the connection failed.

Fails if the connection failed or the previous write request has not yet
completed.

### Close request

When sent a request with input `#nil` (indicating end-of-stream) the connection
is closed (if it is open) and `#?` is produced. Infallible.
