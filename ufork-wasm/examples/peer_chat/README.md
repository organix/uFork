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
The room coordinates messages from one or more parties,
and maintains a list of parties
to whom messages are broadcast.
The party manages the output panel and input control,
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
Duplicate (or empty) messages received
are discarded.

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
