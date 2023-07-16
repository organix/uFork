;
; peer chat demo
;

.import
    std: "/lib/std.asm"
    dev: "/lib/dev.asm"

room_key:
    ref 1000

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

start:                  ; (debug_dev io_dev room_id) <-

boot:                   ; () <- {caps}

; One-at-a-time I/O means 5ms to read + 5ms to write
; which gives a data-rate of 100 cps (visibly slow!).
; If we can avoid idling the run-loop, it should be faster.

    push 0              ; 0
;    push ticker         ; 0 ticker
    push loop_forever   ; 0 loop_forever
    new 0               ; 0 ticker.()
;    send -1             ; --
    drop 2              ; --

; Request the next character from the IO device.

    msg 0               ; debug_dev {caps}
    push dev.io_key     ; debug_dev {caps} io_key
    dict get            ; debug_dev io_dev
    push echo           ; debug_dev io_dev echo
    new 2               ; callback=echo.(io_dev debug_dev)
    push #?             ; callback to_cancel=#?
    msg 0               ; callback to_cancel {caps}
    push dev.io_key     ; callback to_cancel {caps} io_key
    dict get            ; callback to_cancel io_dev
    send 2              ; --

; The petname of the party hosting the room is passed in the boot capabilities.
; If it is 0, the room is local and we are hosting it. Otherwise the room is
; remote and we are joining it.

    msg 0               ; {caps}
    push dev.debug_key  ; {caps} debug_key
    dict get            ; debug_dev
    msg 0               ; debug_dev {caps}
    push room_key       ; debug_dev {caps} room_key
    dict get            ; debug_dev room_petname
    dup 1               ; debug_dev room_petname room_petname
    typeq #fixnum_t     ; debug_dev room_petname typeof(room_petname)==#fixnum_t
    if_not std.commit   ; debug_dev room_petname
    pick 1              ; debug_dev room_petname room_petname
    if join host

; For now, just send the room petname to the debug device.

join:                   ; debug_dev room_petname
    roll 2              ; room_petname debug_dev
    send -1             ; --
    ref std.commit

host:                   ; debug_dev room_petname
    roll 2              ; room_petname debug_dev
    send -1             ; --
    ref std.commit

.export
    boot
