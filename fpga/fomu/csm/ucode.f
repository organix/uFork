(
    Base word dictionary for uCode
)

32 CONSTANT BL
48 CONSTANT '0'
65 CONSTANT 'A'
97 CONSTANT 'a'

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

: TX? ( -- ready )
    0x00 DEV@ ;
: TX! ( char -- )
    0x01 DEV! ;
: RX? ( -- ready )
    0x02 DEV@ ;
: RX@ ( -- char )
    0x03 DEV@ ;

( WARNING! BOOT should not return... )
: BOOT
    BOOT ;
