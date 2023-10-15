// The random device generates securely random fixnums.

// The signature of the message sent to the device controls the range:

//  (cust)
//      Use the entire fixnum range.

//  (cust size)
//      Pick a fixnum between 0 and 'size', inclusive. The 'size' may be
//      negative.

//  (cust a b)
//      Pick a fixnum between 'a' and 'b', inclusive. Either of 'a' or 'b' may
//      be the larger.

// The 'cust' is sent the random fixnum immediately.

/*jslint browser */

import ufork from "../ufork.js";

function random32(webcrypto, a, b) {
    const bytes = new Uint32Array(1);
    webcrypto.getRandomValues(bytes);
    const integer = bytes[0];
    if (a === undefined) {

// The maximum amount of randomness has been requested. We have generated a
// 32-bit unsigned integer, but one bit of randomness will be lost due to the
// fixnum type tag (DIR_RAW). The remaining bits encode a signed 31-bit fixnum
// (-2^30 thru 2^30-1).

        return integer;
    }
    if (b === undefined) {
        b = 0;
    }
    if (b > a) {
        [b, a] = [a, b];
    }
    return b + (integer % (a + 1 - b));
}

//debug random32(crypto, -3, 2);

function random_device(core, webcrypto = crypto) {
    const dev_ptr = core.u_ramptr(ufork.RANDOM_DEV_OFS);
    const dev_cap = core.u_ptr_to_cap(dev_ptr);
    const dev_id = core.u_read_quad(dev_ptr).x;
    core.h_install([[dev_id, dev_cap]], {
        host_random(a_raw, b_raw) {
            return core.u_fixnum(random32(
                webcrypto,
                (
                    core.u_is_fix(a_raw)
                    ? core.u_fix_to_i32(a_raw)
                    : undefined
                ),
                (
                    core.u_is_fix(b_raw)
                    ? core.u_fix_to_i32(b_raw)
                    : undefined
                )
            ));
        }
    });
}

export default Object.freeze(random_device);
