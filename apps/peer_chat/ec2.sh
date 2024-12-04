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

# Serve the Peer Chat example, automatically checking for updates from the
# repo.
echo "
chat.ufork.org {
    reverse_proxy :3528
}
" > Caddyfile
sudo ./caddy start --config Caddyfile &
cd uFork
nohup deno run \
    --watch \
    --allow-net \
    --allow-read=. \
    apps/peer_chat/chat_server.js \
    localhost:3528 \
    &
nohup bash -c "
    while true
    do
        sleep 60
        git pull --rebase
    done
" &
