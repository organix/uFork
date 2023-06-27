// A WebRTC AWP transport for the browser.

// The 'webrtc_transport' function takes a signaller requestor, and an optional
// logging function that is called with detailed debugging info.

// Types

//      name
//          The SHA-256 fingerprint of an RTCCertificate as a 32-byte
//          Uint8Array.

//      address
//      bind_info
//          The URL string of a signalling server.

//      identity
//          An RTCCertificate object associated with a P-256 ECDSA keypair.

// TODO use a WebCrypto keypair as the identity instead, so the signalling
// server can authenticate its clients. We don't want to leak SDP info
// (IP addresses, etc) to third parties. (There is not way to access the
// private key of an RTCCertificate object, so we can't use it for
// authentication.) To authenticate the WebRTC connection, a challenge and
// response could be added to the SDP offer and answer.

// Signalling

//      Peer-to-peer discovery is facilitated by a signalling server.

//      The signaller requestor attempts to establish a connection with a
//      signalling server. It takes a spec object with the following
//      properties:

//          name
//              The local party's name.

//          address
//              The signalling server's address as a string.

//          on_receive(from, message)
//              A callback function that is called each time a message is
//              received from the signalling server. The 'from' parameter is
//              the remote party's name, and the 'message' is an object.

//      It produces an object with the following properties:

//          send(to, message)
//              A function that sends a 'message' object to all parties with the
//              name 'to'.

//          close()
//              Closes the connection to the signalling server.

// Debugging

//      WebRTC is tricky to get right. A lot can go wrong in establishing
//      peer-to-peer connections, and the browser's WebRTC interface is
//      fiendishly intricate and very asynchronous.

//      There is a comprehensive guide to debugging WebRTC connections at
//      https://www.cloudbees.com/blog/webrtc-issues-and-how-to-debug-them.

//      For realtime info on the browser's WebRTC connections, navigate to
//      chrome://webrtc-internals in Google Chrome.

/*jslint browser */

import hex from "../hex.js";
import parseq from "../parseq.js";

const ice_servers = [{
    urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302"
    ]
}];
const ice_time_limit = 10000;
const rx_sdp_fingerprint = /a=fingerprint:sha-256\u0020([0-9A-F:]+)/;

function sdp_to_name(sdp_string) {
    const matches = sdp_string.match(rx_sdp_fingerprint);
    if (matches) {
        return hex.decode(matches[1].replace(/:/g, ""));
    }
}

function identity_to_name(certificate) {
    return hex.decode(
        certificate.getFingerprints()[0].value.replace(/:/g, "")
    );
}

function generate_identity() {
    return function generate_identity_requestor(callback) {
        window.RTCPeerConnection.generateCertificate({
            name: "ECDSA",
            namedCurve: "P-256",
            expires: 31536000000 // one year is the maximum
        }).then(
            callback
        ).catch(function (reason) {
            callback(undefined, reason);
        });
    };
}

function trace(peer, debug) {
    debug("tracing");
    peer.onsignalingstatechange = function () {
        debug("signalingstatechange", peer.signalingState);
    };
    peer.onnegotiationneeded = function () {
        debug("negotiationneeded");
    };
    peer.oniceconnectionstatechange = function () {
        debug("iceconnectionstatechange", peer.iceConnectionState);
    };
    peer.onicecandidateerror = function (event) {
        debug("icecandidateerror", event.hostCandidate);
    };
    peer.onicegatheringstatechange = function () {
        debug("icegatheringstatechange", peer.iceGatheringState);
    };
}

