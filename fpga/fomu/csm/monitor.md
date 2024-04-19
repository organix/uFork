# uCode Monitor

Then run the `screen` program (or equivalent)
to connect to the serial debugging port
at 115200 baud, 8 bits, no parity.

    $ screen /dev/tty.usbserial-AD0JIXTZ 115200

Use the key sequence `Ctrl-a + k` to kill the terminal session.

The monitor starts in _echo_ mode.
for each character sent.
and a hex value will be printed.
`Ctrl-c` terminates _echo_ mode.

Hit `[RETURN]` to get the monitor prompt `> `.
Commands are separated by whitespace,
including `[SPACE]`, `[TAB]`, and `[RETURN]`.

## Monitor Commands

Word    | Monitor Stack Effect      | Description
--------|---------------------------|-----------------------------------
_hex_   | ( -- hex )                | Push _hex_ value onto the stack
/       | ( -- )                    | Ignore input until end of line
@       | ( addr -- data )          | Fetch _data_ from _addr_
.       | ( hex -- )                | Pop top-of-stack and print _hex_
!       | ( data addr -- )          | Store _data_ into _addr_
q       | ( raw -- addr )           | Translate uFork _raw_ to uCode
?       | ( start end -- )          | Print data from _start_ thru _end_
[       | ( addr -- )               | Start copying data to _addr_
]       | ( -- )                    | Stop copying literal data
r       | ( addr -- )               | Run (call) procedure at _addr_

`[BACKSPACE]` or `[DELETE]` may be used
to correct the preceeding word.
