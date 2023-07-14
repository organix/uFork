; The "time limit" requestor places a time limit on another requestor.
; The 'timer_dev' is the timer device capability, and the 'time_limit' is the
; time allowed in milliseconds.

; Upon timeout, the 'callback' is sent a message like (#? . reason) where
; 'reason' is the time limit requestor itself.

; Cancellation is not yet supported.

.import
    std: "../std.asm"
    lib: "../lib.asm"
    dev: "../dev.asm"
    delay: "./delay.asm"
    thru: "./thru.asm"

beh:
time_limit_beh:             ; (requestor time_limit timer_dev) <- request
    msg 2                   ; callback
    push lib.once_beh       ; callback once_beh
    new 1                   ; callback'
    msg -2                  ; callback' value
    pick 2                  ; callback' value callback'
    msg 1                   ; callback' value callback' to_cancel
    pair 2                  ; callback' request'=(to_cancel callback' . value)
    state 1                 ; callback' request' requestor
    send -1                 ; callback'
    my self                 ; callback' self
    push #?                 ; callback' self #?
    pair 1                  ; callback' result=(#? . self)
    roll 2                  ; result callback'
    state 2                 ; result callback' time_limit
    state 3                 ; result callback' time_limit timer_dev
    send 3                  ; --
    ref std.commit

; Test suite

boot:                       ; () <- {caps}
    msg 0                   ; {caps}
    push 500                ; {caps} time_limit=500
    push 1000               ; {caps} time_limit delay=1000
    push -42                ; {caps} time_limit delay value=-42
    push test_time_beh      ; {caps} time_limit delay value test_time_beh
    new 3                   ; {caps} test_time_fail
    send -1                 ; --
    msg 0                   ; {caps}
    push 2000               ; {caps} time_limit=2000
    push 1500               ; {caps} time_limit delay=1500
    push 42                 ; {caps} time_limit delay value=42
    push test_time_beh      ; {caps} time_limit delay value test_time_beh
    new 3                   ; {caps} test_time_ok
    send -1                 ; --
    ref std.commit

; Place a time limit on a delay requestor, sending the result to the debug
; device. If the time limit is inadequate, the request fails.

test_time_beh:              ; (value delay time_limit) <- {caps}
    msg 0                   ; {caps}
    push dev.timer_key      ; {caps} timer_key
    dict get                ; timer_dev
    dup 1                   ; timer_dev timer_dev
    state 2                 ; timer_dev timer_dev delay
    push thru.beh           ; timer_dev timer_dev delay thru_beh
    new 0                   ; timer_dev timer_dev delay thru_rq
    push delay.beh          ; timer_dev timer_dev delay thru_rq delay_beh
    new 3                   ; timer_dev delay_rq
    roll 2                  ; delay_rq timer_dev
    state 3                 ; delay_rq timer_dev time_limit
    roll 3                  ; timer_dev time_limit delay_rq
    push time_limit_beh     ; timer_dev time_limit delay_rq time_limit_beh
    new 3                   ; time_limit_rq
    state 1                 ; time_limit_rq value
    msg 0                   ; time_limit_rq value {caps}
    push dev.debug_key      ; time_limit_rq value {caps} debug_key
    dict get                ; time_limit_rq value debug_dev
    push #?                 ; time_limit_rq value debug_dev #?
    pair 2                  ; time_limit_rq request=(#? debug_dev . value)
    roll 2                  ; request time_limit_rq
    ref std.send_msg

.export
    beh
    boot
