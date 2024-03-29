/*

Stack-Effect Encoding for LIFO

*/

`ifndef _lifo_ses_
`define _lifo_ses_

`define NO_SE   (3'h0)      // no operation             ( -- )
`define DROP_SE (3'h1)      // remove top               ( a -- )
`define PUSH_SE (3'h2)      // push onto top            ( -- a )
`define RPLC_SE (3'h3)      // replace top              ( a -- b )
`define SWAP_SE (3'h4)      // swap top and next        ( a b -- b a )
`define ROT3_SE (3'h5)      // rotate top 3 elements    ( a b c -- b c a )
`define RROT_SE (3'h6)      // reverse rotate top 3     ( a b c -- c a b )
`define ALU2_SE (3'h7)      // drop 2, push 1           ( a b -- c )

/*
: NIP ( a b -- b ) SWAP DROP ;
: TUCK ( a b -- b a b ) SWAP OVER ;
: 2DUP ( a b -- a b a b ) OVER OVER ;
: 2DROP ( a b -- ) DROP DROP ;
*/

`endif