function webrtc_transport(signaller_requestor, log) {

// TODO pool signallers with the same name & address, to avoid excessive message
// duplication.

    function connect(identity, name, address, on_receive, on_close) {
        return function connect_requestor(callback) {
            const session_id = crypto.randomUUID();

            let signaller;          // The connection to the signalling server.
            let peer;               // The RTCPeerConnection object.
            let channel;            // The RTCDataChannel object.
            let channel_error;      // The channel's RTCError object, if any.
            let remote_sdp;         // The remote peer's SDP string.

            function debug(...args) {
                if (log !== undefined) {
                    log(session_id.slice(0, 4), "CONN", ...args);
                }
            }

            function destroy() {
                debug("destroy");
                on_receive = undefined;
                on_close = undefined;
                if (peer !== undefined) {
                    peer.close();
                }
                if (signaller !== undefined) {
                    signaller.close();
                }
            }

            function resolve(value, reason) {
                if (callback !== undefined) {
                    callback(value, reason);
                    callback = undefined;
                }
            }

            function fail(reason) {
                debug("fail", reason);
                destroy();
                resolve(undefined, reason);
            }

            const connection = Object.freeze({
                send(frame) {
                    channel.send(frame);
                },
                name() {
                    return sdp_to_name(remote_sdp);
                },
                close: destroy
            });

            function on_signaller_receive(ignore, message) {
                if (message.session_id !== session_id) {
                    return; // not for us
                }
                if (message.kind === "answer") {
                    if (peer.remoteDescription) {
                        return debug("duplicate answer", message);
                    }

// The certificate fingerprint in the SDP answer is the remote party's name. It
// will be used to negotiate a secure connection, so we verify it is correct.
// If the name is missing, or does not match the expected name, fail.

                    const sdp_name = sdp_to_name(message.answer.sdp);
                    if (sdp_name === undefined) {
                        return fail("Missing name.");
                    }
                    if (hex.encode(name) !== hex.encode(sdp_name)) {
                        return fail("Wrong name.");
                    }
                    remote_sdp = message.answer.sdp;

// Accept the answer.

                    peer.setRemoteDescription(message.answer).catch(fail);

// The ICE candidates should now be flowing in both directions. With any luck a
// direct peer-to-peer connection will soon be established.

                } else if (message.kind === "ice_candidate") {
                    if (peer.signalingState !== "closed") {
                        debug("addIceCandidate");
                        peer.addIceCandidate(message.candidate);
                    }
                }
            }

            function signaller_callback(the_signaller, reason) {
                if (the_signaller === undefined) {
                    return fail(reason);
                }
                signaller = the_signaller;

// Now that we are connected to the signalling server we can initiate a WebRTC
// connection.

                peer = new window.RTCPeerConnection({
                    certificates: [identity],
                    iceServers: ice_servers
                });
                peer.onicecandidate = function (event) {
                    debug("icecandidate");
                    signaller.send(name, {
                        kind: "ice_candidate",
                        session_id,
                        candidate: (
                            event.candidate
                            ? event.candidate.toJSON()
                            : {} // end-of-candidates indicator
                        )
                    });
                };
                peer.onconnectionstatechange = function () {
                    debug("connectionState", peer.connectionState);
                    if (peer.connectionState === "failed") {
                        fail("Connection failed.");
                    }
                };
                trace(peer, debug);

// A single data channel carries our binary frames. A transport is not required
// to reliably deliver frames, or deliver them in order.

                channel = peer.createDataChannel("", {
                    ordered: false,     // unordered
                    maxRetransmits: 0   // unreliable
                });
                channel.onopen = function () {
                    resolve(connection);
                };
                channel.onmessage = function (event) {
                    on_receive(connection, new Uint8Array(event.data));
                };
                channel.onerror = function (event) {
                    if (event.error.sctpCauseCode !== 12) {
                        channel_error = event.error;
                    }
                };
                channel.onclose = function () {
                    debug("channel onclose", channel_error);
                    if (on_close !== undefined) {
                        on_close(connection, channel_error);
                    }
                    destroy();
                };

// Send an SDP offer to the remote party.

                peer.createOffer().then(function (offer) {
                    signaller.send(name, {
                        kind: "offer",
                        session_id,
                        offer: offer.toJSON()
                    });
                    return peer.setLocalDescription(offer);
                }).catch(fail);
            }

            try {
                const cancel_signaller = signaller_requestor(
                    signaller_callback,
                    {
                        name: identity_to_name(identity),
                        address,
                        on_receive: on_signaller_receive
                    }
                );
                return function cancel() {
                    debug("cancel");
                    callback = undefined;
                    if (signaller === undefined) {
                        cancel_signaller();
                    } else {
                        destroy();
                    }
                };
            } catch (exception) {
                return callback(undefined, exception);
            }
        };
    }

    function listen(identity, bind_info, on_open, on_receive, on_close) {
        return function listen_requestor(callback) {
            let signaller;
            let peers = Object.create(null);
            let manually_closed = new WeakMap();

            function destroy(key) {
                const peer = peers[key];
                if (peer !== undefined) {
                    peer.close();
                    delete peers[key];
                }
            }

            function on_signaller_receive(from, message) {
                const key = hex.encode(from) + ":" + message.session_id;
                let peer = peers[key];
                let channel;
                let channel_error;
                let connection;

                function debug(...args) {
                    if (log !== undefined) {
                        log(message.session_id.slice(0, 4), "LIST", ...args);
                    }
                }

                if (message.kind === "offer") {
                    if (peer !== undefined) {
                        return;
                    }

// Make a new connection expecting a single data channel.

                    peer = new window.RTCPeerConnection({
                        certificates: [identity],
                        iceServers: ice_servers
                    });
                    peers[key] = peer;
                    peer.onconnectionstatechange = function () {
                        debug("connectionState", peer.connectionState);
                        if (peer.connectionState === "failed") {
                            destroy(key);
                        }
                    };
                    peer.ondatachannel = function (event) {
                        if (channel !== undefined) {
                            debug("unexpected channel");
                            return event.channel.close();
                        }
                        event.channel.onopen = function () {
                            const remote_sdp = peer.remoteDescription.sdp;
                            connection = Object.freeze({
                                send(frame) {
                                    channel.send(frame);
                                },
                                name() {
                                    return sdp_to_name(remote_sdp);
                                },
                                close() {
                                    manually_closed.set(peer);
                                    destroy(key);
                                }
                            });
                            on_open(connection);
                        };
                        event.channel.onmessage = function (event) {
                            on_receive(connection, new Uint8Array(event.data));
                        };
                        event.channel.onerror = function (event) {

// SCTP error #12 means that the connection was aborted by the remote end, which
// is not an error.

                            if (event.error.sctpCauseCode !== 12) {
                                channel_error = event.error;
                            }
                        };
                        event.channel.onclose = function () {
                            debug("channel onclose", channel_error);
                            destroy(key);
                            if (!manually_closed.has(peer)) {
                                on_close(connection, channel_error);
                            }
                        };
                        channel = event.channel;
                    };
                    peer.onicecandidate = function (event) {
                        debug("icecandidate");
                        signaller.send(from, {
                            kind: "ice_candidate",
                            session_id: message.session_id,
                            candidate: (
                                event.candidate
                                ? event.candidate.toJSON()
                                : {} // end-of-candidates indicator
                            )
                        });
                    };
                    trace(peer, debug);

// Answer the offer.

                    peer.setRemoteDescription(
                        message.offer
                    ).then(function () {
                        return peer.createAnswer();
                    }).then(function (answer) {
                        signaller.send(from, {
                            kind: "answer",
                            session_id: message.session_id,
                            answer: answer.toJSON()
                        });
                        return peer.setLocalDescription(answer);
                    }).catch(function (reason) {
                        debug("failed to answer", reason);
                        destroy(key);
                    });

// Drop the peer if no ICE candidates are received in a reasonable amount of
// time.

                    setTimeout(function () {
                        if (peer.connectionState === "new") {
                            debug("ICE timed out.");
                            destroy(key);
                        }
                    }, ice_time_limit);
                } else if (message.kind === "ice_candidate") {
                    if (
                        peer !== undefined
                        && peer.signalingState !== "closed"
                    ) {
                        debug("addIceCandidate");
                        peer.addIceCandidate(message.candidate);
                    }
                }
            }

            function stop() {

// Close every RTCPeerConnection, suppressing the 'on_close' callback.

                Object.entries(peers).forEach(function ([key, peer]) {
                    manually_closed.set(peer);
                    destroy(key);
                });

// Close the connection to the signalling server.

                signaller.close();
            }

            try {
                const signaller_spec = {
                    name: identity_to_name(identity),
                    address: bind_info,
                    on_receive: on_signaller_receive
                };
                return parseq.sequence([
                    signaller_requestor,
                    function (callback, the_signaller) {
                        signaller = the_signaller;
                        callback(stop);
                    }
                ])(callback, signaller_spec);
            } catch (exception) {
                return callback(undefined, exception);
            }
        };
    }

    return Object.freeze({
        connect,
        listen,
        generate_identity,
        identity_to_name
    });
}

