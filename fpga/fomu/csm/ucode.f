(
    Base word dictionary for uCode
)

10 CONSTANT '\n'
13 CONSTANT '\r'
32 CONSTANT BL
48 CONSTANT '0'
55 CONSTANT A-10
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

: ABS ( n -- +n )
    DUP MSB& SKZ NEGATE ;
: BOOL ( n -- flag )
    IF
        TRUE
    ELSE
        FALSE
    THEN ;
: = ( a b -- a==b )
    XOR
: 0= ( n -- n==0 )
: NOT ( flag -- !flag )
    IF
        FALSE
    ELSE
        TRUE
    THEN ;
: <> ( a b -- a!=b )
    = INVERT ;
: 0> ( n -- n>0 )
    NEGATE
: 0< ( n -- n<0 )
    MSB& BOOL ;
: > ( a b -- a>b )
    SWAP
: < ( a b -- a<b )
    - 0< ;
: >= ( a b -- a>=b )
    < INVERT ;
: <= ( a b -- a<=b )
    > INVERT ;
: MAX ( a b -- a | b )
    2DUP < ?: ;
: MIN ( a b -- a | b )
    2DUP > ?: ;

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
: SPACE ( -- )
    BL EMIT ;
: SPACES ( n -- )
    ?D0
        SPACE
    LOOP- ;
: CR ( -- )
    '\r' EMIT '\n' EMIT ;
: X# ( n -- )
    0xF AND
    DUP 10 < IF
        '0' + EMIT
    ELSE
        A-10 + EMIT
    THEN ;
: X. ( n -- )
    4 ?D0
        4ROL DUP X#
    LOOP- DROP ;

( WARNING! BOOT should not return... )
: BOOT
    KEY DUP
    EMIT
    '\r' = IF
        '\n' EMIT
    THEN
    BOOT ;
