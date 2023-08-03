#!/bin/bash
set -euo pipefail

# Configures an Amazon Linux box to host uFork examples.

# Install Deno
curl -fsSL https://deno.land/x/install/install.sh | sh
echo "
export DENO_INSTALL=\"/home/ec2-user/.deno\"
export PATH=\"\$DENO_INSTALL/bin:\$PATH\"
" >> .bashrc
. .bashrc

# Install Rustup (cargo, rustc etc)
sudo yum install gcc -y
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source .cargo/env

# Install Caddy (a web server that handles HTTPS automatically)
curl -sSf "https://caddyserver.com/api/download?os=linux&arch=amd64" > caddy
chmod +x caddy

# Install git
sudo yum install git -y

# Clone uFork repo (James's fork)
git clone https://github.com/jamesdiacono/uFork.git

# Server the Peer Chat example
CHAT_PORT=3528
echo "
chat.ufork.org {
    reverse_proxy :$CHAT_PORT
}
" > Caddyfile
sudo ./caddy start --config Caddyfile &
cd uFork/ufork-wasm
./build.sh
nohup deno run \
    --allow-net \
    --allow-read=. \
    examples/peer_chat/chat_server.js \
    localhost:$CHAT_PORT &
cd -
