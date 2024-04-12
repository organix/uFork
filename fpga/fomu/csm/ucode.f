: NIP ( a b -- b )
    SWAP DROP ;
: TUCK ( a b -- b a b )
    SWAP OVER ;
: 2DUP ( a b -- a b a b )
    OVER OVER ;
: 2DROP ( a b -- )
    DROP DROP ;
: ?: ( altn cnsq cond -- cnqs | altn )
    SKZ SWAP
    DROP ;
: NOT ( flag -- !flag )
    TRUE FALSE ROT ?: ;

( WARNING! BOOT should not return... )
: BOOT
    R> DROP BOOT
