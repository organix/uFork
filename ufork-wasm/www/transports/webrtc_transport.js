// A WebRTC-based AWP transport for the browser.

// The 'webrtc_transport' function takes a signaller and an optional logging
// function that is called with detailed debugging info.

// Types

//      name
//          The SHA-256 fingerprint of an RTCCertificate as a 32-byte
//          Uint8Array.

//      address
//          The URL of a signalling server's "connect" endpoint, as a string.

//      bind_info
//          The URL of a signalling server's "listen" endpoint (including any
//          credentials) as a string.

//      identity
//          An object like {certificate, name} where the certificate is an
//          RTCCertificate object associated with a P-256 ECDSA keypair.

// Signalling

//      WebRTC connections are truly peer-to-peer, but in order to defeat NAT
//      they must be preceeded by an out-of-band handshake. This is usually
//      accomplished using a signalling server, but any out-of-band
//      communication channel can be used.

//      The 'webrtc_transport' function is passed a 'signaller' object,
//      responsible for exchanging signals with other parties. It contains two
//      requestor factories, "connect" and "listen". A signal is either an SDP
//      offer, an SDP answer, or an ICE candidate.

//      signaller.connect(name, address, on_receive) -> requestor

//          The 'connect' requestor factory takes the following parameters:

//              name
//                  The listening party's name.

//              address
//                  The listening party's signalling address.

//              on_receive(signal)
//                  Called with each signalling message received from the
//                  listening party, either an SDP answer or an ICE candidate.

//          The returned requestor takes an SDP offer (an RTCSessionDescription
//          object) and produces an object with the following methods:

//              send(candidate)
//                  Sends an RTCIceCandidate object to the listening party.

//              stop()
//                  Stop signalling immediately.

//      signaller.listen(name, bind_info, on_receive, on_fail) -> requestor

//          The 'listen' requestor factory takes the following parameters:

//              name
//                  The listening party's name.

//              bind_info
//                  The listening party's "bind_info", most likely used to
//                  locate and authenticate with a signalling server.

//              on_receive(session_id, signal)
//                  Called with each message received from a connecting party,
//                  either an SDP offer or an ICE candidate. The 'session_id'
//                  parameter securely identifies the WebRTC connection under
//                  negotiation.

//              on_fail(reason)
//                  Called if listening stops unexpectedly.

//          The returned requestor produces an object with these methods:

//              send(session_id, signal)
//                  Sends an SDP answer (RTCSessionDescription) or an ICE
//                  candidate (RTCIceCandidate) to the connecting party.

//              stop()
//                  Stop listening immediately.

// Debugging

//      WebRTC is tricky to get right. A lot can go wrong in establishing
//      peer-to-peer connections, and the browser's WebRTC interface is
//      pretty gnarly.

//      There is a comprehensive guide to debugging WebRTC connections at
//      https://www.cloudbees.com/blog/webrtc-issues-and-how-to-debug-them.

//      For realtime info on the browser's WebRTC connections, navigate to
//      chrome://webrtc-internals in Google Chrome.

/*jslint browser */

import hex from "../hex.js";
import parseq from "../parseq.js";
import requestorize from "../requestors/requestorize.js";
import unpromise from "../requestors/unpromise.js";
import thru from "../requestors/thru.js";
import merge from "../requestors/merge.js";

