// Disassemble a single uCode machine word.

/*jslint bitwise */

function ucode_disasm(code, dictionary = {}) {
    if (code === 0x021F) {
        return "(LIT)";
    }
    if (code === 0x521F) {
        return "(CONST)";
    }
    let suffix = "";
    if ((code & 0xF000) === 0x5000) {
        code &= 0x0FFF;
        suffix = " EXIT";
    }
    const entry = Object.entries(dictionary).find(function ([ignore, value]) {
        return value === code;
    });
    if (entry !== undefined) {
        const name = entry[0];
        return name + suffix;
    }
    let text = "";
    if ((code & 0x8000) !== 0) {
        text += (
            (code & 0x4000) !== 0
            ? "call"
            : "jump"
        );
        if ((code & 0x3000) !== 0) {
            text += (
                (code & 0x2000) !== 0
                ? (
                    (code & 0x1000) !== 0
                    ? "_ifnz_dec"
                    : "_ifnz_inc"
                )
                : "_ifzero"
            );
        }
        const addr = code & 0xFFF;
        text += "(" + addr.toString(16).padStart(3, "0") + ")";
    }
    return text;
}

//debug ucode_disasm(0xA252);
//debug ucode_disasm(0x5100, {DROP: 0x0100});

export default Object.freeze(ucode_disasm);
