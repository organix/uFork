(
    Base word dictionary for uCode
)

: PANIC! FAIL PANIC! ;      ( if BOOT returns... )

3   CONSTANT ^C
8   CONSTANT '\b'
9   CONSTANT '\t'
10  CONSTANT '\n'
13  CONSTANT '\r'
32  CONSTANT BL
48  CONSTANT '0'
57  CONSTANT '9'
55  CONSTANT A-10
65  CONSTANT 'A'
70  CONSTANT 'F'
90  CONSTANT 'Z'
97  CONSTANT 'a'
102 CONSTANT 'f'
122 CONSTANT 'z'
127 CONSTANT DEL

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
: INBOUNDS ( n lo hi -- lo<=n&&n<=hi )
    -ROT OVER SWAP -
    -ROT - OR MSB& 0= ;
: ISDIGIT ( char -- flag )
    '0' '9' INBOUNDS ;
: ISHEX ( char -- flag )
    DUP 'A' 'F' INBOUNDS
    OVER 'a' 'f' INBOUNDS OR
    SWAP ISDIGIT OR ;
: ISUPPER ( char -- flag )
    'A' 'Z' INBOUNDS ;
: ISLOWER ( char -- flag )
    'a' 'z' INBOUNDS ;
: TOUPPER ( 'A' | 'a' -- 'A' )
    DUP ISLOWER IF
        BL XOR  ( flip case )
    THEN ;
: TOLOWER ( 'A' | 'a' -- 'a' )
    DUP ISUPPER IF
        BL XOR  ( flip case )
    THEN ;

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
        '0'
    ELSE
        A-10
    THEN + EMIT ;
: X. ( n -- )
    4 ?D0
        4ROL DUP X#
    LOOP- DROP ;

( Debugging Monitor )
33  CONSTANT '!'
46  CONSTANT '.'
62  CONSTANT '>'
64  CONSTANT '@'
113 CONSTANT 'q'
VARIABLE cmd    ( last command character read )
VARIABLE inp    ( input data accumulator )
VARIABLE tos    ( top of stack )
VARIABLE nos    ( next on stack )
: push ( x -- )
    tos @ nos !
    tos ! ;
: pop ( -- x )
    tos @
    nos @ tos ! ;
: quad ( raw -- addr )
    DUP MSB& IF
        0x0FFF AND          ( uCode | fixnum )
    ELSE
        2ROL
        DUP LSB& IF         ( RAM address )
            0x3FFC AND 0x4000 OR
        ELSE                ( ROM address )
            0x7FFC AND MSB|
        THEN
    THEN ;
: fetch ( addr -- data )
    DUP 0xC000 AND IF
        DUP 0x3 AND SWAP    ( D: field addr )
        DUP MSB& IF
            2ASR 0x1FFF
        ELSE
            2ASR 0x0FFF
        THEN AND            ( D: field offset )
        OVER 0x1 = IF
            QX@             ( D: field data )
        ELSE
            OVER 0x2 = IF
                QY@         ( D: field data )
            ELSE
                OVER 0x3 = IF
                    QZ@     ( D: field data )
                ELSE
                    QT@     ( D: field data )
                THEN
            THEN
        THEN
        NIP                 ( D: data )
    ELSE
        @                   ( D: data )
    THEN ;
: store ( data addr -- )
    DUP 0xC000 AND IF
        DUP 0x3 AND SWAP    ( D: data field addr )
        DUP MSB& IF
            2ASR 0x1FFF
        ELSE
            2ASR 0x0FFF
        THEN AND SWAP       ( D: data offset field )
        DUP 0x1 = IF
            DROP QX!
        ELSE
            DUP 0x2 = IF
                DROP QY!
            ELSE
                DUP 0x3 = IF
                    DROP QZ!
                ELSE
                    DROP QT!
                THEN
            THEN
        THEN
    ELSE
        !
    THEN ;
: prompt ( -- )
    '>' EMIT BL EMIT ;
: MONITOR
    KEY                     ( D: key )
    DUP ^C = SKZ EXIT       ( abort! )
    DUP EMIT
    DUP '\r' = IF
        '\n' EMIT
    THEN
    DUP BL <= IF
        cmd @ ISHEX IF
            inp @ push
        THEN
        cmd @ '@' = IF
            pop fetch push
        THEN
        cmd @ '.' = IF
            pop X. CR
        THEN
        cmd @ '!' = IF
            pop pop SWAP store
        THEN
        cmd @ 'q' = IF
            pop quad push
        THEN
        0 inp !
        DUP '\r' = IF
            prompt
        THEN
    THEN
    DUP ISHEX IF
        DUP TOUPPER         ( D: key uc )
        DUP 'A' < IF
            '0'
        ELSE
            A-10
        THEN -              ( D: key nybble )
        inp @               ( D: key nybble accum )
        4ROL 0xFFF0 AND OR  ( D: key accum' )
        inp !               ( D: key )
    THEN
    cmd ! MONITOR ;

: ECHO
    KEY DUP
    ( EMIT ) X. CR
    DUP '\r' = IF
        '\n' EMIT
    THEN
    ^C = SKZ EXIT           ( abort! )
    ECHO ;

( WARNING! if BOOT returns we PANIC! )
: BOOT
    ECHO prompt MONITOR ;
