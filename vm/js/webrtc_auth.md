# Using WebCrypto keypairs for the WebRTC transport

WARNING: the below proposal is vulnerable to a MITM attack. Parties should sign
their RTCCertificate fingerprints to avoid this.

I propose that we transition to using WebCrypto keypairs as identities for the
WebRTC transport, rather than the RTCCertificate objects that we use
currently.

This would provide a means for parties to prove their identity to signalling
servers, currently impossible because RTCCertificate objects are completely
opaque and single-purpose. It would also become possible to import and export
identities from the browser, and to extend the lifetime of identities
(RTCCertificates are limited to a single year).

However, the use of dedicated keypairs comes at a cost: parties must perform
additional authentication steps during connection negotiation.

Firstly, the signalling server must verify the identity of connecting parties.
This prevents adversaries from masquerading as legitimate parties, who could
then introduce spurious signalling traffic to thwart legitimate WebRTC
connection negotiations.

When a party connects, the signalling server issues a challenge in the form of a
securely random nonce. The party signs the nonce with their private key and
responds with the resulting signature. The server verifies the signature,
dropping the connection if it is invalid. Because the connection with the
signalling server is ordered, the party can begin signalling immediately.
(For now, the party relies on HTTPS to verify the identity of the signalling
server, but it would be easy to incorporate a public key into the
signalling server's address so that the party could issue its own challenge.)

During signalling, another challenge in the form of a securely random nonce is
included by each party in their SDP offer/answer. SDP offers/answers also
contain a fingerprint of the RTCCertificate used to encrypt the connection.
Because a random RTCCertificate and nonce are generated for each new
connection, there is no need to keep them secret. A compromised or
malfunctioning signalling server can at worst fail to introduce connected
parties, essentially performing a DoS attack against itself.

Following signalling, a WebRTC connection is established. Each party signs the
nonce with their private key and sends a message containing the resulting
signature. If a party finds a signature to be invalid, it tears down the
connection. Otherwise they send an auth acknowledgement that acts as a
synchronization signal, necessary only because we are using unordered data
channels.

Once a party has verified the remote auth response and received the remote
party's acknowledgement of their own auth response, they may begin sending AWP
frames.

These two handshakes introduce additional network latency: 0.5 roundtrips for
the signalling server challenge, and 1 roundtrip for the peer-to-peer
challenge. Considering the number of roundtrips already required to set up a
secure WebSocket connection to the signalling server (2+) and to negotiate a
WebRTC connection (3+), adding 1.5 roundtrips for better security and
flexibility seems acceptable.

- https://github.com/paulmillr/noble-ed25519
- https://w3c.github.io/p2p-webtransport/ (WebRTC over QUIC)