const ice_servers = [{
    urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302"
        // "stun:stun2.l.google.com:19302",
        // "stun:stun3.l.google.com:19302",
        // "stun:stun4.l.google.com:19302",
        // "stun:stun.hide.me:3478",
        // "stun:stun.wtfismyip.com:3478",
        // "stun:stun.gmx.net:3478",
        // "stun:stun.gmx.de:3478"
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

function identity_to_name(identity) {
    return identity.name;

// This is the ideal code (and an identity should just be an RTCCertificate)
// but 'getFingerprints' is not yet supported by Firefox.

    // return hex.decode(
    //     identify.certificate.getFingerprints()[0].value.replace(/:/g, "")
    // );
}

function generate_certificate() {
    return unpromise(function () {
        return window.RTCPeerConnection.generateCertificate({
            name: "ECDSA",
            namedCurve: "P-256",
            expires: 31536000000 // one year is the maximum
        });
    });
}

function get_fingerprints() {

// Most browsers are able to get the fingerprint from the certificate using its
// 'getFingerprints' method. Unfortunately, this method is not implemented in
// Firefox yet, so instead we create a dummy offer and inspect the SDP string.

    return parseq.sequence([
        unpromise(function (certificate) {
            const peer = new window.RTCPeerConnection(
                {certificates: [certificate]}
            );
            peer.createDataChannel("");
            return peer.createOffer();
        }),
        requestorize(function (offer) {
            return sdp_to_name(offer.sdp);
        })
    ]);
}

function generate_identity() {
    return parseq.sequence([
        generate_certificate(),
        merge({
            name: get_fingerprints(),
            certificate: thru()
        })
    ]);
}

function create_offer(peer) {
    return unpromise(function () {
        return peer.createOffer().then(function (offer) {
            return peer.setLocalDescription(offer);
        }).then(function () {
            return peer.localDescription;
        });
    });
}

function trace_peer_events(peer, debug) {
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

function webrtc_transport(signaller, log) {

    function connect(identity, name, address, on_receive, on_close) {

        function debug(...args) {
            if (log !== undefined) {
                log("CONN", ...args);
            }
        }

        return function connect_requestor(callback) {
            let peer;               // The RTCPeerConnection object.
            let remote_sdp;         // The remote peer's SDP string.
            let signal_connector;   // The signaller connector object.
            let channel_error;      // The channel's RTCError object.
            let candidates = [];    // An array of undelivered ICE candidates.

            function destroy() {
                debug("destroy");
                on_receive = undefined;
                on_close = undefined;
                if (peer !== undefined) {
                    peer.close();
                }
                if (signal_connector !== undefined) {
                    signal_connector.stop();
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

            function on_receive_signal(signal) {
                if (signal?.type === "answer") {
                    if (peer.remoteDescription) {
                        return debug("duplicate answer", signal);
                    }

// Accept the answer.

                    peer.setRemoteDescription(signal).then(function () {

// The certificate fingerprint in the SDP answer is the remote party's name. It
// will be used to negotiate a secure peer-to-peer connection, so we verify it.
// If the name is missing or incorrect, fail.

                        remote_sdp = peer.remoteDescription.sdp;
                        const sdp_name = sdp_to_name(remote_sdp);
                        if (
                            sdp_name === undefined
                            || hex.encode(name) !== hex.encode(sdp_name)
                        ) {
                            return fail("Unexpected name.");
                        }
                    }).catch(
                        fail
                    );
                } else if (typeof signal?.candidate === "string") {
                    debug("addIceCandidate");
                    peer.addIceCandidate(signal).catch(function (reason) {
                        debug("Failed to add ICE candidate", reason);
                    });
                }
            }

            try {
                peer = new window.RTCPeerConnection({
                    certificates: [identity.certificate],
                    iceServers: ice_servers
                });

// Send any ICE candidates thru the signaller. We discard the end-of-candidates
// indicator because it seems unnecessary and has atrocious cross-browser
// support.

                peer.onicecandidate = function (event) {
                    debug("icecandidate", event.candidate?.candidate);
                    if (event.candidate) {
                        if (signal_connector !== undefined) {
                            signal_connector.send(event.candidate);
                        } else {
                            candidates.push(event.candidate);
                        }
                    }
                };
                peer.onconnectionstatechange = function () {
                    debug("connectionState", peer.connectionState);
                    if (peer.connectionState === "failed") {
                        fail("Connection failed.");
                    }
                };
                trace_peer_events(peer, debug);

// A single data channel carries our binary frames. A transport is not required
// to reliably deliver frames, or deliver them in order.

                const channel = peer.createDataChannel("", {
                    ordered: false,     // unordered
                    maxRetransmits: 0   // unreliable
                });
                channel.binaryType = "arraybuffer"; // not Blob
                const connection = Object.freeze({
                    send(frame) {
                        channel.send(frame);
                    },
                    name() {
                        return sdp_to_name(remote_sdp);
                    },
                    close: destroy
                });
                channel.onopen = function () {
                    resolve(connection);

// A peer-to-peer connection has been successfully established, so we can
// disconnect from the signaller.

                    signal_connector.stop();
                    signal_connector = undefined;
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

// Send an SDP offer to the remote party, via the signaller.

                const cancel_signalling = parseq.sequence([
                    create_offer(peer),
                    signaller.connect(name, address, on_receive_signal)
                ])(function (value, reason) {
                    if (value === undefined) {
                        return fail(reason);
                    }
                    signal_connector = value;

// Send thru any backed up ICE candidates.

                    candidates.forEach(signal_connector.send);
                    candidates = [];
                });
                return function cancel() {
                    debug("cancel");
                    if (callback !== undefined) {
                        callback = undefined;
                        if (signal_connector === undefined) {
                            cancel_signalling();
                        } else {
                            destroy();
                        }
                    }
                };
            } catch (exception) {
                return callback(undefined, exception);
            }
        };
    }

    function listen(identity, bind_info, on_open, on_receive, on_close) {

        function debug(...args) {
            if (log !== undefined) {
                log("LIST", ...args);
            }
        }

        return function listen_requestor(callback) {
            let signal_listener;
            let peers = Object.create(null);
            let manually_closed = new WeakMap();

            function destroy(session_id) {
                const peer = peers[session_id];
                if (peer !== undefined) {
                    peer.close();
                    delete peers[session_id];
                }
            }

            function on_receive_signal(session_id, signal) {
                let peer = peers[session_id];
                let channel;
                let channel_error;

                function debug_session(...args) {
                    return debug(session_id.slice(0, 4), ...args);
                }

                if (signal?.type === "offer") {
                    if (peer !== undefined) {
                        return debug_session("Duplicate offer", signal);
                    }

// Make a new RTCPeerConnection object that expects a single data channel.

                    peer = new window.RTCPeerConnection({
                        certificates: [identity.certificate],
                        iceServers: ice_servers
                    });
                    peers[session_id] = peer;
                    peer.onconnectionstatechange = function () {
                        debug_session("connectionState", peer.connectionState);
                        if (peer.connectionState === "failed") {
                            destroy(session_id);
                        }
                    };
                    peer.ondatachannel = function (event) {
                        if (channel !== undefined) {
                            debug_session("Duplicate channel");
                            return event.channel.close();
                        }
                        const remote_sdp = peer.remoteDescription.sdp;
                        if (sdp_to_name(remote_sdp) === undefined) {
                            return destroy(session_id); // paranoid
                        }
                        channel = event.channel;
                        channel.binaryType = "arraybuffer"; // not Blob
                        const connection = Object.freeze({
                            send(frame) {
                                channel.send(frame);
                            },
                            name() {
                                return sdp_to_name(remote_sdp);
                            },
                            close() {
                                manually_closed.set(peer);
                                destroy(session_id);
                            }
                        });
                        event.channel.onopen = function () {
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
                            debug_session("channel onclose", channel_error);
                            destroy(session_id);
                            if (!manually_closed.has(peer)) {
                                on_close(connection, channel_error);
                            }
                        };
                    };
                    peer.onicecandidate = function (event) {
                        debug_session("icecandidate");
                        if (event.candidate) {
                            signal_listener.send(session_id, event.candidate);
                        }
                    };
                    trace_peer_events(peer, debug_session);

// Answer the offer.

                    peer.setRemoteDescription(signal).then(function () {
                        return peer.createAnswer();
                    }).then(function (answer) {
                        return peer.setLocalDescription(answer);
                    }).then(function () {
                        signal_listener.send(session_id, peer.localDescription);
                    }).catch(function (reason) {
                        debug_session("Failed to answer", reason);
                        destroy(session_id);
                    });

    // Drop the peer if no ICE candidates are received in a reasonable amount of
    // time.

                    return setTimeout(function () {
                        if (peer.connectionState === "new") {
                            debug_session("ICE timed out.");
                            destroy(session_id);
                        }
                    }, ice_time_limit);
                }
                if (
                    typeof signal?.candidate === "string"
                    && peers[session_id] !== undefined
                ) {
                    debug_session("addIceCandidate");
                    return peer.addIceCandidate(
                        signal
                    ).catch(function (reason) {
                        debug_session("Failed to add ICE candidate", reason);
                    });
                }
            }

            function stop() {

    // Close every RTCPeerConnection, suppressing the 'on_close' callback.

                Object.entries(peers).forEach(function ([session_id, peer]) {
                    manually_closed.set(peer);
                    destroy(session_id);
                });

    // Close the connection to the signalling server.

                signal_listener.stop();
            }

            function on_signal_listener_fail(reason) {
                log("LIST", "Signal listener failed", reason);
                // TODO auto reconnect?
            }

            try {
                return parseq.sequence([
                    signaller.listen(
                        identity_to_name(identity),
                        bind_info,
                        on_receive_signal,
                        on_signal_listener_fail
                    ),
                    requestorize(function (value) {
                        signal_listener = value;
                        return stop;
                    })
                ])(callback);
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

//debug import lazy from "../requestors/lazy.js";
//debug import signaller from "./dummy_signaller.js";
//debug // import signaller from "./websockets_signaller.js";
//debug function halve(buffer) {
//debug     return new Uint8Array(buffer).slice(
//debug         0,
//debug         Math.floor(buffer.length / 2)
//debug     );
//debug }
//debug const bind_info = {
//debug     origin: "ws://localhost:4455",
//debug     password: "uFork"
//debug };
//debug const address = "ws://localhost:4455";
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
//debug                 bind_info,
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
//debug             address,
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
//debug         connection.send(connection.name());
//debug         return true;
//debug     })
//debug ])(console.log);
//debug if (Math.random() < flake) {
//debug     console.log("cancel");
//debug     cancel();
//debug }

export default Object.freeze(webrtc_transport);
