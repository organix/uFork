; The "delay" requestor behaves just like a given requestor except that the
; request is delayed by a fixed number of milliseconds.

.import
    std: "../std.asm"
    lib: "../lib.asm"
    dev: "../dev.asm"
    thru: "./thru.asm"
    canceller: "./canceller.asm"

beh:
delay_beh:                  ; (requestor delay timer_dev) <- request
    msg -2                  ; value
    state 2                 ; value delay
    msg 2                   ; value delay callback
    msg 1                   ; value delay callback to_cancel
    state 3                 ; value delay callback to_cancel timer_dev
    send 4                  ; --
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
    new 0                   ; request thru=thru_beh.()
    msg 0                   ; request thru {caps}
    push dev.timer_key      ; request thru {caps} timer_key
    dict get                ; request thru timer_dev
    push 1000               ; request thru timer_dev delay=1000ms
    roll 3                  ; request timer_dev delay thru
    push delay_beh          ; request timer_dev delay thru delay_beh
    new 3                   ; request delay=delay_beh.(thru delay timer_dev)
    ref std.send_msg

test:                       ; (verdict) <- {caps}
    push #t                 ; value=#t
    state 1                 ; value verdict
    push lib.unwrap_beh     ; value verdict unwrap_beh
    new 1                   ; value callback=unwrap_beh.(verdict)
    push #?                 ; value callback to_cancel=#?
    pair 2                  ; request=(to_cancel callback . value)
    push thru.beh           ; request thru_beh
    new 0                   ; request thru=thru_beh.()
    msg 0                   ; request thru {caps}
    push dev.timer_key      ; request thru {caps} timer_key
    dict get                ; request thru timer_dev
    push 10                 ; request thru timer_dev delay=10ms
    roll 3                  ; request timer_dev delay thru
    push delay_beh          ; request timer_dev delay thru delay_beh
    new 3                   ; request delay=delay_beh.(thru delay timer_dev)
    ref std.send_msg

.export
    beh
    boot
    test
