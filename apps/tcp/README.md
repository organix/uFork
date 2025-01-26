# TCP device demo

This directory contains a Deno program that listens on a specified port for TCP
connections. Upon connecting, it writes back a random byte and closes the
connection.

## Running it

Make sure you have Deno installed, then run

    deno run --allow-read=../.. --allow-net --allow-import tcp.js random.asm

You can test it by running something like

    nc 127.0.0.1 8370 | od -t x1z

and inspecting the output for a random byte.
