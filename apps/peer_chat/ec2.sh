#!/bin/bash
set -euo pipefail

# Configures an Amazon Linux box to host the uFork Peer Chat app.

# Install Deno
curl -fsSL https://deno.land/x/install/install.sh | sh
echo "
export DENO_INSTALL=\"/home/ec2-user/.deno\"
export PATH=\"\$DENO_INSTALL/bin:\$PATH\"
" >> .bashrc
. .bashrc

# Install Caddy (a web server that handles HTTPS automatically)
curl -sSf "https://caddyserver.com/api/download?os=linux&arch=amd64" > caddy
chmod +x caddy

# Install git
sudo yum install git -y

# Clone uFork repo
git clone https://github.com/organix/uFork.git

# Server the Peer Chat example
CHAT_PORT=3528
echo "
chat.ufork.org {
    reverse_proxy :$CHAT_PORT
}
" > Caddyfile
sudo ./caddy start --config Caddyfile &
cd uFork
nohup deno run \
    --allow-net \
    --allow-read=. \
    apps/peer_chat/chat_server.js \
    localhost:$CHAT_PORT \
    &
cd -
