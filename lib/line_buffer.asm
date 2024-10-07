; Line buffering utilities for the I/O device.

.import
    std: "https://ufork.org/lib/std.asm"
    dev: "https://ufork.org/lib/dev.asm"

; Accumulate characters one-at-a-time until '\n'.
; When a `line` is complete, send it to `cust`.

in_beh:                     ; (cust io_dev line) <- result
    msg 0                   ; result
    part 1                  ; char ok
    if_not std.commit       ; char

    ; request next char
    my self                 ; char callback=SELF
    push #?                 ; char callback to_cancel=#?
    state 2                 ; char callback to_cancel io_dev
    send 2                  ; char

    ; add char to line
    state 3                 ; char line
    pick 2                  ; char line char
    deque put               ; char line'

    ; check for newline
    roll 2                  ; line' char
    eq '\n'                 ; line' char=='\n'
    if_not in_upd           ; line'

    ; send line to cust
    state 1                 ; line' cust
    send -1                 ; --
    deque new               ; line

in_upd:                     ; line'
    ; update state
    state 2                 ; line' io_dev
    state 1                 ; line' io_dev cust
    my beh                  ; line' io_dev cust beh
    beh 3                   ; --
    ref std.commit

; Buffer lines of output, sending characters one-at-a-time.
; Initially, no current line or lines to send.

out_beh:                    ; (io_dev) <- result | line'
    ; distinguish result from line'
    msg 1                   ; ok
    eq #t                   ; ok==#t
    if std.commit           ; --  // unexpected result!

    ; extract char from line
    msg 0                   ; line
    deque pop               ; line' char

out_snd:                    ; line' char
    ; send char to output
    my self                 ; line' char callback=SELF
    push #?                 ; line' char callback to_cancel=#?
    state 1                 ; line' char callback to_cancel io_dev
    send 3                  ; line'

    ; line empty?
    dup 1                   ; line' line'
    deque empty             ; line' is_empty(line')
    if_not out_rem          ; line'

    ; no more chars in line
    state 1                 ; io_dev
    push out_beh            ; io_dev out_beh
    beh 1                   ; --
    ref std.commit

out_rem:                    ; line'
    ; chars remaining in line
    state 1                 ; line' io_dev
    push out_buf            ; line' io_dev out_buf
    beh 2                   ; --
    ref std.commit

; Writing current line, no additional lines buffered.

out_buf:                    ; (io_dev line) <- result | line'
    ; distinguish result from line'
    msg 1                   ; ok
    eq #t                   ; ok==#t
    if_not out_add          ; --

    ; extract char from line
    state 2                 ; line
    deque pop               ; line' char
    ref out_snd

out_add:                    ; --
    ; additional buffered lines
    deque new               ; lines
    msg 0                   ; lines line
    deque put               ; lines'
    my state                ; lines' line io_dev
    push out_bufs           ; lines' line io_dev out_bufs
    beh 3                   ; --
    ref std.commit

; Writing current line, one or more lines buffered.

out_bufs:                   ; (io_dev line lines) <- result | line'
    ; distinguish result from line'
    msg 1                   ; ok
    eq #t                   ; ok==#t
    if out_chr              ; --

    ; add line' to lines
    state 3                 ; lines
    msg 0                   ; lines line
    deque put               ; lines'
    state 2                 ; lines' line
    state 1                 ; lines' line io_dev
    push out_bufs           ; lines' line io_dev out_bufs
    beh 3                   ; --
    ref std.commit

out_chr:                    ; --
    ; extract char from line
    state 2                 ; line
    deque pop               ; line char

    ; send char to output
    my self                 ; line char callback=SELF
    push #?                 ; line char callback to_cancel=#?
    state 1                 ; line char callback to_cancel io_dev
    send 3                  ; line

    ; line empty?
    dup 1                   ; line line
    deque empty             ; line is_empty(line)
    if_not out_chrs         ; line

    ; get next line
    drop 1                  ; --
    state 3                 ; lines
    deque pop               ; lines line
    pick 2                  ; lines line lines
    deque empty             ; lines line is_empty(lines)
    if_not out_more         ; lines line

    ; no more lines
    state 1                 ; lines line io_dev
    push out_buf            ; lines line io_dev out_buf
    beh 2                   ; lines
    ref std.commit

out_chrs:                   ; line
    ; update state
    state 3                 ; line lines
    roll -2                 ; lines line

out_more:                   ; lines line
    state 1                 ; lines line io_dev
    push out_bufs           ; lines line io_dev out_bufs
    beh 3                   ; --
    ref std.commit

in_demo:                    ; io_dev debug_dev
    deque new               ; io_dev debug_dev line
    pick 3                  ; io_dev debug_dev line io_dev
    pick 3                  ; io_dev debug_dev line io_dev cust=debug_dev
    push in_beh             ; io_dev debug_dev line io_dev cust in_beh
    new 3                   ; io_dev debug_dev in=in_beh.(cust io_dev line)
    push #?                 ; io_dev debug_dev callback=in to_cancel=#?
    pick 4                  ; io_dev debug_dev callback to_cancel io_dev
    send 2                  ; io_dev debug_dev
    ref std.commit

out_demo:                   ; io_dev debug_dev
    pick 2                  ; io_dev debug_dev io_dev
    push out_beh            ; io_dev debug_dev io_dev out_beh
    new 1                   ; io_dev debug_dev out=out_beh.(io_dev)
    deque new               ; io_dev debug_dev out line
    push '\n'               ; io_dev debug_dev out line '\n'
    deque push              ; io_dev debug_dev out line'
    push 'K'                ; io_dev debug_dev out line' 'K'
    deque push              ; io_dev debug_dev out line''
    push 'O'                ; io_dev debug_dev out line'' 'O'
    deque push              ; io_dev debug_dev out line'''
    pick 2                  ; io_dev debug_dev out line''' out
    send -1                 ; io_dev debug_dev out
    ref std.commit

in_out_demo:                ; io_dev debug_dev
    pick 2                  ; io_dev debug_dev io_dev
    push out_beh            ; io_dev debug_dev io_dev out_beh
    new 1                   ; io_dev debug_dev out=out_beh.(io_dev)
    deque new               ; io_dev debug_dev out line
    pick 4                  ; io_dev debug_dev out line io_dev
    roll 3                  ; io_dev debug_dev line io_dev cust=out
    push in_beh             ; io_dev debug_dev line io_dev cust in_beh
    new 3                   ; io_dev debug_dev in=in_beh.(cust io_dev line)
    push #?                 ; io_dev debug_dev callback=in to_cancel=#?
    pick 4                  ; io_dev debug_dev callback to_cancel io_dev
    send 2                  ; io_dev debug_dev
    ref std.commit

boot:                       ; () <- {caps}
    msg 0                   ; {caps}
    push dev.io_key         ; {caps} io_key
    dict get                ; io_dev
    msg 0                   ; io_dev {caps}
    push dev.debug_key      ; io_dev {caps} debug_key
    dict get                ; io_dev debug_dev
;     ref in_demo
;     ref out_demo
    ref in_out_demo

.export
    boot
    in_beh
    out_beh
