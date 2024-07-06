// ucode.js -- uCode/Forth compiler
// Dale Schumacher
// created: 2024-04-10

/*jslint bitwise, long */

import hex from "https://ufork.org/lib/hex.js";

// Create a position-tracking character-stream.

function make_stream(text, src = "") {
    let pos = 0;  // input position within `text`
    let line = 1;  // input line number
    function error(...msg) {
        const err = {
            src,
            pos,
            line,
            error: msg.join(" ")
        };
//debug console.log("ERROR!", err);
        return err;
    }
    function next_char() {
        const cp = text.codePointAt(pos);  // returns `undefined` if out-of-bounds
        if (typeof cp === "number") {
            pos += (
                cp <= 0xFFFF
                ? 1
                : 2
            );
        }
        if (cp === 10) {  // watch for '\n'
            line += 1;
        }
        return cp;
    }
    return {next_char, error};
}

// Compile uCode/Forth source.

function compile(text, src = "") {
    const {next_char, error} = make_stream(text, src);
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

    const ADDR_MASK = 0x0FFF;  // 12-bit uCode addresses

    function uc_jump(addr) {  // jump (unconditional)
        return (0x8000 | (addr & ADDR_MASK));
    }
    function uc_jz(addr) {  // jump, if zero
        return (0x9000 | (addr & ADDR_MASK));
    }
    function uc_inc_jnz(addr) {  // increment and jump, if not zero
        return (0xA000 | (addr & ADDR_MASK));
    }
    function uc_dec_jnz(addr) {  // decrement and jump, if not zero
        return (0xB000 | (addr & ADDR_MASK));
    }
    function uc_call(addr) {  // push return address and jump
        return (0xC000 | (addr & ADDR_MASK));
    }
    function uc_is_auto(word) { // auto increment/decrement?
        return ((word & 0xE000) === 0xA000);
    }
    function uc_fixup(word, addr) {
        // replace immediate address in word
        return (word & ~ADDR_MASK) | (addr & ADDR_MASK);
    }

    const prog = [  // program "image" as 16-bit unsigned integers
        uc_jump(0)
    ];

    const ctrl_ctx = [];  // stack of flow-control contexts

    const TAIL_NONE = 0;
    const TAIL_EVAL = 1;
    const TAIL_CALL = 2;
    const TAIL_DATA = 3;

    let tail_ctx = TAIL_NONE;

    const UC_LIT = 0x021F;  // (LIT) item ( -- item )
    const UC_CONST = 0x521F;  // (CONST) item ( -- item ) ( R: addr -- ) addr->pc
    const UC_TO_R = 0x2100;  // >R ( a -- ) ( R: -- a )
    //const UC_R_FROM = 0x1280;  // R> ( -- a ) ( R: a -- )
    const UC_R_FETCH = 0x0280;  // R@ ( -- a ) ( R: a -- a )
    const UC_EXIT = 0x5000;  // EXIT ( -- ) ( R: addr -- ) addr->pc

    const words = {
        "NOP": 0x0000,  // ( -- )
        "DROP": 0x0100,  // ( a -- )
        "DUP": 0x0200,  // ( a -- a a )
        "SWAP": 0x0400,  // ( a b -- b a )
        "OVER": 0x0240,  // ( a b -- a b a )
        "ROT": 0x0500,  // ( a b c -- b c a )
        "-ROT": 0x0600,  // ( a b c -- c a b )
        "TRUE": 0x02F6,  // ( -- -1 )
        "FALSE": 0x02C0,  // ( -- 0 )
        "0": 0x02C0,  // ( -- 0 )
        "1": 0x02D6,  // ( -- 1 )
        "-1": 0x02F6,  // ( -- -1 )
        "LSB": 0x02D6,  // ( -- 1 )
        "MSB": 0x02E6,  // ( -- 0x8000 )
        "LSB&": 0x0314,  // ( a -- a&1 )
        "MSB&": 0x0324,  // ( a -- a&0x8000 )
        "LSB|": 0x0316,  // ( a -- a|1 )
        "MSB|": 0x0326,  // ( a -- a|0x8000 )
        "INVERT": 0x0335,  // ( a -- ~a )
        "NEGATE": 0x03C2,  // ( a -- -a )
        "1+": 0x0311,  // ( a -- a+1 )
        "1-": 0x0312,  // ( a -- a-1 )
        "2*": 0x0301,  // ( a -- a*2 )
        "2/": 0x030B,  // ( a -- a/2 )
        "+": 0x0741,  // ( a b -- a+b )
        "-": 0x0742,  // ( a b -- a-b )
        "*": 0x0743,  // ( a b -- a*b )
        "AND": 0x0744,  // ( a b -- a&b )
        "XOR": 0x0745,  // ( a b -- a^b )
        "OR": 0x0746,  // ( a b -- a|b )
        "ROL": 0x0307,  // ( a -- {a[14:0],a[15]} )
        "2ROL": 0x0308,  // ( a -- {a[13:0],a[15:14]} )
        "4ROL": 0x0309,  // ( a -- {a[11:0],a[15:12]} )
        "8ROL": 0x030A,  // ( a -- {a[7:0],a[15:8]} )
        "ASR": 0x030B,  // ( a -- {a[15],a[15:1]} )
        "2ASR": 0x030C,  // ( a -- {a[15],a[15],a[15:2]} )
        "4ASR": 0x030D,  // ( a -- {a[15],a[15],a[15],a[15],a[15:4]} )
        "@": 0x030F,  // ( addr -- data )
        "!": 0x098F,  // ( data addr -- )
        "IO@": 0x033F,  // ( io_reg -- data )
        "IO!": 0x09BF,  // ( data io_reg -- )
        "QT@": 0x034F,  // ( qref -- data )
        "QT!": 0x09CF,  // ( data qref -- )
        "QX@": 0x035F,  // ( qref -- data )
        "QX!": 0x09DF,  // ( data qref -- )
        "QY@": 0x036F,  // ( qref -- data )
        "QY!": 0x09EF,  // ( data qref -- )
        "QZ@": 0x037F,  // ( qref -- data )
        "QZ!": 0x09FF,  // ( data qref -- )
        ">R": 0x2100,  // ( a -- ) ( R: -- a )
        "R>": 0x1280,  // ( -- a ) ( R: a -- )
        "R@": 0x0280,  // ( -- a ) ( R: a -- a )
        "RDROP": 0x1000,  // ( -- ) ( R: a -- )
        "FAIL": 0x002F,  // ( -- ) signal failure
        ":": function () {
            // new entry-point
            const word = uc_call(prog.length);
            prog[0] = word;  // update bootstrap entry-point
            const name = next_token();
//debug console.log("compile_name:", name, "=", hex.from(word, 16));
            words[name] = word;  // add word to dictionary
        },
        ",": function () {
            // allocate raw data
            if (tail_ctx !== TAIL_DATA) {
                return error("invalid data allocation");
            }
            const addr = prog.length - 2;
            prog[addr] = prog[addr + 1];  // copy data over (LIT)
            prog.pop();  // deallocate duplicated data
            tail_ctx = TAIL_NONE;
        },
        "CONSTANT": function () {
            // allocate constant word
            const name = next_token();
            if (tail_ctx !== TAIL_DATA) {
                return error("invalid constant:", name);
            }
            const addr = prog.length - 2;
            const word = uc_call(addr);
//debug console.log("compile_const:", name, "=", hex.from(word, 16));
            prog[addr] = UC_CONST;  // convert (LIT) to (CONST)
            words[name] = word;  // add word to dictionary
            tail_ctx = TAIL_NONE;
        },
        "VARIABLE": function () {
            // new named variable
            const word = uc_call(prog.length);
            const name = next_token();
//debug console.log("compile_var:", name, "=", hex.from(word, 16));
            prog.push(UC_CONST);
            prog.push(prog.length + 1);  // variable address
            prog.push(0);  // variable data field
            words[name] = word;  // add word to dictionary
        },
        "SKZ": function () {                            // ( 0 -- ) pc+2->pc | ( n -- )
            // skip (next instruction), if TOS is zero
            prog.push(uc_jz(prog.length + 2));
        },
        "BEGIN": function () {                          // ( -- )
            // begin indefinite loop
            const addr = prog.length;
//debug console.log("compile_indefinite_loop:", "$"+hex.from(addr, 12));
            const word = uc_jump(addr);  // placeholder
            ctrl_ctx.push(word);
        },
        "UNTIL": function () {                          // ( cond -- )
            // end bottom-test loop
            const addr = ctrl_ctx.pop() & ADDR_MASK;
            prog.push(uc_jz(addr));
        },
        "WHILE": function () {                          // ( cond -- )
            // loop (top) test
            const addr = ctrl_ctx.pop() & ADDR_MASK;
            const word = uc_jz(prog.length);
            ctrl_ctx.push(word);
            prog.push(uc_jz(addr));  // placeholder
        },
        "REPEAT": function () {                         // ( -- )
            // end top-test loop
            const addr = ctrl_ctx.pop() & ADDR_MASK;
            const word = uc_jump(prog[addr]);
            prog.push(word);
            prog[addr] = uc_jz(prog.length);  // patch
        },
        "?LOOP-": function () {                         // ( n -- ) ( R: -- n' )
            // begin counted loop
            prog.push(UC_TO_R);
            const addr = prog.length;
//debug console.log("compile_countdown_loop:", "$"+hex.from(addr, 12));
            const word = uc_dec_jnz(addr);  // placeholder
            ctrl_ctx.push(word);
            prog.push(word);
        },
        "?LOOP+": function () {                         // ( n -- ) ( R: -- n' )
            // begin counted loop
            prog.push(UC_TO_R);
            const addr = prog.length;
//debug console.log("compile_countup_loop:", "$"+hex.from(addr, 12));
            const word = uc_inc_jnz(addr);  // placeholder
            ctrl_ctx.push(word);
            prog.push(word);
        },
        "I": function () {                              // ( -- n ) ( R: n -- n )
            // fetch loop count (from R-stack)
            const n = ctrl_ctx.length;
            if (!uc_is_auto(ctrl_ctx[n - 1])) {
                return error("no `I` at control depth", n);
            }
            prog.push(UC_R_FETCH);
        },
        "AGAIN": function () {                          // ( -- )
            // end infinite or counted loop
//debug console.log("compile_again:", "$"+hex.from(prog.length, 12));
            const word = ctrl_ctx.pop();
            const addr = word & ADDR_MASK;
            if (uc_is_auto(word)) {
                prog[addr] = uc_jump(prog.length);  // patch
                prog.push(uc_fixup(word, addr + 1));
            } else {
                prog.push(uc_jump(addr));
            }
        },
        "IF": function () {                             // ( cond -- )
            // begin conditional
//debug console.log("compile_if:", "$"+hex.from(prog.length, 12));
            const word = uc_jz(prog.length);  // placeholder
            ctrl_ctx.push(word);
            prog.push(word);
        },
        "ELSE": function () {                           // ( -- )
            // begin alternative
//debug console.log("compile_else:", "$"+hex.from(prog.length, 12));
            const addr = ctrl_ctx.pop() & ADDR_MASK;
            prog[addr] = uc_jz(prog.length + 1);  // patch
            const word = uc_jump(prog.length);  // placeholder
            ctrl_ctx.push(word);
            prog.push(word);
        },
        "THEN": function () {                           // ( -- )
            // end conditional
//debug console.log("compile_then:", "$"+hex.from(prog.length, 12));
            const word = ctrl_ctx.pop();
            const addr = word & ADDR_MASK;
            prog[addr] = uc_fixup(word, prog.length);  // patch
        },
        ";": function () {
            // return from procedure
            if (ctrl_ctx.some(uc_is_auto)) {
                return error("EXIT from counted-loop at depth", ctrl_ctx.length);
            }
            if (tail_ctx === TAIL_EVAL) {
                // attach "free" EXIT to previous word
                prog[prog.length - 1] |= UC_EXIT;
            } else if (tail_ctx === TAIL_CALL) {
                // convert previous CALL to JUMP
                prog[prog.length - 1] &= ~0x4000;
            } else {
                // compile EXIT
                prog.push(UC_EXIT);
            }
            tail_ctx = TAIL_NONE;
        },
        "EXIT": 0x5000  // ( -- ) ( R: addr -- ) addr->pc ; no TCO
    };

    function compile_comment(token) {
        while (token.length > 0) {
//debug console.log("compile_comment:", token);
            if (token === "(") {
                token = compile_comment(next_token());
            } else if (token === ")") {
                break;
            }
            token = next_token();
        }
        return token;
    }
    function compile_word(token) {
//debug console.log("compile_word:", token);
        if (token === "(") {
            return compile_comment(next_token());
        }
        const word = words[token];
        if (typeof word === "number") {
            // compile primitive or call
            prog.push(word);
            tail_ctx = (
                (word & 0xF000) === 0xC000
                ? TAIL_CALL
                : (
                    (word & 0xF000) === 0x0000
                    ? TAIL_EVAL
                    : TAIL_NONE
                )
            );
        } else if (typeof word === "function") {
            // invoke compiler function
            const err = word();
            if (err) {
                return err;
            }
            tail_ctx = TAIL_NONE;
        } else {
            const num = Number(token);
            if (Number.isSafeInteger(num)) {
                // push number literal
                prog.push(UC_LIT);
                prog.push(num & 0xFFFF);  // truncate to 16 bits
                tail_ctx = TAIL_DATA;
            } else {
                return error("invalid token:", token);
            }
        }
        return token;
    }

    let token = next_token();
    while (token?.length > 0) {
        const result = compile_word(token);
        if (result?.error) {
            return {errors: [result]};
        }
        token = next_token();
    }
    return {
        words,
        prog
    };
}

