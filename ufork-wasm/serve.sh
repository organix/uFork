#!/bin/bash

pushd "$( dirname "${BASH_SOURCE[0]}" )"

deno run --allow-read=. --allow-net=localhost www/server.js
