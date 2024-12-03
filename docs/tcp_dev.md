# uFork TCP networking device

uFork programs can use the TCP device to communicate over the network using
TCP, a reliable binary stream protocol that is not secure.

The uFork interface is implemented as a [dynamic device](host_dev.md) with a
[requestor](requestor.md) interface.

## Stores

The store holds the bind address of the local party and the addresses of remote
parties. It is configured upon creation of the TCP device.

An address is selected from the store using its petname, a non-negative integer
that indexes into the array.

Addresses are strings like `<hostname>:<port>`.

A store's contents might look something like

    {
        addresses: ["0.0.0.0:3000", "2.2.2.2:3000", "3.3.3.3:3000"]
    }

where petname `0` refers to a bind address and petnames `1` and `2` refer to
remote addresses.

## Connecting

    connect_request -> tcp_dev

Requests a new connection with a remote party. The input value of the
`connect_request` is a petname fixnum that selects a remote address from the
store.

## Listening

    listen_request -> tcp_dev

Listens for connections, producing a `stop` capability on success that
can be used to stop listening:

    _ -> stop

The input value of the `listen_request` is a pair like

    (on_open . on_close)

where the `on_open` actor receives connections as they are opened, and the
`on_close` actor receives connections as they are closed.

## Connections

Each connection is represented as an actor with a [requestor](requestor.md)
interface similar to the [I/O device](io_dev.md), except that a stream of
[blobs](blob_dev.md) are read and written rather than a stream of characters.

### Read request

When sent a request with input `#?`, it produces the next blob received over the
connection.

**WARNING:** It is an error to request a read whilst one is in progress.

## Write request

When sent a request with an input blob, it writes that blob to the
output stream and produces `#?`.

**WARNING:** It is an error to request a write whilst one is in progress.

## Close request

When sent a request with input `#nil` (indicating end-of-stream) the connection
is closed gracefully and `#?` is produced. Sending a close request
to a closed stream is not an error.
