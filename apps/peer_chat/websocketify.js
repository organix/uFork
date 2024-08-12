// A minimal WebSocket server implementation for Node.js.

/*jslint bitwise */

import {Buffer} from "node:buffer";
import crypto from "node:crypto";

function make_frame(opcode, payload) {

// The 'make_frame' function takes an integer 'opcode' and a 'payload' Buffer,
// and returns a Buffer containing a single WebSocket frame.

// We set the "fin" bit to true, meaning that this is the only frame in the
// message.

    const zeroth_byte = Buffer.from([0b10000000 | opcode]);

// The payload length field expands as required.

    let length_bytes;
    if (payload.length < 126) {
        length_bytes = Buffer.from([payload.length]);
    } else if (payload.length < 2 ** 16) {
        length_bytes = Buffer.alloc(3);
        length_bytes.writeInt8(126, 0);
        length_bytes.writeUInt16BE(payload.length, 1);
    } else {
        length_bytes = Buffer.alloc(9);
        length_bytes.writeInt8(127, 0);

// The specification allows for an exabyte of payload, which seems excessive for
// a browser-based messaging protocol. This implementation produces a
// well-formed length field for payloads up to 9 petabytes, which ought to be
// enough for anybody.

        length_bytes.writeUInt32BE(Math.floor(payload.length / (2 ** 32)), 1);
        length_bytes.writeUInt32BE(payload.length % (2 ** 32), 5);
    }
    return Buffer.concat([zeroth_byte, length_bytes, payload]);
}