//debug import merge from "../requestors/merge.js";
//debug import lazy from "../requestors/lazy.js";
//debug import requestorize from "../requestors/requestorize.js";
//debug import signaller from "./dummy_signaller.js";
//debug //import signaller from "./websockets_signaller.js";
//debug function halve(buffer) {
//debug     return new Uint8Array(buffer).slice(
//debug         0,
//debug         Math.floor(buffer.length / 2)
//debug     );
//debug }
//debug const signalling_url = "ws://127.0.0.1:4455";
//debug const transport = webrtc_transport(signaller(), console.log);
//debug const flake = 0;
//debug const cancel = parseq.sequence([
//debug     parseq.parallel_object({
//debug         alice_identity: generate_identity(),
//debug         bob_identity: generate_identity()
//debug     }),
//debug     merge({
//debug         bob_stop: lazy(function ({bob_identity}) {
//debug             return transport.listen(
//debug                 bob_identity,
//debug                 signalling_url,
//debug                 function on_open(connection) {
//debug                     console.log(
//debug                         "bob on_open",
//debug                         hex.encode(connection.name())
//debug                     );
//debug                 },
//debug                 function on_receive(connection, frame_buffer) {
//debug                     console.log("bob on_receive", frame_buffer.length);
//debug                     if (frame_buffer.length > 0) {
//debug                         connection.send(halve(frame_buffer));
//debug                     } else {
//debug                         connection.close();
//debug                     }
//debug                 },
//debug                 function on_close(ignore, reason) {
//debug                     console.log("bob on_close", reason);
//debug                 }
//debug             );
//debug         })
//debug     }),
//debug     lazy(function ({alice_identity, bob_identity, bob_stop}) {
//debug         console.log("bob listening");
//debug         return transport.connect(
//debug             alice_identity,
//debug             identity_to_name(bob_identity),
//debug             signalling_url,
//debug             function on_receive(connection, frame_buffer) {
//debug                 console.log("alice on_receive", frame_buffer.length);
//debug                 if (frame_buffer.length > 0) {
//debug                     connection.send(halve(frame_buffer));
//debug                 } else {
//debug                     connection.close();
//debug                 }
//debug                 if (Math.random() < flake) {
//debug                     console.log("bob stop");
//debug                     bob_stop();
//debug                 }
//debug             },
//debug             function on_close(ignore, reason) {
//debug                 console.log("alice on_close", reason);
//debug             }
//debug         );
//debug     }),
//debug     requestorize(function (connection) {
//debug         console.log("alice on_open", hex.encode(connection.name()));
//debug         connection.send(new TextEncoder().encode("I have a bike"));
//debug         return true;
//debug     })
//debug ])(console.log);
//debug if (Math.random() < flake) {
//debug     console.log("cancel");
//debug     cancel();
//debug }

export default Object.freeze(webrtc_transport);
