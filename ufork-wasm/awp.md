# Actor Wire Protocol (AWP)

The Actor Wire Protocol facilitates secure, unordered delivery of messages
between actors over the network.

A __party__ is an actor configuration that speaks AWP, living on a machine
somewhere. A party is securely identified by its keypair. Parties find each
other by use of network addresses.

## Specification

The protocol does not guarantee exactly-once delivery. It relies on an
underlying secure, connection-oriented transport protocol to transmit message
BLOBs between parties.

### Transports

The transport is responsible for authenticating remote parties based on the
public and private keys provided, and encrypting frame traffic. Network
addresses are used solely for routing, and are not relied upon for security.

Underlying transports provide an interface made up of two requestor factories
(see https://github.com/douglascrockford/parseq), `connect` and `listen`.

#### Connecting

    connect(
        identity,
        acquaintance,
        on_receive,
        on_close
    ) -> requestor(connect_callback) -> cancel

The `connect` factory takes the following parameters:

    identity
        An object like {public_key, private_key}.

    acquaintance
        An object like {public_key, address}.

    on_receive(connection, frame)
        A function that is called for each frame that arrives over the
        connection.

        The 'connection' parameter is an object with these methods:

            connection.send(frame)
                Sends a frame over the connection. The 'frame' is a Uint8Array.

            connection.public_key()
                Returns the authenticated public key of the remote party,
                as an OED-encodable value.

            connection.close()
                Close the connection.

        The 'frame' parameter is a Uint8Array.

    on_close(connection, reason)
        A function that is called when the connection closes. If the connection
        failed, the 'reason' parameter explains why, otherwise it is undefined.

It returns a requestor that takes a `connect_callback`:

    connect_callback(connection, reason)
        If successful, 'connection' is an object like that described
        for 'on_receive'.

        Otherwise 'connection' is undefined and 'reason' provides an
        explanation.

The requestor may return a `cancel` function that cancels the connect attempt.

#### Listening

    listen(
        identity,
        acquaintance,
        on_open,
        on_frame,
        on_close
    ) -> requestor(listen_callback) -> cancel

The `listen` factory takes the following parameters:

    identity
        An object like {public_key, private_key}.

    bind_address
        The address to bind to.

    on_open(connection)
        A function that is called when a connection is opened. The 'connection'
        parameter is identical to that provided by 'connect_callback'.

    on_receive(connection, frame)
        A function that is called for each frame that arrives over a connection.
        The 'frame' is a Uint8Array.

    on_close(connection, reason)
        A function that is called when a connection is closed. If the connection
        failed, the 'reason' parameter should explain why.

It returns a requestor that takes a `listen_callback`:

    listen_callback(stop, reason)
        If successful, the 'stop' parameter is a function that stops listening.
        Otherwise 'stop' is undefined and 'reason' provides an explanation.

The requestor may return a `cancel` function that cancels the listen attempt.

Once closed, stopped or cancelled, the `on_open`, `on_receive`, and `on_close`
callbacks are not called again.

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

A store holds a party's public key, private key, bind address, and
acquaintances.

Each acquaintance has:
- a petname
- a public key
- an address (optional)

An acquaintance is selected from a store using its petname. Petnames are
non-negative integers. Public keys and addresses must be OED-encodable values.

It is possible to become acquainted with a party that does not disclose an
address. In such cases, communication is only possible whilst that party is
connected.

Currently, stores are managed entirely by the AWP device. Zero or more stores
are preconfigured upon creation of the AWP device. In the future, it will be
possible to create and modify stores via uFork instructions.

A store's configuration might look something like this:

    {
        public_key: "3081EE020100301006072A8648CE3D020106052B810400230481D6...",
        private_key: "0400A84D1FE2AB031BE95356171FDD33ADA2723A6CC4991ACD5C1...",
        bind_address: "0.0.0.0:3000",
        acquaintances: [
            {
                public_key: "0401D11E26A35297D1F60DD1D252A62859C7B08820B55A...",
                address: "1.2.3.4:5678"
            },
            {
                public_key: "042461B5967B66CFED3D2CB23CC1026CE500191E0CBF9B..."
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

Listens for introduction requests, producing a value like `stop` on success.
The `stop` capability stops the listener.

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
