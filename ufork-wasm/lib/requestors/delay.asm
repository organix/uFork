; The "delay" requestor behaves just like a given requestor except that the
; request is delayed by a fixed number of milliseconds.

; It does not currently support cancellation.

.import
    std: "../std.asm"
    dev: "../dev.asm"
    thru: "./thru.asm"

beh:
delay_beh:                  ; (requestor delay timer_dev) <- request
    msg 0                   ; request
    state 1                 ; request requestor
    state 2                 ; request requestor delay
    state 3                 ; request requestor delay timer_dev
    send 3                  ; --
    ref std.commit

; Test suite

boot:                       ; () <- {caps}
    push 42                 ; 42
    msg 0                   ; 42 {caps}
    push dev.debug_key      ; 42 {caps} debug_key
    dict get                ; 42 debug_dev
    push #?                 ; 42 debug_dev to_cancel=#?
    pair 2                  ; request=(#? debug_dev . 42)
    push thru.beh           ; request thru_beh
    new 0                   ; request thru
    msg 0                   ; request thru {caps}
    push dev.timer_key      ; request thru {caps} timer_key
    dict get                ; request thru timer_dev
    push 1000               ; request thru timer_dev delay=1000ms
    roll 3                  ; request timer_dev delay thru
    push delay_beh          ; request timer_dev delay thru delay_beh
    new 3                   ; request delay
    ref std.send_msg

.export
    beh
    boot
