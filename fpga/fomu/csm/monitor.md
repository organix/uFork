# uCode Monitor

Connect to the serial debugging port
and hit `[RETURN]` to get the monitor prompt `> `.
Commands are separated by whitespace,
including `[SPACE]`, `[TAB]`, and `[RETURN]`.

## Monitor Commands

Word    | Monitor Stack Effect      | Description
--------|---------------------------|-----------------------------------
_hex_   | ( -- _hex_ )              | Push _hex_ value onto the stack
@       | ( addr -- data )          | Fetch _data_ from _addr_
.       | ( _hex_ -- )              | Pop top-of-stack and print _hex_
!       | ( data addr -- )          | Store _data_ into _addr_
