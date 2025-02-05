#!/bin/bash
set -euo pipefail

# Configures an Amazon Linux box to host some of the apps.

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
    --watch=apps/peer_chat/chat.asm \
    --allow-net \
    --allow-read=. \
    apps/peer_chat/chat_server.js \
    localhost:3528 \
    &
nohup deno run \
    --no-config \
    --watch=apps/tcp/random.asm \
    --no-lock \
    --reload \
    --allow-read=. \
    --allow-net \
    --allow-import \
    apps/tcp/tcp.js \
    apps/tcp/random.asm \
    0.0.0.0:8370 \
    &
nohup deno run \
    --no-config \
    --watch=apps/www/static.asm \
    --no-lock \
    --reload \
    --allow-read=. \
    --allow-write=site \
    --allow-net \
    --allow-import \
    apps/www/www.js \
    apps/www/static.asm \
    site \
    0.0.0.0:5887 \
    &
nohup bash -c "
    while true
    do
        sleep 60
        git pull --rebase
    done
" &
