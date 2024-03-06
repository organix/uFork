/*

Stack-Effect Encoding for LIFO

*/

`ifndef _lifo_ses_
`define _lifo_ses_

`define NO_SE   (3'h0)      // no operation
`define POP_SE  (3'h1)      // push onto top
`define PUSH_SE (3'h2)      // pop from top
`define RPL_SE  (3'h3)      // replace top
`define SWAP_SE (3'h4)      // swap top and next

`endif
