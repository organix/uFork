# AWP demo

This directory contains a distributed demo of the AWP device.

It consists of four Node.js processes each representing a single party.
Together, they carry out the Grant Matcher puzzle described at
http://erights.org/elib/equality/grant-matcher/index.html.

All communications between actors are secured with TLS.

## Running the demo

Make sure you have the development server running (./serve.sh), then run each of
the following commands in separate terminal windows:

    node run.js bob gm.asm
    node run.js carol keqd.asm
    # Wait a moment for Bob and Carol to start listening...
    node run.js alice donor.asm
    node run.js dana donor.asm

On success, the donors (Alice and Dana) will each print something like

     LOG: 536870959 = ^2000002f -> (+0 . #?)

to stdout, indicating that their money has been transferred to the charity.
