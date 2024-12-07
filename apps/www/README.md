# Web server

This directory contains a Deno web server that serves static files.

## Serving the uFork website

Make sure you have Deno installed, then run

    deno run \
        --no-lock \
        --allow-read=../.. \
        --allow-net \
        --allow-import \
        www.js \
        static.asm \
        ../../site

Then navigate to http://127.0.0.1:5887 in a browser.
