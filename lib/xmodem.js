// This module implements the XMODEM file transfer protocol.

/*jslint bitwise */

const SOH = 0x01;  // Start of Header
const ACK = 0x06;  // Acknowledge
const NAK = 0x15;  // Negative Ack
const EOT = 0x04;  // End of Transmission
const CAN = 0x18;  // Cancel

function send(callback, file, input, output) {

// Send a "file" using the XMODEM protocol.
//      `callback(value)` is called, possibly in a future turn,
//      where `value` is the `Number` of 128-byte packets sent,
//      or `undefined` if the transfer failed.

// `file` is a `Uint8Array` representing the file contents.

// `input(callback, timeout)` requests the next byte input.
//      `callback(value)` is called, possibly in a future turn,
//      where `value` is the next byte as a `Number`,
//      or `undefined` after `timeout` milliseconds.

// `output(callback, buffer)` sends bytes to the output stream.
//      `callback(value)` is called, possibly in a future turn,
//      where `value` is the `Number` of bytes transferred,
//      or `undefined` if there was a problem sending.

    let ofs;                // byte offset into file
    let seq;                // current packet number
    let retry;              // number of retries remaining

    function end_transmission_cb(value) {
        if (value === undefined) {
            return callback(undefined);
        }
        return callback(seq - 1);  // SUCCESS!
    }

    const pkt_buf = new Uint8Array(3 + 128 + 1);  // buffer for data packets

    function fill_pkt_buf() {

// Packet header.

        pkt_buf[0] = SOH;
        pkt_buf[1] = (seq & 0xFF);
        pkt_buf[2] = (~seq & 0xFF);

// 128-byte packet payload.

        let chk = 0;  // cumulative checksum
        let n = 0;  // number of payload bytes
        while (n < 128) {
            const pos = ofs + n;
            const b = (
                pos < file.length
                ? file[pos]
                : 0
            );
            chk += b;
            pkt_buf[3 + n] = b;
            n += 1;
        }

// Checksum.

        pkt_buf[3 + 128] = (chk & 0xFF);

        return pkt_buf;
    }

    const eot_pkt = new Uint8Array([EOT]);  // single byte packet for EOT

    function wait_for_ack_cb(value) {

        function packet_sent_cb(value) {
            if (value === undefined) {
                return callback(undefined);
            }
            input(wait_for_ack_cb, 5000);
        }

        if (value === CAN) {

// Transfer cancelled by recevier.

            return callback(undefined);  // FAIL!
        }

        if (value === ACK) {

// Advance to next packet.

            ofs += 128;
            if (ofs >= file.length) {
                return output(end_transmission_cb, eot_pkt);
            }
            seq += 1;
            retry = 10;
            fill_pkt_buf();

        } else {

// Retry, or fail after 10 retransmissions.

            if (retry > 0) {
                retry -= 1;
            } else {
                return callback(undefined);  // FAIL!
            }
        }

        return output(packet_sent_cb, pkt_buf);
    }

    function wait_for_nak_cb(value) {

        if (value === NAK) {

// Initial NAK starts the file transfer.

            ofs = -128;
            seq = 0;
            return wait_for_ack_cb(ACK);
        }

        if (value === undefined) {

// Timeout. Countdown retries until failure.

            if (retry > 0) {
                retry -= 1;
            } else {
                return callback(undefined);  // FAIL!
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
