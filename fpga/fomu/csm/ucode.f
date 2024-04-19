(
    Base word dictionary for uCode
)

: PANIC! FAIL PANIC! ;      ( if BOOT returns... )

0x03 CONSTANT ^C
0x08 CONSTANT '\b'
0x09 CONSTANT '\t'
0x0A CONSTANT '\n'
0x0D CONSTANT '\r'
0x20 CONSTANT BL
0x30 CONSTANT '0'
0x39 CONSTANT '9'
0x37 CONSTANT A-10
0x41 CONSTANT 'A'
0x46 CONSTANT 'F'
0x5A CONSTANT 'Z'
0x61 CONSTANT 'a'
0x66 CONSTANT 'f'
0x7A CONSTANT 'z'
0x7F CONSTANT DEL

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
: >X ( n -- x )
    0xF AND
    DUP 10 < IF
        '0'
    ELSE
        A-10
    THEN + ;
: X> ( x -- n )
    TOUPPER
    DUP 'A' < IF
        '0'
    ELSE
        A-10
    THEN - ;
: X# ( n -- )
    >X EMIT ;
: X. ( n -- )
    4 ?D0
        4ROL DUP X#
    LOOP- DROP ;

( Debugging Monitor )
0x21 CONSTANT '!'
0x2E CONSTANT '.'
0x2F CONSTANT '/'
0x3C CONSTANT '<'
0x3E CONSTANT '>'
0x3F CONSTANT '?'
0x40 CONSTANT '@'
0x5B CONSTANT '['
0x5D CONSTANT ']'
0x71 CONSTANT 'q'
0x72 CONSTANT 'r'
VARIABLE cmd    ( last command character read )
VARIABLE inp    ( input data accumulator )
VARIABLE tos    ( top of stack )
VARIABLE nos    ( next on stack )
VARIABLE copy   ( bulk copy mode )
VARIABLE here   ( bulk copy addr )
: @1+ ( addr -- )
    DUP @ 1+ SWAP ! ;
: push ( a -- )
    tos @ nos !
    tos ! ;
: pop ( -- a )
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
: dump ( start end -- )
    OVER -                  ( D: start span )
    DUP 0< IF
        2DROP
    ELSE
        1+ ?D0
            DUP fetch       ( D: addr data )
            OVER 0x7 AND IF
                SPACE
            ELSE
                CR
            THEN
            X. 1+           ( D: addr+1 )
        LOOP- CR DROP
    THEN ;
: >inp ( key -- )
    X> inp @                ( D: nybble accum )
    4ROL 0xFFF0 AND OR      ( D: accum' )
    inp ! ;
: >here ( data -- )
    here @ store
    here @1+ ;
: prompt ( -- )
    '>' EMIT BL EMIT ;
: del ( -- )
    cmd @
    DUP BL > IF
        DUP ISHEX IF
            inp @
            4ASR 0x0FFF AND
            DUP IF
                DUP >X
            ELSE
                BL
            THEN cmd !
            inp !
        ELSE
            BL cmd !
        THEN
        '\b' EMIT BL EMIT '\b' EMIT
    THEN DROP ;
: eol ( begin -- end )
    EMIT KEY
    DUP '\r' = SKZ EXIT
    eol ;
: MONITOR
    KEY                     ( D: key )
    DUP ^C = SKZ EXIT       ( abort! )
    DUP '\b' = IF
        DROP DEL
    THEN
    DUP DEL = SKZ del       ( delete previous )
    DUP '/' = SKZ eol       ( comment to EOL )
    DUP EMIT
    DUP '\r' = IF
        '\n' EMIT
    THEN
    cmd @ SWAP              ( D: cmd key )
    ( '<' EMIT OVER X. '.' EMIT DUP X. '>' EMIT )
    DUP BL <= IF
        copy @ IF
            OVER ISHEX IF
                inp @ >here
            THEN
            OVER ']' = IF
                FALSE copy !
            THEN
        ELSE
            OVER ISHEX IF
                inp @ push
            THEN
            OVER '@' = IF
                pop fetch push
            THEN
            OVER '.' = IF
                pop X. CR
            THEN
            OVER '!' = IF
                pop pop SWAP store
            THEN
            OVER 'q' = IF
                pop quad push
            THEN
            OVER '?' = IF
                pop pop SWAP dump
            THEN
            OVER '[' = IF
                pop here !
                TRUE copy !
            THEN
            OVER 'r' = IF
                pop EXECUTE
            THEN
        THEN
        0 inp !             ( clear input accum )
        DUP '\r' = IF
            prompt
        THEN
    THEN
    DUP ISHEX IF
        DUP >inp
    THEN
    DUP DEL = IF
        2DROP
    ELSE
        NIP cmd !           ( key -> cmd )
    THEN
    MONITOR ;

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
