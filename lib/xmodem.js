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
//      where `value` is the number of 128-byte packets sent,
//      or `undefined` if the transfer failed.

// `byte_at(ofs)` returns the byte at `ofs` in the file, or `undefined`.

// `input(callback, timeout)` requests the next byte input.
//      `callback(value)` is called, possibly in a future turn,
//      where `value` is the next bytes as a `Number`,
//      or `undefined` after `timeout` milliseconds.

// `output(byte)` sends `byte` to output.

    let retry;              // number of retries remaining
    let pkt;                // current packet number
    let ofs;                // byte offset into file

// Forward-declare the functions representing the state-machine
// to allow circular references.

    let flush_input_cb;
    let wait_for_nak_cb;
    let send_packet;
    let wait_for_ack_cb;

    flush_input_cb = function flush_input_cb(value) {

// Flush input buffer.

        if (value === undefined) {
            retry = 10;
            input(wait_for_nak_cb, 10000);
        } else {
            input(flush_input_cb, 250);
        }
    };

    wait_for_nak_cb = function wait_for_nak_cb(value) {

        if (value === NAK) {

// Initial NAK starts the file transfer.

            pkt = 1;
            ofs = 0;
            retry = 10;
            return send_packet();
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
    };

    send_packet = function send_packet() {

        if (byte_at(ofs) === undefined) {

// No more data to send. End transmission.

            output(EOT);
            return callback(pkt - 1);  // SUCCESS!
        }

// Send packet header.

        output(SOH);
        output(pkt & 0xFF);
        output(~pkt & 0xFF);

// Send 128-byte packet.

        let chk = 0;
        let n = 0;
        while (n < 128) {
            const b = byte_at(ofs + n) & 0xFF;
            chk += b;
            output(b);
            n += 1;
        }

// Send checksum.

        output(chk & 0xFF);

        input(wait_for_ack_cb, 5000);
    };

    wait_for_ack_cb = function wait_for_ack_cb(value) {

        if (value === CAN) {

// Transfer cancelled by recevier.

            return callback(undefined);  // FAIL! (0 packets sent)
        }

        if (value === ACK) {

// Advance to next packet.

            ofs += 128;
            pkt += 1;
            retry = 10;

        } else {

// Retry, or fail after 10 retransmissions.

            if (retry > 0) {
                retry -= 1;
            } else {
                return callback(undefined);  // FAIL! (0 packets sent)
            }
        }

        return send_packet();
    };

// Start asynchronous file transfer

    input(flush_input_cb, 250);

}

function receive() {
    // FIXME: implement receive
    return undefined;
}

export default Object.freeze({send, receive});
