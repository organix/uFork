;
; peer chat demo
;

.import
    std: "/lib/std.asm"
    dev: "/lib/dev.asm"

room_key:
    ref 1000

; Start initial services.

start:                  ; (debug_dev io_dev room_id) <- ()
    deque new           ; line
    state 2             ; line io_dev

    state 2             ; ... io_dev
    push line_out       ; ... io_dev line_out
    new 1               ; ... cust=line_out.(io_dev)

    push line_in        ; line io_dev cust line_in
    new 3               ; callback=line_in.(cust io_dev line)

    push #?             ; callback to_cancel=#?
    state 2             ; callback to_cancel io_dev
    send 2              ; --

; The petname of the party hosting the room is passed in the boot capabilities.
; If it is 0, the room is local and we are hosting it. Otherwise the room is
; remote and we are joining it.

    state 3             ; room_id
    state 1             ; room_id debug_dev
    state 3             ; room_id debug_dev room_id
    if join host

; For now, just send the room id to the debug device.

join:                   ; room_id debug_dev
    ref std.send_msg

host:                   ; room_id debug_dev
    ref std.send_msg

; One-at-a-time I/O means 5ms to read + 5ms to write
; which gives a data-rate of 100 cps (visibly slow!).
; If we can avoid idling the run-loop, it should be faster.

echo:                   ; (io_dev debug_dev) <- result
    msg -1              ; error
    if_not echo_w       ; --
    ref std.commit
echo_w:
    msg 1               ; char
    my self             ; char callback=SELF
    push #?             ; char callback to_cancel=#?
    state 1             ; char callback to_cancel io_dev
    send 3              ; --
    state 0             ; (io_dev debug_dev)
    push echo_r         ; (io_dev debug_dev) echo_r
    beh -1              ; --
    ref std.commit

echo_r:                 ; (io_dev debug_dev) <- result
    my self             ; callback=SELF
    push #?             ; callback to_cancel=#?
    state 1             ; callback to_cancel io_dev
    send 2              ; --
    state 0             ; (io_dev debug_dev)
    push echo           ; (io_dev debug_dev) echo
    beh -1              ; --
    ref std.commit

; An infinite loop will consume cycles, but no memory or events

loop_forever:
    dup 0 loop_forever

; The "ticker" sends itself an incrementing number forever.

ticker:                 ; () <- n
    msg 0               ; n
    push 1              ; n 1
    alu add             ; n+1
    my self             ; n+1 SELF
    ref std.send_msg    ; --

; Accumulate characters one-at-a-time until '\n'.
; When a `line` is complete, send it to `cust`.

line_in:                ; (cust io_dev line) <- result
    ; check for error
    msg -1              ; error
    if std.commit       ; --

    ; request next char
    my self             ; callback=SELF
    push #?             ; callback to_cancel=#?
    state 2             ; callback to_cancel io_dev
    send 2              ; --

    ; add char to line
    state 3             ; line
    msg 1               ; line char
    deque put           ; line'

    ; check for newline
    msg 1               ; line' char
    eq '\n'             ; line' char=='\n'
    if_not line_upd     ; line'

    ; send line to cust
    state 1             ; line' cust
    send -1             ; --
    deque new           ; line

line_upd:               ; line'
    ; update state
    state 2             ; line' io_dev
    state 1             ; line' io_dev cust
    my beh              ; line' io_dev cust beh
    beh 3               ; --
    ref std.commit

; Buffer lines of output, sending characters one-at-a-time.
; Initially, no current line or lines to send.

line_out:               ; (io_dev) <- result | line'
    ; distinguish result from line'
    msg 1               ; first
    eq #unit            ; first==#unit
    if std.commit       ; unexpected result!

    ; extract char from line
    msg 0               ; line
    deque pop           ; line' char

line_snd:               ; line' char
    ; send char to output
    my self             ; line' char callback=SELF
    push #?             ; line' char callback to_cancel=#?
    state 1             ; line' char callback to_cancel io_dev
    send 3              ; line'

    ; line empty?
    dup 1               ; line' line'
    deque empty         ; line' is_empty(line')
    if_not line_rem

    ; no more chars in line
    state 1             ; ... io_dev
    push line_out       ; ... io_dev line_out
    beh 1               ; --
    ref std.commit

line_rem:
    ; chars remaining in line
    state 1             ; line' io_dev
    push line_buf       ; line' io_dev line_buf
    beh 2               ; --
    ref std.commit

; Writing current line, no additional lines buffered.

line_buf:               ; (io_dev line) <- result | line'
    ; distinguish result from line'
    msg 1               ; first
    eq #unit            ; first==#unit
    if_not line_add     ; --

    ; extract char from line
    state 2             ; line
    deque pop           ; line' char
    ref line_snd

line_add:
    ;; FIXME: implement additional buffered lines
    ref std.commit

line_out_0:             ; (io_dev line lines) <- result | line'
    ; distinguish result from line'
    msg 1               ; first
    eq #unit            ; first==#unit
    if line_chr

    ; add line' to lines
    state 3             ; lines
    msg 0               ; lines line
    deque put           ; lines'
    state 2             ; lines' line
    state 1             ; lines' line io_dev
    my beh              ; lines' line io_dev beh
    beh 3               ; --
    ref std.commit

line_chr:
    ; extract char from line
    state 3             ; lines
    state 2             ; lines line
    deque pop           ; lines line' char

    ; send char to output
    msg 1               ; lines line' char
    my self             ; lines line' char callback=SELF
    push #?             ; lines line' char callback to_cancel=#?
    state 1             ; lines line' char callback to_cancel io_dev
    send 3              ; lines line'

    ; update state
    state 1             ; lines line' io_dev
    my beh              ; lines line' io_dev beh
    beh 3               ; --
    ref std.commit

; Capture required boot capabilities.

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push room_key       ; {caps} room_key
    dict get            ; room_id

    msg 0               ; room_id {caps}
    push dev.io_key     ; room_id {caps} io_key
    dict get            ; room_id io_dev

    msg 0               ; room_id io_dev {caps}
    push dev.debug_key  ; room_id io_dev {caps} debug_key
    dict get            ; room_id io_dev debug_dev

    push start          ; room_id io_dev debug_dev start
    new 3               ; start.(debug_dev io_dev room_id)
    send 0              ; --
    ref std.commit

.export
    boot
