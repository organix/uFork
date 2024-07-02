# uCode Monitor

Then run the `screen` program (or equivalent)
and connect to the serial debugging port
at 115200 baud, 8 bits, no parity.

    $ screen /dev/tty.usbserial-AD0JIXTZ 115200

Use the key sequence `Ctrl-a + k` to kill the terminal session.

The monitor starts in _echo_ mode.
For each character sent,
a hex value will be printed.
`Ctrl-c` terminates _echo_ mode.

Hit `[RETURN]` to get the monitor prompt `> `.
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
?       | ( start end -- )          | Print data from _start_ thru _end_
[       | ( addr -- )               | Start copying data to _addr_
]       | ( -- addr+len )           | Stop copying literal data
r       | ( addr -- )               | Run (call) procedure at _addr_

`[BACKSPACE]` or `[DELETE]` may be used
to correct the preceeding word.

### Bulk Upload

The `[` and `]` commands provide a bulk upload facility.
During upload, data is still provided as hex values, but not echoed.
Instead a `~` is printed each time
the least significant 4 bits of the upload address are `0`
(every 16 words).
If a `/` is encountered, input is ignored until the end of the line.
The `]` signals the end of the upload
and leaves the final address on the stack.

## Address Ranges

The address ranges for uFork and uCode are different
(although both are 16 bits wide).
uFork cannot address uCode program/data memory.
uCode must be able to access uFork memory
as well as it's own uCode program/data space.
uFork values are type-tagged,
and include non-address _fixnums_.
The following table illustrates the mapping
between uFork and uCode addresses.

uFork Address           | uCode Address         | Description
------------------------|-----------------------|------------------------
`1snn_nnnn_nnnn_nnnn`   | _no mapping_          | uFork 15-bit _fixnum_
`00xb_aaaa_aaaa_aaaa`   | `1baa_aaaa_aaaa_aaff` | uFork quad-space ROM
`01cx_aaaa_aaaa_aaaa`   | `01aa_aaaa_aaaa_aaff` | uFork quad-space RAM
_not applicable_        | `00xx_aaaa_aaaa_aaaa` | uCode program/data

uFork addresses designate quad-memory cells (4 16-bit words).
uCode addresses designate 16-bit words (1 quad field).
The bottom 2 bits of a uCode address into uFork quad-memory
designates the field of the quad
{T:`00`, X:`01`, Y:`10`, Z:`11`}.
