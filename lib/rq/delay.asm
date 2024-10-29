; The "delay" requestor produces its input value after a fixed number of
; milliseconds.

.import
    std: "../std.asm"
    dev: "../dev.asm"

beh:
delay_beh:                  ; (delay . timer_dev) <- request
    msg -2                  ; value
    push #t                 ; value ok=#t
    pair 1                  ; result=(ok . value)
    state 1                 ; result delay
    msg 2                   ; result delay callback
    msg 1                   ; result delay callback to_cancel
    pair 3                  ; request'=(to_cancel callback delay . result)
    state -1                ; request' timer_dev
    ref std.send_msg

; Test suite

boot:                       ; _ <- {caps}
    push 42                 ; value=42
    msg 0                   ; value {caps}
    push dev.debug_key      ; value {caps} debug_key
    dict get                ; value debug_dev
    ref suite

unwrap_beh:                 ; rcvr <- (msg . _)
    msg 1                   ; msg
    state 0                 ; msg rcvr
    ref std.send_msg
test:                       ; judge <- {caps}
    push #t                 ; value=#t
    state 0                 ; value judge
    push unwrap_beh         ; value judge unwrap_beh
    actor create            ; value callback=unwrap_beh.judge
suite:
    push #?                 ; value callback to_cancel=#?
    pair 2                  ; request=(to_cancel callback . value)
    msg 0                   ; request {caps}
    push dev.timer_key      ; request {caps} timer_key
    dict get                ; request timer_dev
    push 1000               ; request timer_dev delay=1000ms
    pair 1                  ; request (delay . timer_dev)
    push delay_beh          ; request (delay . timer_dev) delay_beh
    actor create            ; request delay=delay_beh.(delay . timer_dev)
    ref std.send_msg

.export
    beh
    boot
    test
