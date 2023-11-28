# AWP demo

This directory contains a couple of implementations of the Grant Matcher puzzle
(a simple distributed application, described at
http://erights.org/elib/equality/grant-matcher/index.html) demonstrating the
AWP device.

## Running the Node.js demo

This demo consists of four Node.js processes, each representing a single party.
All communications are secured with TLS.

Run each of the following commands in separate terminal windows:

    node --experimental-loader ./import_map_loader.js tls.js bob
    node --experimental-loader ./import_map_loader.js tls.js carol
    node --experimental-loader ./import_map_loader.js tls.js alice
    node --experimental-loader ./import_map_loader.js tls.js dana

On success, the donors (Alice and Dana) will each print something like

     LOG: 536870959 = ^2000002f -> (+0 . #?)

to stdout, indicating that their money has been transferred to the charity.

## Running the browser demo

This demo consists of four browser tabs, each representing a single party.
Messages between parties are sent peer-to-peer over WebRTC connections, which
are encrypted with DTLS.

A simple Deno web server serves the HTML and facilitates signalling
(peer discovery and NAT traversal).

Firstly, start the web server:

    deno run --allow-net --allow-read=../.. webrtc.js localhost:4455

In separate browser tabs, navigate to the following URLs:

    http://localhost:4455/gm
    http://localhost:4455/keqd
    http://localhost:4455/donor
    http://localhost:4455/donor

In each of the donor tabs, copy the names from the GM and KEQD tabs and
press "Start". The donors will then attempt to connect to the GM and KEQD
tabs. (Names are based on WebRTC certificates, which must be generated in the
browser and so can not be precomputed. Reloading a tab resets a party's
identity.)

On success, a cash emoji should appear on each of the donor tabs, indicating
that their money has been transferred to the charity.
