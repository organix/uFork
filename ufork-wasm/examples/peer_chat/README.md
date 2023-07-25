# Peer Chat Demo

This directory contains
a self-hosted distributed "chat" application.
The browser-based GUI presents an output panel
and an input control for posting messages.
Each party is given a URL designating "their" room.
By navigating to that URL,
the party joins the conversation
in that room.

## Running the Demo

Make sure you have Deno (https://deno.land) installed.
Run the following command from the ufork-wasm directory to start the web server:

    deno run
        --allow-net \
        --allow-read=. \
        examples/peer_chat/chat_server.js \
        localhost:3528

Then navigate to http://localhost:3528 in a browser.

## Application Design

The chat application centers around two main components.
The _room_ and the _party_.
The _room_ aggregates messages from one or more parties,
and maintains a set of parties
to whom messages are broadcast.
The _party_ manages the output panel and input control,
sending messages to, and receiving messages from,
the room.
A party leaves a room
simply by navigating away
(or closing the browser tab/window).

### Link Protocol

The _link_ protocol provides a reliable abstraction
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

    ---> tx - - - - - > rx --->
          ^     msg      |
      ack |              | ack
          |     msg      v
    <--- rx < - - - - - tx <---

Messages between _tx_ and _rx_
are given a sequence number for acknowledgment.
Acknowledgments are carried
on a link running in the opposite direction.
Messages from _tx_ to _rx_
have the following structure:

    (ack seq . content)

When a message is acknowledged,
it is removed from the sender's
transmission queue.
Messages that have been transmitted
but not acknowledged
are retransmitted.
Duplicate messages are discarded.
Empty messages are acknowledged,
then discarded.

                A_tx        A_rx                B_rx        B_tx
            {ack:5,seq:1, {seq:6}             {seq:1}   {ack:0,seq:6,
                Q:[]}        |                   |         Q:[]}
                 |           |                   |           |
    -(1 . m1)--->#           |                   |           |
                 #-(5 1 . m1)------------------->#           |
            {ack:5,seq:2,    |                   #-m1------------------->
            Q:[(1 . 123)]}   |                   #-(-1 5 1)->#
                 |           |                {seq:2}        #
                 |           |                   |      {ack:1,seq:6,
                 |           |                   |         Q:[]}
                 |           |                   |           |
                 |           |                   |           #<----(0 6)-
                 |           #<------------------------(1 6)-#
                 #<-(-1 1 6)-#                   |      {ack:1,seq:7,
                 #        {seq:7}                |        Q:[(6)]}
            {ack:6,seq:2,    |                   |           |
                Q:[]}        |                   |           |
                 |           |                   |           |

This sequence diagram illustrates the transfer of message _m1_,
and it's acknowledgment via the timer at the receiving end.

### Party Configuration

Each _party_ has
an input device for writing messages
and an output device for displaying them.
They are not directly connected, of course.
The input is sent a _room_,
which aggregates messages from multiple parties
and distributes them to each party
for display on the output.

                                        p_tx_timer
                                            |
                                            v
    input ---> line_in ---> party_in ---> party_tx - - - > (to room)
                                            ^
                                            |
    output <-- line_out <-- party_out <-- party_rx < - - - (from room)
                                            ^
                                            |
                                        p_rx_timer

  * The `input` device collects characters from the user.
  * The `line_in` buffers characters into lines.
  * The `party_in` labels lines as messages to transmit.
  * The `party_tx` implements the transmit-side of the _link_ protocol.
  * The `p_tx_timer` provides a 1-second retransmition timeout.
  * The `party_rx` implements the receive-side of the _link_ protocol.
  * The `p_rx_timer` provides a 3-second idle-detection timeout.
  * The `party_out` extracts the _content_ from the message.
  * The `line_out` streams a line of characters to the output.
  * The `output` device displays characters to the user.

### Room Configuration

Each _room_ has
a collection of connected parties.
For each message received from a _party_,
the room sends a copy
to each currently-connected party.
The room maintains an _rx_/_tx_ pair
for each connected party.

                     r_rx_timer              :
                         |                   :
                         v                   :
    (from party) - - > room_rx ---> room_in ---> room { party: tx, ...parties }
                         |                   :                  |
                         v                   :                  |
    (to party) < - - - room_tx <--------------------------------+
                         ^                   :
                         |                   :
                     r_tx_timer              :
                                             :
                            (for each party) :

  * The `room_rx` implements the receive-side of the _link_ protocol.
  * The `r_rx_timer` provides a 3-second idle-detection timeout.
  * The `room_in` labels lines with the originating _party_.
  * The `room` aggregates messages and distributes them to the _parties_.
  * The `room_tx` implements the transmit-side of the _link_ protocol.
  * The `r_tx_timer` provides a 1-second retransmition timeout.

### Message Contents

The _content_ of a message
is the characters constituting
a single line of text
from a _party_.
It is represented by
a _deque_ structure
containing fixnum _codepoints_.
The final codepoint is `'\n'`,
the _newline_ character.