// Disassemble a single uCode machine word.

function disasm(code, words = {}) {
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
    const entry = Object.entries(words).find(function ([_, value]) {
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
        text += "(" + hex.from(addr, 12) + ")";
    } else {
        text += "0x";
        text += hex.from(code, 16);
    }
    return text;
}

// Print annotated Verilog memory image

function print_memh(prog, words = {}) {
    let lines = [
        "/*  CODE    ADR  DISASM                  NAMES                     */"
//           021f // 0ac: (LIT)                   RX? KEY?
//           0002 // 0ad: 0x0002
//           533f // 0ae: IO@ EXIT
//           c0ac // 0af: RX?                     KEY
//           90af // 0b0: jump_ifzero(0af)
// E.g.      021f // 0b1: (LIT)                   RX@
//           0003 // 0b2: 0x0003
//           533f // 0b3: IO@ EXIT
//           2100 // 0b4: >R                      SPACES
//           80b7 // 0b5: jump(0b7)
//           c0a6 // 0b6: SPACE
//           b0b6 // 0b7: jump_ifnz_dec(0b6)
//           5000 // 0b8: NOP EXIT
    ];
    lines = lines.concat(prog.map(function (code, address) {
        const call = 0xC000 | address;
        const line = (
            "    " + hex.from(code, 16)                             // CODE
            + " // " + hex.from(address, 12) + ": "                 // ADR
            + disasm(code, words).padEnd(24, " ")                   // DISASM
            + Object.entries(                                       // NAMES
                words
            ).filter(function ([_, word]) {
                return word === call;
            }).map(function ([name, _]) {
                return name;
            }).join(
                " "
            )
        );
        return line.trimEnd();
    }));
    return lines.join("\n") + "\n";
}

// Parse Verilog hexadecimal memory image

function parse_memh(text, src = "") {
    const {next_char} = make_stream(text, src);

    const CHAR_NL = 0x0A;  // ASCII newline
    const CHAR_STAR = 0x2A;  // ASCII asterisk
    const CHAR_SLASH = 0x2F;  // ASCII forward slash
    const CHAR_0 = 0x30;  // ASCII digit zero
    const CHAR_9 = 0x39;  // ASCII digit nine
    const HEX_UC_A = 0x37;  // uppercase 'A' minus 10
    const CHAR_UC_A = 0x41;  // ASCII uppercase 'A'
    const CHAR_UC_F = 0x46;  // ASCII uppercase 'F'
    const HEX_LC_A = 0x57;  // lowercase 'A' minus 10
    const CHAR_LC_A = 0x61;  // ASCII lowercase 'A'
    const CHAR_LC_F = 0x66;  // ASCII lowercase 'F'

    function is_hex_digit(char) {
        return ((char >= CHAR_0) && (char <= CHAR_9))
        || ((char >= CHAR_UC_A) && (char <= CHAR_UC_F))
        || ((char >= CHAR_LC_A) && (char <= CHAR_LC_F));
    }
    function from_hex_digit(char) {
        if ((char >= CHAR_0) && (char <= CHAR_9)) {
            return (char - CHAR_0);
        }
        if ((char >= CHAR_UC_A) && (char <= CHAR_UC_F)) {
            return (char - HEX_UC_A);
        }
        if ((char >= CHAR_LC_A) && (char <= CHAR_LC_F)) {
            return (char - HEX_LC_A);
        }
    }
    function parse_hex() {
        // skip non-hex-digits
        let cp = next_char();
        while ((typeof cp === "number") && !is_hex_digit(cp)) {
            if (cp === CHAR_SLASH) {
                cp = next_char();
                if (cp === CHAR_SLASH) {
                    // skip comment to end-of-line
                    cp = next_char();
                    while ((typeof cp === "number") && (cp !== CHAR_NL)) {
                        cp = next_char();
                    }
                } else if (cp === CHAR_STAR) {
                    // skip comment to closing delimiter
                    cp = next_char();
                    while (true) {
                        while ((typeof cp === "number") && (cp !== CHAR_STAR)) {
                            cp = next_char();
                        }
                        cp = next_char();
                        if ((typeof cp !== "number") || (cp === CHAR_SLASH)) {
                            break;
                        }
                    }
                }
            }
            cp = next_char();
        }
        if (typeof cp !== "number") {
            return cp;  // return `undefined` for end-of-stream
        }
        // collect hex-digits
        let num = 0;
        while ((typeof cp === "number") && is_hex_digit(cp)) {
            num = (num << 4) | from_hex_digit(cp);
            cp = next_char();
        }
        // return final value
        return num;
    }

    const prog = [];
    while (true) {
        const num = parse_hex();
        if (typeof num !== "number") {
            break;
        }
        prog.push(num);
    }
    return prog;
}

//debug console.log(disasm(0xA252));
//debug console.log(disasm(0x5100, {DROP: 0x0100}));

//debug console.log("["
//debug     + parse_memh("  C0de // Data?")
//debug         .map((n) => "0x" + hex.from(n, 16))
//debug         .join(", ")
//debug     + "]");

//debug const test_memh = `
//debug /*  CODE    ADR  DISASM                  NAMES                     */
//debug     c042 // 000: BOOT
//debug     521f // 001: (CONST)                 ADDR_MASK
//debug     0fff // 002: 0x0fff
//debug     521f // 003: (CONST)                 COUNTER
//debug     0005 // 004: 0x0005
//debug     0000 // 005: NOP
//debug     c003 // 006: COUNTER                 ADJUST
//debug     030f // 007: @
//debug     0741 // 008: +
//debug     0200 // 009: DUP
//debug     c003 // 00a: COUNTER
//debug     598f // 00b: ! EXIT
//debug `;
//debug const img = parse_memh(test_memh);
//debug console.log(img.map(function (number, index) {
//debug     return hex.from(index, 12) + ": " + hex.from(number, 16);
//debug }).join("\n"));

//debug const simple_source = ": BOOT R@ DROP BOOT ;";
//debug const multiline_source = String.raw`
//debug 0x0A CONSTANT '\n'
//debug 0x0FFF CONSTANT ADDR_MASK
//debug VARIABLE COUNTER
//debug
//debug : ADJUST ( n -- n+COUNTER )
//debug     COUNTER @ +
//debug     DUP COUNTER ! ;
//debug : EXECUTE ( addr -- ) ( R: -- addr )
//debug     ADDR_MASK ( 0x0FFF ) AND >R
//debug : (EXIT)
//debug     EXIT
//debug : NIP ( a b -- b )
//debug     SWAP DROP ;
//debug : TUCK ( a b -- b a b )
//debug     SWAP OVER ;
//debug : ?: ( altn cnsq cond -- cnqs | altn )
//debug     SKZ SWAP
//debug : (DROP)
//debug     DROP ;
//debug : 0= ( n -- n==0 )
//debug : NOT ( flag -- !flag )
//debug     TRUE FALSE ROT ?: ;
//debug : BOOL ( n -- flag )
//debug     IF TRUE ELSE FALSE THEN ;
//debug : 0< ( n -- n<0 )
//debug     MSB& BOOL ;
//debug : 4DROP ( a b c d -- )
//debug     4 ?LOOP- DROP I DROP AGAIN ;
//debug : EMIT ( ch -- )
//debug     BEGIN 0x00 IO@ UNTIL 0x01 IO! ;
//debug : KEY ( -- ch )
//debug     BEGIN 0x02 IO@ NOT WHILE REPEAT 0x03 IO@ ;
//debug : fetch ( addr -- data )
//debug     ! ;
//debug : store ( data addr -- )
//debug     @ ;
//debug : Hello 72 , 101 , 108 , 108 , 111 ,
//debug
//debug ( WARNING! BOOT should not return... )
//debug : BOOT
//debug     R> DROP BOOT`;
// const source = simple_source;
//debug const source = multiline_source;
//debug console.log(source);
//debug const {errors, words, prog} = compile(source);
//debug if (errors !== undefined && errors.length > 0) {
//debug     console.log(errors);
//debug } else {
//debug     const memh = print_memh(prog, words);
//debug     console.log(memh);
//debug     const img = parse_memh(memh);
//debug     console.log(img.map(function (number, index) {
//debug         return hex.from(index, 12) + ": " + hex.from(number, 16);
//debug     }).join("\n"));
//debug }

export default Object.freeze({
    make_stream,
    compile,
    disasm,
    print_memh,
    parse_memh
});
