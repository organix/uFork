# uFork TCP networking device

uFork programs can use the TCP device to communicate over the network using
TCP, an insecure reliable binary stream protocol.

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

The input value of the `listen_request` is a pair like

    petname,on_open

where the `petname` is a fixnum that selects a bind address from the config, and
the `on_open` capability receives connections as they are opened.

## Connecting

    connect_request -> tcp_dev

Requests a new connection with a remote party. The input value of the
`connect_request` is a petname fixnum that selects a remote address from the
config. On success, the requestor produces a connection capability.

## Connections

Each connection is represented as a capability with a [requestor](requestor.md)
interface similar to the [I/O device](io_dev.md), except that a stream of
[blobs](blob_dev.md) are read and written rather than a stream of characters.

The underlying connection is disposed once the connection capability has been
garbage collected and has no pending requests.

### Read request

A request with input `#?` produces the next blob received over the connection,
or `#nil` if there is nothing more to read.

The request fails if the underlying connection failed or a previous read request
has not yet completed.

### Write request

A request with a blob input causes that blob to be written in its entirety.
A request with input `#nil` (EOF) closes the connection.
In both cases, `#?` is produced on success.

The request fails if the underlying connection is closed or failed, or a
previous write request has not yet completed.
