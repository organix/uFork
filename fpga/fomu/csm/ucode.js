// ucode.js -- uCode (Forth dialect) compiler
// Dale Schumacher
// 2024-04-10

const UC_LIT =              0x021F;                     // (LIT) item ( -- item )
const UC_CONST =            0x521F;                     // (CONST) item ( -- item ) R:( addr -- ) addr->pc
const UC_EXIT =             0x5000;                     // ( -- ) R:( addr -- ) addr->pc

const ADDR_MASK =           0x0FFF;                     // 12-bit uCode addresses

function error(...msg) {
//debug console.log("ERROR!", ...msg);
    return msg.join(" ");
}

function compile(text) {
    let pos = 0;  // input position within `text`
    function next_char() {
        const cp = text.codePointAt(pos);  // returns `undefined` if out-of-bounds
        if (typeof cp === "number") {
            pos += (cp <= 0xFFFF ? 1 : 2);
        }
        return cp;
    }
    function next_token() {
        let token = "";
        // skip whitespace
        let cp = next_char();
        while ((typeof cp === "number") && (cp <= 32)) {
            cp = next_char();
        }
        // collect non-whitespace
        while ((typeof cp === "number") && (cp > 32)) {
            token += String.fromCodePoint(cp);
            cp = next_char();
        }
        // return completed token
        return token;
    }

    const words = {
        "NOP":              0x0000,                     // ( -- )
        "DROP":             0x0100,                     // ( a -- )
        "DUP":              0x0200,                     // ( a -- a a )
        "SWAP":             0x0400,                     // ( a b -- b a )
        "OVER":             0x0240,                     // ( a b -- a b a )
        "ROT":              0x0500,                     // ( a b c -- b c a )
        "-ROT":             0x0600,                     // ( a b c -- c a b )
        "TRUE":             0x02F6,                     // ( -- -1 )
        "FALSE":            0x02C0,                     // ( -- 0 )
        "0":                0x02C0,                     // ( -- 0 )
        "1":                0x02D6,                     // ( -- 1 )
        "-1":               0x02F6,                     // ( -- -1 )
        "LSB":              0x02D6,                     // ( -- 1 )
        "MSB":              0x02E6,                     // ( -- -32768 )
        "INVERT":           0x0335,                     // ( a -- ~a )
        "NEGATE":           0x03C2,                     // ( a -- -a )
        "1+":               0x0311,                     // ( a -- a+1 )
        "1-":               0x0312,                     // ( a -- a-1 )
        "2*":               0x0301,                     // ( a -- a*2 )
        "2/":               0x030B,                     // ( a -- a/2 )
        "+":                0x0741,                     // ( a b -- a+b )
        "-":                0x0742,                     // ( a b -- a-b )
        "*":                0x0743,                     // ( a b -- a*b )
        "AND":              0x0744,                     // ( a b -- a&b )
        "XOR":              0x0745,                     // ( a b -- a^b )
        "OR":               0x0746,                     // ( a b -- a|b )
        "ROL":              0x0307,                     // ( a -- {a[14:0],a[15]} )
        "2ROL":             0x0308,                     // ( a -- {a[13:0],a[15:14]} )
        "4ROL":             0x0309,                     // ( a -- {a[11:0],a[15:12]} )
        "8ROL":             0x030A,                     // ( a -- {a[7:0],a[15:8]} )
        "ASR":              0x030B,                     // ( a -- {a[15],a[15:1]} )
        "2ASR":             0x030C,                     // ( a -- {a[15],a[15],a[15:2]} )
        "4ASR":             0x030D,                     // ( a -- {a[15],a[15],a[15],a[15],a[15:4]} )
        "@":                0x030F,                     // ( addr -- data )
        "!":                0x098F,                     // ( data addr -- )
        ">R":               0x2100,                     // ( a -- ) R:( -- a )
        "R>":               0x1280,                     // ( -- a ) R:( a -- )
        "R@":               0x0280,                     // ( -- a ) R:( a -- a )
        "EXIT":             0x5000,                     // ( -- ) R:( addr -- ) addr->pc
        ";":                0x5000                      // ( -- ) R:( addr -- ) addr->pc
    };
    const prog = [
        uc_jump(0)
    ];

    function uc_call(addr) {    // push return address and jump
        return (0xC000 | (addr & ADDR_MASK));
    }
    function uc_jump(addr) {    // jump (unconditional)
        return (0x8000 | (addr & ADDR_MASK));
    }
    function uc_jz(addr) {      // jump if zero
        return (0xA000 | (addr & ADDR_MASK));
    }
    function uc_skz() {         // skip if zero
        return uc_jz(prog.length + 2);
    }

    function compile_words(token) {
        let prev_safe = false;
        while (token.length > 0) {
//debug console.log("compile_words:", token);
            if (token === "(") {
                compile_comment(next_token());
            } else if (token === ":") {
                // new entry-point
                const word = uc_call(prog.length);
                prog[0] = word;  // update bootstrap entry-point
                const name = next_token();
//debug console.log("compile_name:", name, "=", word.toString(16).padStart(4, "0"));
                words[name] = word;
                prev_safe = false;
            } else if (token === "SKZ") {
                // skip (next instruction), if TOS is zero
                prog.push(uc_skz());
            } else {
                const word = words[token];
                if (prev_safe && (word === UC_EXIT)) {
                    // attach "free" EXIT to previous word
                    prog[prog.length - 1] |= UC_EXIT;
                } else if (typeof word === "number") {
                    // compile primitive or call
                    prog.push(word);
                    prev_safe = ((word & 0xF000) === 0);
                } else {
                    const num = Number(token);
                    if (Number.isSafeInteger(num)) {
                        // push number literal
                        prog.push(UC_LIT);
                        prog.push(num & 0xFFFF);  // truncate to 16 bits
                        prev_safe = false;
                    } else {
                        return error("invalid token:", token);
                    }
                }
            }
            token = next_token();
        }
        return token;
    }
    function compile_comment(token) {
        while (token.length > 0) {
//debug console.log("compile_comment:", token);
            if (token === "(") {
                compile_comment(next_token());
            } else if (token == ")") {
                break;
            }
            token = next_token();
        }
        return token;
    }

    const end = compile_words(next_token());
    if (end.length !== 0) {
        return end;
    }
    return prog;
}

//debug const simple_source = ": BOOT R> DROP BOOT ;";
//debug const multiline_source = `
//debug : NOT ( a -- ~a )
//debug     0xFFFF XOR ;
//debug : NIP ( a b -- b )
//debug     SWAP DROP ;
//debug : TUCK ( a b -- b a b )
//debug     SWAP OVER ;
//debug : ?: ( altn cnsq cond -- cnqs | altn )
//debug     SKZ SWAP
//debug : (DROP)
//debug     DROP ;
//debug 
//debug ( WARNING! BOOT should not return... )
//debug : BOOT
//debug     R> DROP BOOT`;
// const source = simple_source;
//debug const source = multiline_source;
// console.log(compile(source));
//debug console.log(compile(source).map(function (number, index) {
//debug    return index.toString(16).padStart(3, "0") + ": " + number.toString(16).padStart(4, "0");
//debug }).join("\n"));

export default Object.freeze(compile);
