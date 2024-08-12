#!/bin/bash
set -euo pipefail

# Configures a Raspberry Pi 1 Model B (armv6l) to host the uFork Peer Chat app.

# Install Node.js (Deno does not provide binaries for the armv6l architecture).

NODE_VERSION=v21.6.2
curl -sSfL https://unofficial-builds.nodejs.org/download/release/$NODE_VERSION/node-$NODE_VERSION-linux-armv6l.tar.gz \
| tar -xz
mv node-$NODE_VERSION-linux-armv6l/bin/node /usr/local/bin/node
rm -rf node-$NODE_VERSION-linux-armv6l

# Fetch Peer Chat source code.

curl -sSfL https://github.com/organix/uFork/archive/refs/heads/main.tar.gz \
| tar -xz
mkdir -p /var/www
mv uFork-main/apps/peer_chat /var/www/peer_chat
chown -R www-data:www-data /var/www/peer_chat
rm -rf uFork-main

# Install the Peer Chat Node.js server as a service.

CHAT_PORT=3528
echo "
[Unit]
Description=uFork Peer Chat app
After=network.target

[Service]
Type=exec
User=www-data
WorkingDirectory=/var/www/peer_chat
Restart=on-failure
ExecStart=node --experimental-default-type=module chat_server.js 127.0.0.1:$CHAT_PORT

[Install]
WantedBy=multi-user.target
" >/etc/systemd/system/peer_chat.service
systemctl daemon-reload
systemctl enable peer_chat.service
systemctl restart peer_chat.service

# Install a reverse proxy to handle HTTPS.

curl -sSfL "https://caddyserver.com/api/download?os=linux&arch=arm&arm=6" \
> /usr/local/bin/caddy
chmod +x /usr/local/bin/caddy
echo "
chat.ufork.org {
    reverse_proxy 127.0.0.1:$CHAT_PORT
}
" >/var/www/Caddyfile
echo "
[Unit]
Description=Caddy reverse proxy
After=network.target

[Service]
Type=exec
User=root
WorkingDirectory=/var/www
Restart=on-failure
ExecStart=caddy run --config Caddyfile

[Install]
WantedBy=multi-user.target
" >/etc/systemd/system/caddy.service
systemctl daemon-reload
systemctl enable caddy.service
systemctl restart caddy.service

