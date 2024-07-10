(
    $ deno run ucode_cli.js <example.f >example.mem
)
: PANIC! FAIL PANIC! ;      ( if BOOT returns... )

0x03 CONSTANT ^C
0x0A CONSTANT '\n'
0x0D CONSTANT '\r'
0x20 CONSTANT BL

: ?: ( altn cnsq cond -- cnsq | altn )
    SKZ SWAP DROP ;
: ABS ( n -- +n )
    DUP MSB& SKZ NEGATE ;
: BOOL ( n -- flag )
    IF TRUE ELSE FALSE THEN ;
: = ( a b -- a==b )
    XOR
: 0= ( n -- n==0 )
: NOT ( flag -- !flag )
    TRUE FALSE ROT ?: ;
: <> ( a b -- a!=b )
    = INVERT ;
: 0> ( n -- n>0 )
    NEGATE
: 0< ( n -- n<0 )
    MSB& BOOL ;

: TX? ( -- ready )
: EMIT?
    0x00 IO@ ;
: SPACE ( -- )
    BL
: EMIT ( char -- )
    BEGIN TX? UNTIL
: TX! ( char -- )
    0x01 IO! ;
: RX? ( -- ready )
: KEY?
    0x02 IO@ ;
: KEY ( -- char )
    BEGIN RX? UNTIL
: RX@ ( -- char )
    0x03 IO@ ;
: SPACES ( n -- )
    ?LOOP-
        SPACE
    AGAIN ;
: CR ( -- )
    '\r' EMIT '\n' EMIT ;
: ECHO ( char -- )
    DUP EMIT
    '\r' = IF
        '\n' EMIT
    THEN ;

: ECHOLOOP
    KEY DUP ECHO
    ^C = IF EXIT THEN       ( abort! )
    ECHOLOOP ;

( WARNING! if BOOT returns we PANIC! )
: BOOT
    ECHOLOOP EXIT
