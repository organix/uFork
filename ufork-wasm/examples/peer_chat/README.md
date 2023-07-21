# Peer Chat Demo

This directory contains
a self-hosted distributed "chat" application.
The browser-based GUI presents a output panel
and in input control for posting messages.
Each party is given a URL designating "their" room.
By navigating to that URL,
the party joins the conversation
in that room.

## Running the Demo

_Instructions TDB_

## Application Design

The chat application centers around two main components.
The _room_ and the _party_.
The room coordinates messages from one or more parties,
and maintains a list of parties
to whom message are broadcast.
The party manages the output panel and input control,
sending messages to, and receiving messages from,
the room.
A party leaves a room
simply by navigating away
(or closing the browser tab/window).

### Party/Room API

Each party sends messages with the following structure:

    (party msg_num ack_num . content)

The message specifies the originating party,
the sequence number of this message,
the sequence number of the last message received from the room,
and the (possibly empty) content.

Each party is expected to send a message
at least once every 2 seconds.
If the party has nothing new to send,
the content is empty.
If the room does not receive a message
from a particular party
after 6 seconds,
the party is assumed to have left the room.

The room sends messages with the following structure:

    (msg_num ack_num . content)

The room is also expected to send a message
at least once every 2 seconds.
If the room has nothing new to send,
the message is empty.

When a message is acknowledged,
it is removed from the sender's
transmission queue.
Messages that have been transmitted
but not acknowledged
are retransmitted.
Duplicate messages received
are discarded.

#### Room Model

The state of a room consists of the following:

  * A list of parties present in the room, and for each party:
      * A list of unacknowledged messages sent
      * The next received message number expected

#### Party Model

The state of a party consists of the following:
  * A list of unacknowledged messages sent
  * The next received message number expected

#### Link API

The _link_ API provide a reliable abstraction
of a one-way communication channel.
It consists of a transmitter (tx)
and a receiver (rx).
The _tx_ sends a message
at least once every 2 seconds.
If there is nothing to send
the message is empty.
If the _rx_ does not receive a message
from the _tx_ within 6 seconds,
the link is considered broken.

    ---> tx - - - - > rx --->
         ^            |
     ack |            | ack
         |            v
    <--- rx < - - - - tx <---

Messages between _tx_ and _rx_
are given a sequence number for acknowledgment.
Acknowledgments are carried
on a link running in the opposite direction.
When a message is acknowledged,
it is removed from the sender's
transmission queue.
Messages that have been transmitted
but not acknowledged
are retransmitted.
Duplicate messages received
are discarded.