function websocketify(
    server,
    on_open,
    on_receive,
    on_close
) {

// The 'websocketify' function empowers an HTTP server to send and receive
// WebSocket messages. The following callbacks must be provided:

//  on_open(connection, req)
//      Called when a new connection is opened.

//  on_receive(connection, message)
//      Called with each incoming message. The 'message' parameter will be a
//      string or a Buffer, depending on the message type.

//  on_close(connection, reason)
//      Called when an existing connection is closed. A reason might be
//      provided.

// Each callback takes a 'connection' parameter, which is a frozen object
// unique to a particular connection. It contains the following methods:

//  send(message)
//      Sends a message. It should be a string or a Buffer.

//  close(reason)
//      Closes the connection. The 'reason' parameter will be passed to the
//      on_close callback.

    let sockets = Object.create(null);
    let next_socket_id = 0;
    server.on("upgrade", function (req, socket) {

// Assign a unique ID to the socket.

        const socket_id = next_socket_id;
        sockets[socket_id] = socket;
        next_socket_id += 1;

// Create a public interface for the socket.

        const connection = Object.freeze({
            send(payload) {
                socket.write(
                    typeof payload === "string"
                    ? make_frame(0x1, Buffer.from(payload))
                    : make_frame(0x2, payload)
                );
            },
            close() {
                socket.destroy();
            }
        });

// The WebSocket protocol requires that we compute the hash of a nonce provided
// by the request. This is stupid, why can't we just use the value of the nonce
// directly?

        const sha1 = crypto.createHash("sha1");
        const stupid_protocol_key = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        sha1.update(req.headers["sec-websocket-key"] + stupid_protocol_key);
        socket.write([
            "HTTP/1.1 101 Web Socket Protocol Handshake",
            "Upgrade: WebSocket",
            "Connection: Upgrade",
            "Sec-WebSocket-Accept: " + sha1.digest("base64"),
            "\r\n"
        ].join("\r\n"));

// The 'buffer' variable holds the bytes that have arrived over the wire, but
// have not yet been consumed. The 'payload_fragment' variable contains the
// accumulated bytes of a message that has been split into multiple frames. The
// 'textual' variable is true if 'payload_fragment' is to be interpreted as
// text.

        let buffer = Buffer.alloc(0);
        let payload_fragment;
        let textual;

        function consume_buffer() {

// The 'consume_buffer' function attempts to tease WebSocket frames out of the
// buffer, and WebSocket messages out of frames.

// This is the binary format of a frame:

//  0                   1                   2                   3
//  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
// +-+-+-+-+-------+-+-------------+-------------------------------+
// |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
// |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
// |N|V|V|V|       |S|             |   (if payload len==126/127)   |
// | |1|2|3|       |K|             |                               |
// +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
// |     Extended payload length continued, if payload len == 127  |
// + - - - - - - - - - - - - - - - +-------------------------------+
// |                               |Masking-key, if MASK set to 1  |
// +-------------------------------+-------------------------------+
// | Masking-key (continued)       |          Payload Data         |
// +-------------------------------- - - - - - - - - - - - - - - - +
// :                     Payload Data continued ...                :
// + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
// |                     Payload Data continued ...                |
// +---------------------------------------------------------------+

// The integers are big-endian, meaning that the most significant byte arrives
// first. The full WebSockets specification can be found at
// https://datatracker.ietf.org/doc/html/rfc6455.

            if (buffer.length < 2) {
                return;
            }
            const fin = Boolean(buffer[0] >> 7);
            const opcode = buffer[0] & 0b1111;

// Read the payload length field, which can vary in size.

            let payload_length = buffer[1] & 0b01111111;
            let mask_start = 2;
            if (payload_length === 126) {
                mask_start += 2;
                if (buffer.length < mask_start) {
                    return;
                }
                payload_length = buffer.readUInt16BE(2);
            } else if (payload_length > 126) {
                mask_start += 8;
                if (buffer.length < mask_start) {
                    return;
                }
                payload_length = Number(buffer.readBigUInt64BE(2));
            }

// Proceed only if the buffer contains the entire frame. If it does not, we wait
// for more bytes.

            const mask_length = 4;
            if (buffer.length - mask_start < mask_length + payload_length) {
                return;
            }

// Consume the payload length.

            buffer = buffer.slice(mask_start);

// Read and consume the mask. Messages from the client are always masked,
// whereas messages from the server are never masked.

            const mask = buffer.slice(0, mask_length);
            buffer = buffer.slice(mask_length);

// Read and consume the payload.

            const payload = buffer.slice(0, payload_length).map(
                function unmask(byte, byte_nr) {
                    return byte ^ mask[byte_nr % 4];
                }
            );
            buffer = buffer.slice(payload_length);

// The opcode has 16 possible values:
//  0x0 denotes a continuation frame
//  0x1 denotes a text frame
//  0x2 denotes a binary frame
//  0x3-7 are reserved for further non-control frames
//  0x8 denotes a connection close
//  0x9 denotes a ping
//  0xA denotes a pong
//  0xB-F are reserved for further control frames

            if (opcode === 0x1 || opcode === 0x2) {
                textual = (opcode === 0x1);
                if (fin) {
                    on_receive(
                        connection,
                        (
                            textual
                            ? payload.toString()
                            : payload
                        )
                    );
                } else {
                    payload_fragment = payload;
                }
            } else if (opcode === 0x0) {
                payload_fragment = Buffer.concat([payload_fragment, payload]);
                if (fin) {
                    on_receive(
                        connection,
                        (
                            textual
                            ? payload_fragment.toString()
                            : payload_fragment
                        )
                    );
                }
            } else if (opcode === 0x9) {

// Reply to a ping with a pong. The pong must contain the same payload as the
// ping that triggered it.

                socket.write(make_frame(0xA, payload));
            } else {

// Any other opcode closes the connection. This includes the "close" opcode.

                socket.destroy();
            }

// Consume any frames left in the buffer.

            return consume_buffer();
        }

        socket.on("data", function (chunk) {
            buffer = Buffer.concat([buffer, chunk]);
            return consume_buffer();
        });

// The "close" event always follows an "error" event.

        let close_reason;
        socket.on("error", function (error) {
            close_reason = error;
        });
        socket.on("close", function () {
            delete sockets[socket_id];
            on_close(connection, close_reason);
        });
        return on_open(connection, req);
    });
}

export default Object.freeze(websocketify);
