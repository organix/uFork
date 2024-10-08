; The "delay" requestor produces its input value after a fixed number of
; milliseconds.

.import
    std: "../std.asm"
    lib: "../lib.asm"
    dev: "../dev.asm"

beh:
delay_beh:                  ; (delay timer_dev) <- request
    msg -2                  ; value
    push #t                 ; value ok=#t
    pair 1                  ; result=(ok . value)
    state 1                 ; result delay
    msg 2                   ; result delay callback
    msg 1                   ; result delay callback to_cancel
    pair 3                  ; request'=(to_cancel callback delay . result)
    state 2                 ; request' timer_dev
    ref std.send_msg

; Test suite

boot:                       ; () <- {caps}
    push 42                 ; value=42
    msg 0                   ; value {caps}
    push dev.debug_key      ; value {caps} debug_key
    dict get                ; value debug_dev
    ref suite

test:                       ; (verdict) <- {caps}
    push #t                 ; value=#t
    state 1                 ; value verdict
    push lib.unwrap_beh     ; value verdict unwrap_beh
    new 1                   ; value callback=unwrap_beh.(verdict)
suite:
    push #?                 ; value callback to_cancel=#?
    pair 2                  ; request=(to_cancel callback . value)
    msg 0                   ; request {caps}
    push dev.timer_key      ; request {caps} timer_key
    dict get                ; request timer_dev
    push 1000               ; request timer_dev delay=1000ms
    push delay_beh          ; request timer_dev delay delay_beh
    new 2                   ; request delay=delay_beh.(delay timer_dev)
    ref std.send_msg

.export
    beh
    boot
    test
