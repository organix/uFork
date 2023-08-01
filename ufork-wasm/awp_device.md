# uFork's AWP device

## Transports

Underlying transports provide an interface made up of two requestor factories
(see https://github.com/douglascrockford/parseq), `connect` and `listen`.

The transport interface may also have a `generate_identity` requestor factory
that produces new identities, and an `identity_to_name` function that takes an
identity and returns the corresponding name.

### Connecting

The `connect` requestor factory takes the following parameters:

    identity
        Used to prove ownership of the local party's name and secure the
        connection. For example, a private key.

    name
        The remote party's secure name. For example, a public key.

    address
        The remote party's network address.

    on_receive(connection, frame)
        A function that is called for each frame that arrives over the
        connection.

        The 'connection' parameter is an object with these methods:

            connection.send(frame)
                Sends a frame over the connection. The 'frame' is a Uint8Array.

            connection.name()
                Returns the authenticated name of the remote party, as an
                OED-encodable value.

            connection.close()
                Close the connection.

        The 'frame' parameter is a Uint8Array.

    on_close(connection, reason)
        A function that is called when the connection closes. If the connection
        failed, the 'reason' parameter explains why, otherwise it is undefined.

The returned requestor produces a connection object like that described for
`on_receive`, and may return a `cancel` function that cancels the connect
attempt.

Once closed or cancelled, the `on_receive`, and `on_close` functions are not
called again.

### Listening

The `listen` requestor factory takes the following parameters:

    identity
        Used to prove ownership of the local party's name and secure the
        connection. For example, a cryptographic keypair.

    bind_info
        Network-related configuration. For example, an address to bind to.

        The value of 'identity' and 'bind_info' depend on the needs of the
        transport. They do not have to be OED-encodable.

    on_open(connection)
        A function that is called when a connection is opened. The 'connection'
        parameter is identical to that provided by 'connect_callback'.

    on_receive(connection, frame)
        A function that is called for each frame that arrives over a connection.
        The 'frame' is a Uint8Array.

    on_close(connection, reason)
        A function that is called when a connection is closed. If the connection
        failed, the 'reason' parameter should explain why.

The returned requestor produces a `stop` function that stops listening when
called, and may return a `cancel` function that cancels the listen attempt.

Once stopped or cancelled, the `on_open`, `on_receive`, and `on_close` callbacks
are not called again.

## uFork device

The uFork AWP interface is implemented as a dedicated device. The AWP device's
messages all adhere to the "requestor" pattern (see lib/requestors/README.md).

### Stores

A store holds a party's identity, secure name, address, bind info, and
acquaintances.

Each acquaintance has:
- a petname (unique within the store)
- a secure name (globally unique)
- an address (optional)

An acquaintance is selected from a store using its petname, a non-negative
integer that indexes into the acquaintances array. A store always contains at
least one acquaintance: itself, with petname 0.

Names and addresses must be OED-encodable values.

It is possible to become acquainted with a party that does not disclose an
address. In such cases, communication is only possible whilst that party is
connected.

Currently, stores are managed entirely by the AWP device. Zero or more stores
are preconfigured upon creation of the AWP device. In the future, it will be
possible to create and modify stores via uFork instructions.

A store's contents might look something like this:

    {
        identity: "0400A84D1FE2AB031BE95356171FDD3...", // private key
        bind_info: "0.0.0.0:3000",                      // bind address
        acquaintances: [
            {
                name: "3081EE020100301006072A8648C...", // own public key
                address: "2.2.2.2:3000"                 // own network address
            },
            {
                name: "0401D11E26A35297D1F60DD1D25...", // public key
                address: "3.3.3.3:3000"                 // network address
            },
            {
                name: "042461B5967B66CFED3D2CB23CC..."  // public key
            }
        ]
    }


### Introduction

    (#intro to_cancel callback store petname . hello_data) -> awp_device

Requests an introduction to an acquaintance, producing a greeting.

The `store` fixnum chooses the local party's AWP store. In the future, `store`
will be a capability rather than a fixnum.

The `petname` fixnum chooses an acquaintance from the store.

The `hello_data` value is provided to the greeter at the remote end. If no
greeter is available, the request fails.

### Listening

    (#listen to_cancel callback store greeter) -> awp_device

Listens for introduction requests, producing a `stop` capability on success that
can be used to stop listening:

    () -> stop

The `store` fixnum chooses the local party's AWP store.

The `greeter`, if provided, is a requestor actor that responds to introduction
requests. It produces a "greeting" value, perhaps containing capabilities. In
this way, the greeter lets remote parties bootstrap a relationship from scratch.

    (to_cancel callback petname . hello_data) -> greeter

The `petname` identifies the acquaintance requesting the introduction, and could
be useful authentication and logging. Unknown parties are added to the store,
becoming acquaintances automatically.

The `hello_data` is the value included in the introduction request.

### Sending

It is possible to be notified when a message has been successfully sent by the
AWP device.

    (#send to_cancel callback proxy . message) -> awp_device

This requestor produces an acknowledgement if it becomes known that the
`message` was sent by the local transport. An acknowledgement does not
guarantee that the `message` was received by the remote transport. Unlike an
unreliable send, this requestor provides timely notification of connection
failure.

### Marshalling

uFork quad-space values are marshalled into OED.

Each capability found in an incoming message is decoded as a proxy actor.
Messages sent directly to a proxy actor are sent unreliably to the remote
actor.
