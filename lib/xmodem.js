// This module implements the XMODEM file transfer protocol.

/*jslint bitwise */

const SOH = 0x01;  // Start of Header
const ACK = 0x06;  // Acknowledge
const NAK = 0x15;  // Negative Ack
const EOT = 0x04;  // End of Transmission
const CAN = 0x18;  // Cancel

function send(byte_at, input, output) {

// Send a "file" using the XMODEM protocol.
// Returns the number of 128-byte packets sent.

// `byte_at(ofs)` returns the byte at `ofs` in the file, or `undefined`.

// `input(timeout)` returns next byte input,
//      or `undefined` after `timeout` milliseconds.

// `output(byte)` sends `byte` to output.

    let retry = 10;

// Wait for initial NAK to start transfer.

    let b = input(10000);
    while (b !== NAK) {
        if (b === undefined) {
            if (retry > 0) {
                retry -= 1;
            } else {
                return 0;  // FAIL! (0 packets sent)
            }
        }
        b = input(5000);
    }

// Transfer file.

    retry = 10;
    let pkt = 1;
    let ofs = 0;
    while (byte_at(ofs) !== undefined) {

// Send packet header.

        output(SOH);
        output(pkt & 0xFF);
        output(~pkt & 0xFF);

// Send 128-byte packet.

        let chk = 0;
        let n = 0;
        while (n < 128) {
            b = byte_at(ofs + n) & 0xFF;
            chk += b;
            output(b);
            n += 1;
        }

// Send checksum.

        output(chk & 0xFF);
        b = input(5000);

        if (b === CAN) {

// Transfer cancelled by recevier.

            return 0;  // FAIL! (0 packets sent)
        }

        if (b === ACK) {

// Advance to next packet

            ofs += 128;
            pkt += 1;
            retry = 10;

        } else {

// Retry, or fail after 10 retransmissions.

            if (retry > 0) {
                retry -= 1;
            } else {
                return 0;  // FAIL! (0 packets sent)
            }
        }

    }

// End of transmission.

    output(EOT);
    return (pkt - 1);  // SUCCESS!
}

function receive() {
    // FIXME: implement receive
    return undefined;
}

export default Object.freeze({send, receive});
