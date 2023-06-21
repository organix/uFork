# Actor Wire Protocol (AWP)

The Actor Wire Protocol facilitates secure, unordered delivery of messages
between actors over the network.

A __party__ is an actor configuration that speaks AWP, living on a machine
somewhere.

Every party has a secure __name__ that it can prove it owns.

Parties find each other by use of network __addresses__.

## Specification

The protocol does not guarantee exactly-once delivery. It relies on an
underlying secure, connection-oriented transport protocol to transmit message
BLOBs between parties.

### Transports

The transport is responsible for providing secure connections. This includes
authenticating remote parties and encrypting frame traffic. Note that network
addresses are used solely for routing, and should not be relied upon for
security.

Underlying transports provide an interface made up of two requestor functions
(see https://github.com/douglascrockford/parseq), `connect` and `listen`.

#### Connecting

The `connect` requestor takes an object with the following properties:

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

It produces a connection object like that described for `on_receive`, and may
return a `cancel` function that cancels the connect attempt.

Once closed or cancelled, the `on_receive`, and `on_close` functions are not
called again.

#### Listening

The `listen` requestor takes an object with the following properties:

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

It produces a `stop` function that stops listening when called, and may return a
`cancel` function that cancels the listen attempt.

Once stopped or cancelled, the `on_open`, `on_receive`, and `on_close` callbacks
are not called again.

### Frames

Each frame is transmitted as an OED-encoded object. There are two kinds of
frames: message frames and acknowledgement frames.

Message frames have the following properties:

- `id`: the frame's unique identifier.
- `to`: the destination actor's swiss number. If omitted, the message is
  delivered to the greeter.
- `message`: the OED-encoded message. Actor addresses are represented as
  Extension BLOBs, where the meta field resembles `connect_info` and the data
  field is the actor's local designation.
- `acknowledge`: true if the frame requires acknowledgement. Defaults to false.

Acknowledgement frames have a single property:

- `ack`: the identifier of the frame being acknowledged.

## uFork implementation

The uFork AWP interface is implemented as a dedicated device. The AWP device's
messages all adhere to the "requestor" pattern.

### Requestors

Actors with the following message signature are called "requestors". They
support cancellation and failure notification. They take an optional `request`
value, and produce a value on success. The requestor pattern is based on the
parseq library (https://github.com/douglascrockford/parseq).

    (cancel_customer callback . request) -> requestor

If `cancel_customer` is an actor, the requestor _may_ send it a `cancel` actor.

    cancel -> cancel_customer

If there comes a time when the reply is no longer needed, the `cancel` actor
can be used to cancel the operation. Its sole purpose is to avoid unnecessary
work. It is not an undo.

    -> cancel

The `callback` receives a pair when the request completes (which may be
never). The value of the tail indicates success or failure.

On success, the tail of the pair is `#nil` and the head of the pair is the
resulting value.

    (value) -> callback

On failure, the tail is the reason for failure (guaranteed not to be `#nil`) and
the head is `#?`.

    (#? . reason) -> callback

### Stores

A store holds a party's identity, secure name, address, bind info, and
acquaintances.

Each acquaintance has:
- a petname (unique within the store)
- a secure name (globally unique)
- an address (optional)

An acquaintance is selected from a store using its petname. Petnames are
non-negative integers. Names and addresses must be OED-encodable values.

It is possible to become acquainted with a party that does not disclose an
address. In such cases, communication is only possible whilst that party is
connected.

Currently, stores are managed entirely by the AWP device. Zero or more stores
are preconfigured upon creation of the AWP device. In the future, it will be
possible to create and modify stores via uFork instructions.

A store's contents might look something like this:

    {
        identity: "0400A84D1FE2AB031BE95356171FDD33ADA...", // private key
        name: "3081EE020100301006072A8648CE3D020106052...", // public key
        address: "2.2.2.2:3000",                            // network address
        bind_info: "0.0.0.0:3000",                          // bind address
        acquaintances: [
            {
                name: "0401D11E26A35297D1F60DD1D252A62...", // public key
                address: "3.3.3.3:3000"                     // network address
            },
            {
                name: "042461B5967B66CFED3D2CB23CC1026..."  // public key
            }
        ]
    }


### Introduction

    (#intro cancel_customer callback store petname . hello_data) -> awp_device

Requests an introduction to an acquaintance, producing a greeting.

The `store` fixnum chooses the local party's AWP store. In the future, `store`
will be a capability rather than a fixnum.

The `petname` fixnum chooses an acquaintance from the store.

The `hello_data` value is provided to the greeter at the remote end. If no
greeter is available, the request fails.

### Listening

    (#listen cancel_customer callback store greeter) -> awp_device

Listens for introduction requests, producing a `stop` capability on success that
can be used to stop listening:

    -> stop

The `store` fixnum chooses the local party's AWP store.

The `greeter`, if provided, is a requestor actor that responds to introduction
requests. It produces a "greeting" value, perhaps containing capabilities. In
this way, the greeter lets remote parties bootstrap a relationship from scratch.

    (cancel_customer callback petname . hello_data) -> greeter

The `petname` identifies the acquaintance requesting the introduction, and could
be useful authentication and logging. Unknown parties are added to the store,
becoming acquaintances automatically.

The `hello_data` is the value included in the introduction request.

### Marshalling

uFork quad-space values are marshalled into OED.

Each capability in an outgoing message is encoded as an Extension BLOB
containing:

- the actor's Swiss number (a 128-bit random value)
- the public key of the actor's party
- the address of the actor's party

Each capability found in an incoming message is decoded as a proxy actor.
Messages sent directly to a proxy actor are sent _unreliably_ to the remote
actor.

It is possible to perform a _reliable_ send using the AWP device directly:

    (#send cancel_customer callback proxy . message) -> awp_device

This requestor produces an acknowledgement if it becomes known that the
`message` was received by the remote transport. An acknowledgement does not
guarantee that the `message` was received by `proxy`'s remote actor. Unlike an
unreliable send, this requestor provides timely notification of underlying
transport failure.
