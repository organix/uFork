; Line buffering utilities for the I/O device.

.import
    std: "https://ufork.org/lib/std.asm"
    dev: "https://ufork.org/lib/dev.asm"

; Accumulate characters one-at-a-time until '\n'.
; When a `line` is complete, send it to `cust`.

in_beh:                     ; (cust io_dev . line) <- result
    msg 0                   ; result
    part 1                  ; char ok
    if_not std.commit       ; char

    ; request next char
    push #?                 ; char input=#?
    my self                 ; char input callback=SELF
    push #?                 ; char input callback to_cancel=#?
    pair 2                  ; io_req=(to_cancel callback . input)
    state 2                 ; io_req io_dev
    actor send              ; char

    ; add char to line
    state -2                ; char line
    pick 2                  ; char line char
    deque put               ; char line'

    ; check for newline
    roll 2                  ; line' char
    eq '\n'                 ; line' char=='\n'
    if_not in_upd           ; line'

    ; send line to cust
    state 1                 ; line' cust
    actor send              ; --
    deque new               ; line

in_upd:                     ; line'
    ; update state
    state 2                 ; line' io_dev
    state 1                 ; line' io_dev cust
    pair 2                  ; (cust io_dev . line')
    push in_beh             ; (cust io_dev . line') in_beh
    actor become            ; --
    ref std.commit

; Buffer lines of output, sending characters one-at-a-time.
; Initially, no current line or lines to send.

out_beh:                    ; io_dev <- result | line'
    ; distinguish result from line'
    msg 1                   ; ok
    eq #t                   ; ok==#t
    if std.commit           ; --  // unexpected result!

    state 0                 ; io_dev
    ; extract char from line
    msg 0                   ; io_dev line
    deque pop               ; io_dev line' char

out_snd:                    ; io_dev line' char
    ; send char to output
    my self                 ; io_dev line' char callback=SELF
    push #?                 ; io_dev line' char callback to_cancel=#?
    pair 2                  ; io_dev line' io_req=(to_cancel callback . char)
    pick 3                  ; io_dev line' io_req io_dev
    actor send              ; io_dev line'

    ; line empty?
    dup 1                   ; io_dev line' line'
    deque empty             ; io_dev line' is_empty(line')
    if_not out_rem          ; io_dev line'

    ; no more chars in line
    drop 1                  ; io_dev
    push out_beh            ; io_dev out_beh
    actor become            ; --
    ref std.commit

out_rem:                    ; io_dev line'
    ; chars remaining in line
    roll 2                  ; line' io_dev
    pair 1                  ; (io_dev . line')
    push out_buf            ; (io_dev . line') out_buf
    actor become            ; --
    ref std.commit

; Writing current line, no additional lines buffered.

out_buf:                    ; (io_dev . line) <- result | line'
    ; distinguish result from line'
    msg 1                   ; ok
    eq #t                   ; ok==#t
    if_not out_add          ; --

    state 1                 ; io_dev
    state -1                ; io_dev line
    deque pop               ; io_dev line' char
    ref out_snd

out_add:                    ; --
    ; additional buffered lines
    deque new               ; lines
    msg 0                   ; lines line
    deque put               ; lines'
    state -1                ; lines' line
    state 1                 ; lines' line io_dev
    pair 2                  ; (io_dev line . lines')
    push out_bufs           ; (io_dev line . lines') out_bufs
    actor become            ; --
    ref std.commit

; Writing current line, one or more lines buffered.

out_bufs:                   ; (io_dev line . lines) <- result | line'
    ; distinguish result from line'
    msg 1                   ; ok
    eq #t                   ; ok==#t
    if out_chr              ; --

    ; add line' to lines
    state -2                ; lines
    msg 0                   ; lines line
    deque put               ; lines'
    state 2                 ; lines' line
    state 1                 ; lines' line io_dev
    pair 2                  ; (io_dev line . lines')
    push out_bufs           ; (io_dev line . lines') out_bufs
    actor become            ; --
    ref std.commit

out_chr:                    ; --
    ; extract char from line
    state 2                 ; line
    deque pop               ; line char

    ; send char to output
    my self                 ; line char callback=SELF
    push #?                 ; line char callback to_cancel=#?
    pair 2                  ; line io_req=(to_cancel callback . char)
    state 1                 ; line io_req io_dev
    actor send              ; line

    ; line empty?
    dup 1                   ; line line
    deque empty             ; line is_empty(line)
    if_not out_chrs         ; line

    ; get next line
    drop 1                  ; --
    state -2                ; lines
    deque pop               ; lines line
    pick 2                  ; lines line lines
    deque empty             ; lines line is_empty(lines)
    if_not out_more         ; lines line

    ; no more lines
    state 1                 ; lines line io_dev
    pair 1                  ; lines (io_dev . line)
    push out_buf            ; lines (io_dev . line) out_buf
    actor become            ; lines
    ref std.commit

out_chrs:                   ; line
    ; update state
    state -2                ; line lines
    roll -2                 ; lines line

out_more:                   ; lines line
    state 1                 ; lines line io_dev
    pair 2                  ; (io_dev line . lines)
    push out_bufs           ; (io_dev line . lines) out_bufs
    actor become            ; --
    ref std.commit

in_demo:                    ; io_dev debug_dev
    push #?                 ; io_dev debug_dev input=#?
    deque new               ; io_dev debug_dev input line
    pick 4                  ; io_dev debug_dev input line io_dev
    pick 4                  ; io_dev debug_dev input line io_dev cust=debug_dev
    pair 2                  ; io_dev debug_dev input (cust io_dev . line)
    push in_beh             ; io_dev debug_dev input (cust io_dev . line) in_beh
    actor create            ; io_dev debug_dev input callback=in_beh.(cust io_dev . line)
    push #?                 ; io_dev debug_dev input callback to_cancel=#?
    pair 2                  ; io_dev debug_dev io_req=(to_cancel callback . input)
    pick 3                  ; io_dev debug_dev io_req io_dev
    actor send              ; io_dev debug_dev
    ref std.commit

out_demo:                   ; io_dev debug_dev
    pick 2                  ; io_dev debug_dev io_dev
    push out_beh            ; io_dev debug_dev io_dev out_beh
    actor create            ; io_dev debug_dev out=out_beh.io_dev
    deque new               ; io_dev debug_dev out line
    push '\n'               ; io_dev debug_dev out line '\n'
    deque push              ; io_dev debug_dev out line'
    push 'K'                ; io_dev debug_dev out line' 'K'
    deque push              ; io_dev debug_dev out line''
    push 'O'                ; io_dev debug_dev out line'' 'O'
    deque push              ; io_dev debug_dev out line'''
    pick 2                  ; io_dev debug_dev out line''' out
    actor send              ; io_dev debug_dev out
    ref std.commit

in_out_demo:                ; io_dev debug_dev
    push #?                 ; io_dev debug_dev input=#?
    pick 3                  ; io_dev debug_dev input io_dev
    push out_beh            ; io_dev debug_dev input io_dev out_beh
    actor create            ; io_dev debug_dev input out=out_beh.io_dev
    deque new               ; io_dev debug_dev input out line
    pick 5                  ; io_dev debug_dev input out line io_dev
    roll 3                  ; io_dev debug_dev input line io_dev cust=out
    pair 2                  ; io_dev debug_dev input (cust io_dev . line)
    push in_beh             ; io_dev debug_dev input (cust io_dev . line) in_beh
    actor create            ; io_dev debug_dev input callback=in_beh.(cust io_dev . line)
    push #?                 ; io_dev debug_dev input callback to_cancel=#?
    pair 2                  ; io_dev debug_dev io_req=(to_cancel callback . input)
    pick 3                  ; io_dev debug_dev io_req io_dev
    actor send              ; io_dev debug_dev
    ref std.commit

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.io_key         ; {caps} io_key
    dict get                ; io_dev
    msg 0                   ; io_dev {caps}
    push dev.debug_key      ; io_dev {caps} debug_key
    dict get                ; io_dev debug_dev
    ; ref in_demo
    ; ref out_demo
    ref in_out_demo

.export
    boot
    in_beh
    out_beh
