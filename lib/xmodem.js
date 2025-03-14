// This module implements the XMODEM file transfer protocol.

/*jslint bitwise */

const SOH = 0x01;  // Start of Header
const ACK = 0x06;  // Acknowledge
const NAK = 0x15;  // Negative Ack
const EOT = 0x04;  // End of Transmission
const CAN = 0x18;  // Cancel

function send(callback, byte_at, input, output) {

// Send a "file" using the XMODEM protocol.
//      `callback(value)` is called, possibly in a future turn,
//      where `value` is the `Number` of 128-byte packets sent,
//      or `undefined` if the transfer failed.

// `byte_at(ofs)` returns the byte at `ofs` in the file, or `undefined`.

// `input(callback, timeout)` requests the next byte input.
//      `callback(value)` is called, possibly in a future turn,
//      where `value` is the next byte as a `Number`,
//      or `undefined` after `timeout` milliseconds.

// `output(callback, buffer)` sends bytes to the output stream.
//      `callback(value)` is called, possibly in a future turn,
//      where `value` is the `Number` of bytes transferred,
//      or `undefined` if there was a problem sending.

    let retry;              // number of retries remaining
    let pkt;                // current packet number
    let ofs;                // byte offset into file

    function end_transmission_cb(value) {
        if (value === undefined) {
            return callback(undefined);
        }
        return callback(pkt - 1);  // SUCCESS!
    }

    const pkt_buf = new Uint8Array(3 + 128 + 1);  // buffer for data packets

    function fill_pkt_buf() {

// Packet header.

        pkt_buf[0] = SOH;
        pkt_buf[1] = (pkt & 0xFF);
        pkt_buf[2] = (~pkt & 0xFF);

// 128-byte packet payload.

        let chk = 0;  // cumulative checksum
        let n = 0;  // number of payload bytes
        while (n < 128) {
            const b = (byte_at(ofs + n) ?? 0) & 0xFF;
            chk += b;
            pkt_buf[3 + n] = b;
            n += 1;
        }

// Checksum.

        pkt_buf[3 + 128] = (chk & 0xFF);

        return pkt_buf;
    }

    function end_of_input() {
        // FIXME: when `byte_at` is replaced by a buffer, check against `length`
        return (byte_at(ofs) === undefined);
    }

    const eot_pkt = new Uint8Array([EOT]);  // single byte packet for EOT

    let packet_sent_cb;  // FORWARD DECLARATION TO AVOID CIRCULAR DEPENDENCY

    function wait_for_ack_cb(value) {

        if (value === CAN) {

// Transfer cancelled by recevier.

            return callback(undefined);  // FAIL! (0 packets sent)
        }

        if (value === ACK) {

// Advance to next packet.

            ofs += 128;
            pkt += 1;
            retry = 10;
            if (end_of_input()) {
                return output(end_transmission_cb, eot_pkt);
            }
            fill_pkt_buf();

        } else {

// Retry, or fail after 10 retransmissions.

            if (retry > 0) {
                retry -= 1;
            } else {
                return callback(undefined);  // FAIL! (0 packets sent)
            }
        }

        return output(packet_sent_cb, pkt_buf);
    }

    packet_sent_cb = function packet_sent_cb(value) {
        if (value === undefined) {
            return callback(undefined);
        }
        input(wait_for_ack_cb, 5000);
    };

    function wait_for_nak_cb(value) {

        if (value === NAK) {

// Initial NAK starts the file transfer.

            pkt = 0;
            ofs = -128;
            return wait_for_ack_cb(ACK);
        }

        if (value === undefined) {

// Timeout. Countdown retries until failure.

            if (retry > 0) {
                retry -= 1;
            } else {
                return callback(undefined);  // FAIL! (0 packets sent)
            }
        }

        input(wait_for_nak_cb, 5000);
    }

    function flush_input_cb(value) {

// Flush input buffer.

        if (value === undefined) {
            retry = 10;
            input(wait_for_nak_cb, 10000);
        } else {
            input(flush_input_cb, 250);
        }
    }

// Start asynchronous file transfer

    input(flush_input_cb, 250);

}

function receive() {
    // FIXME: implement receive
    return undefined;
}

export default Object.freeze({send, receive});
