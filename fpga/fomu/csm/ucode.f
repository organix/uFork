(
    Base word dictionary for uCode
)

10 CONSTANT '\n'
13 CONSTANT '\r'
32 CONSTANT BL
48 CONSTANT '0'
65 CONSTANT 'A'
90 CONSTANT 'Z'
97 CONSTANT 'a'
122 CONSTANT 'z'

: (JMP)
    R>
: @EXECUTE
    @
: EXECUTE
    0x0FFF AND >R
: (EXIT)
    EXIT
: ?: ( altn cnsq cond -- cnqs | altn )
    SKZ SWAP
: (DROP)
    DROP ;
: (VAR)
    R> ;
: (CONST)
    R> @ ;
: NIP ( a b -- b )
    SWAP DROP ;
: TUCK ( a b -- b a b )
    SWAP OVER ;
: 2DUP ( a b -- a b a b )
    OVER OVER ;
: 2DROP ( a b -- )
    DROP DROP ;
: FLAG ( n -- flag )
    FALSE TRUE ROT ?: ;
: NOT ( flag -- !flag )
: 0=
    TRUE FALSE ROT ?: ;
: = ( a b -- a==b )
    XOR 0= ;
: 0< ( n -- n<0 )
    DUP MSB& IF TRUE ELSE FALSE THEN ;
: ABS ( n -- +n )
    DUP MSB& SKZ NEGATE ;

: TX? ( -- ready )
: EMIT?
    0x00 IO@ ;
: TX! ( char -- )
    0x01 IO! ;
: RX? ( -- ready )
: KEY?
    0x02 IO@ ;
: RX@ ( -- char )
    0x03 IO@ ;

: EMIT ( char -- )
    BEGIN TX? UNTIL TX! ;
: KEY ( -- char )
    BEGIN RX? UNTIL RX@ ;
: CR ( -- )
    '\r' EMIT '\n' EMIT ;

( WARNING! BOOT should not return... )
: BOOT
    KEY DUP
    EMIT
    '\r' = IF '\n' EMIT THEN
    BOOT ;
