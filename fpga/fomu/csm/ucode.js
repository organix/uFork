// ucode.js -- uCode (Forth dialect) compiler
// Dale Schumacher
// 2024-04-10

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

    const ADDR_MASK =           0x0FFF;                 // 12-bit uCode addresses

    function uc_call(addr) {    // push return address and jump
        return (0xC000 | (addr & ADDR_MASK));
    }
    function uc_jump(addr) {    // jump (unconditional)
        return (0x8000 | (addr & ADDR_MASK));
    }
    function uc_jz(addr) {      // jump if zero
        return (0xA000 | (addr & ADDR_MASK));
    }
    function uc_jz_inc(addr) {  // jump if zero, else increment
        return (0x9000 | (addr & ADDR_MASK));
    }
    function uc_jz_dec(addr) {  // jump if zero, else decrement
        return (0xB000 | (addr & ADDR_MASK));
    }

    const UC_LIT =          0x021F;                     // (LIT) item ( -- item )
    const UC_CONST =        0x521F;                     // (CONST) item ( -- item ) ( R: addr -- ) addr->pc
    const UC_TO_R =         0x2100;                     // >R ( a -- ) ( R: -- a )
    const UC_R_FROM =       0x1280;                     // R> ( -- a ) ( R: a -- )
    const UC_R_FETCH =      0x0280;                     // R@ ( -- a ) ( R: a -- a )
    const UC_EXIT =         0x5000;                     // EXIT ( -- ) ( R: addr -- ) addr->pc

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
        "LSB&":             0x0314,                     // ( a -- a&1 )
        "MSB&":             0x0324,                     // ( a -- a&-32768 )
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
        "IO@":              0x033F,                     // ( io_reg -- data )
        "IO!":              0x09BF,                     // ( data io_reg -- )
        "T@":               0x034F,                     // ( qref -- data )
        "T!":               0x09CF,                     // ( data qref -- )
        "X@":               0x035F,                     // ( qref -- data )
        "X!":               0x09DF,                     // ( data qref -- )
        "Y@":               0x036F,                     // ( qref -- data )
        "Y!":               0x09EF,                     // ( data qref -- )
        "Z@":               0x037F,                     // ( qref -- data )
        "Z!":               0x09FF,                     // ( data qref -- )
        ">R":               0x2100,                     // ( a -- ) ( R: -- a )
        "R>":               0x1280,                     // ( -- a ) ( R: a -- )
        "R@":               0x0280,                     // ( -- a ) ( R: a -- a )
        "RDROP":            0x1000,                     // ( -- ) ( R: a -- )
        "EXIT":             0x5000                      // ( -- ) ( R: addr -- ) addr->pc ; no TCO
    };
    words[":"] = function () {
        // new entry-point
        const word = uc_call(prog.length);
        prog[0] = word;  // update bootstrap entry-point
        const name = next_token();
//debug console.log("compile_name:", name, "=", word.toString(16).padStart(4, "0"));
        words[name] = word;  // add word to dictionary
    };
    words["VARIABLE"] = function () {
        // new named variable
        const word = uc_call(prog.length);
        const name = next_token();
//debug console.log("compile_var:", name, "=", word.toString(16).padStart(4, "0"));
        prog.push(UC_CONST);
        prog.push(prog.length + 1);  // variable address
        prog.push(0);  // variable data field
        words[name] = word;  // add word to dictionary
    };
    words["SKZ"] = function () {                        // ( 0 -- ) pc+2->pc | ( n -- )
        // skip (next instruction), if TOS is zero
        prog.push(uc_jz(prog.length + 2));
    };
    words["BEGIN"] = function () {                      // ( -- )
        // begin indefinite loop
        const addr = prog.length;
//debug console.log("compile_indefinite_loop:", "$"+addr.toString(16).padStart(3, "0"));
        const word = uc_jump(addr);  // placeholder
        ctrl_ctx.push(word);
    };
    words["UNTIL"] = function () {                      // ( cond -- )
        // end bottom-test loop
        const addr = ctrl_ctx.pop() & ADDR_MASK;
        prog.push(uc_jz(addr));
    };
    words["WHILE"] = function () {                      // ( cond -- )
        // loop (top) test
        const addr = ctrl_ctx.pop() & ADDR_MASK;
        const word = uc_jump(prog.length);
        ctrl_ctx.push(word);
        prog.push(uc_jz(addr));  // placeholder
    };
    words["REPEAT"] = function () {                     // ( -- )
        // end top-test loop
        const addr = ctrl_ctx.pop() & ADDR_MASK;
        const word = uc_jump(prog[addr]);
        prog.push(word);
        prog[addr] = uc_jz(prog.length);  // patch
    };
    words["?D0"] = function () {                        // ( n -- ) ( R: -- n' )
        // begin counted loop
        const addr = prog.length;
//debug console.log("compile_counted_loop:", "$"+addr.toString(16).padStart(3, "0"));
        const word = uc_jz(addr);  // placeholder
        ctrl_ctx.push(word);
        prog.push(word);
        prog.push(UC_TO_R);
    };
    words["I"] = function () {                          // ( -- n ) ( R: n -- n )
        // fetch loop count (from R-stack)
        prog.push(UC_R_FETCH);
    };
    words["LOOP-"] = function () {                      // loop->pc
        // end decrement loop
        prog.push(UC_R_FROM);
        const addr = ctrl_ctx.pop() & ADDR_MASK;
        prog.push(uc_jump(addr));
        prog[addr] = uc_jz_dec(prog.length);  // patch
    };
    words["LOOP+"] = function () {                      // loop->pc
        // end increment loop
        prog.push(UC_R_FROM);
        const addr = ctrl_ctx.pop() & ADDR_MASK;
        prog.push(uc_jump(addr));
        prog[addr] = uc_jz_inc(prog.length);  // patch
    };
    words["IF"] = function () {                         // ( cond -- )
        // begin conditional
//debug console.log("compile_if:", "$"+prog.length.toString(16).padStart(3, "0"));
        const word = uc_jz(prog.length);  // placeholder
        ctrl_ctx.push(word);
        prog.push(word);
    };
    words["ELSE"] = function () {                       // ( -- )
        // begin alternative
//debug console.log("compile_else:", "$"+prog.length.toString(16).padStart(3, "0"));
        const addr = ctrl_ctx.pop() & ADDR_MASK;
        prog[addr] = uc_jz(prog.length + 1);  // patch
        const word = uc_jump(prog.length);  // placeholder
        ctrl_ctx.push(word);
        prog.push(word);
    };
    words["THEN"] = function () {                       // ( -- )
        // end conditional
//debug console.log("compile_then:", "$"+prog.length.toString(16).padStart(3, "0"));
        const word = ctrl_ctx.pop();
        const addr = word & ADDR_MASK;
        prog[addr] = (word & ~ADDR_MASK) | (prog.length & ADDR_MASK);  // patch
    };

    const ctrl_ctx = [];  // stack of flow-control contexts

    const prog = [
        uc_jump(0)
    ];
    function compile_words(token) {
        const TAIL_NONE = 0;
        const TAIL_EVAL = 1;
        const TAIL_CALL = 2;
        const TAIL_DATA = 3;
        let tail_ctx = TAIL_NONE;
        while (token.length > 0) {
//debug console.log("compile_words:", token);
            if (token === "(") {
                compile_comment(next_token());
            } else if (token === ";") {
                if (ctrl_ctx.length > 0) {
                    return error("EXIT from control depth", ctrl_ctx.length);
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
            } else if (token === "CONSTANT") {
                // allocate constant word
                const name = next_token();
                if (tail_ctx !== TAIL_DATA) {
                    return error("invalid constant:", name);
                }
                const addr = prog.length - 2;
                const word = uc_call(addr);
//debug console.log("compile_const:", name, "=", word.toString(16).padStart(4, "0"));
                prog[addr] = UC_CONST;  // convert (LIT) to (CONST)
                words[name] = word;  // add word to dictionary
                tail_ctx = TAIL_NONE;
            } else {
                const word = words[token];
                if (typeof word === "number") {
                    // compile primitive or call
                    prog.push(word);
                    tail_ctx = (word & 0xF000) === 0xC000
                        ? TAIL_CALL
                        : (word & 0xF000) === 0x0000
                            ? TAIL_EVAL
                            : TAIL_NONE;
                } else if (typeof word === "function") {
                    // invoke compiler function
                    word();
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

//debug const simple_source = ": BOOT R@ DROP BOOT ;";
//debug const multiline_source = `
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
//debug     4 ?D0 DROP I DROP LOOP- ;
//debug : EMIT ( ch -- )
//debug     BEGIN 0x00 IO@ UNTIL 0x01 IO! ;
//debug : KEY ( -- ch )
//debug     BEGIN 0x02 IO@ NOT WHILE REPEAT 0x03 IO@ ;
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
