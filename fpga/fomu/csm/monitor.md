# uCode Monitor

Connect to the serial debugging port
and hit `[RETURN]` to get the monitor prompt `> `.
Commands are separated by whitespace,
including `[SPACE]`, `[TAB]`, and `[RETURN]`.

## Monitor Commands

Word    | Monitor Stack Effect      | Description
--------|---------------------------|-----------------------------------
_hex_   | ( -- hex )                | Push _hex_ value onto the stack
@       | ( addr -- data )          | Fetch _data_ from _addr_
.       | ( hex -- )                | Pop top-of-stack and print _hex_
!       | ( data addr -- )          | Store _data_ into _addr_
q       | ( raw -- addr )           | Translate uFork _raw_ to uCode
r       | ( addr -- )               | Run (call) procedure at _addr_
/       | ( -- )                    | Ignore input until end of line
