// The 'hexdump' function returns a string representation of a Uint8Array.

// For example:

//  0000:  06 10 82 38  01 81 07 10  82 32 01 84  0b 84 6b 69  ···8·····2····ki
//  0130:  09 08 09 14  09 0a 0a 85  48 65 6c 6c  6f           ········Hello

/*jslint bitwise */

function hexdump(uint8array, ofs, len, xlt) {
    ofs = ofs ?? 0;
    len = len ?? uint8array.length;
    xlt = xlt ?? function (code) {
        // translate control codes to center-dot
        if ((code < 0x20) || ((0x7F <= code) && (code < 0xA0))) {
            return 0xB7;  //  "·"
        }
        return code;
    };
    let out = "";
    while (ofs < len) {
        let str = "";
        out += ofs.toString(16).padStart(4, "0") + ":";
        let cnt = 0;
        while (cnt < 16) {
            out += (
                (cnt & 0x3) === 0
                ? "  "
                : " "
            );
            const idx = ofs + cnt;
            if (idx < len) {
                const code = uint8array[idx];
                out += code.toString(16).padStart(2, "0");
                str += String.fromCodePoint(xlt(code));
            } else {
                out += "  ";
                str += " ";
            }
            cnt += 1;
        }
        out += "  " + str + "\n";
        ofs += 16;
    }
    return out;
}

export default Object.freeze(hexdump);
