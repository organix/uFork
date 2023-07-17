; The "timeout" requestor places a time limit on another requestor.
; Upon timeout, the callback is sent a failed result like (#? . reason), where
; the reason is the timeout requestor itself.

; The 'timer_dev' is the timer device capability, and the 'time_limit' is the
; time allowed in milliseconds.

.import
    std: "../std.asm"
    lib: "../lib.asm"
    dev: "../dev.asm"
    canceller: "./canceller.asm"
    delay: "./delay.asm"
    thru: "./thru.asm"

beh:
timeout_beh:                ; (requestor time_limit timer_dev) <- request
    push canceller.beh      ; canceller_beh
    new 0                   ; tc
    push canceller.beh      ; tc canceller_beh
    new 0                   ; tc rc
    msg 1                   ; tc rc to_cancel
    typeq #actor_t          ; tc rc cap?
    if_not race             ; tc rc
    dup 2                   ; tc rc tc rc
    push cancel_all_beh     ; tc rc tc rc cancel_all_beh
    new 2                   ; tc rc cancel_all
    msg 1                   ; tc rc cancel_all to_cancel
    send -1                 ; tc rc
race:
    msg 2                   ; tc rc cb
    push lib.once_beh       ; tc rc cb once_beh
    new 1                   ; tc rc cb'
    msg -2                  ; tc rc cb' value
    pick 4                  ; tc rc cb' value tc
    pick 3                  ; tc rc cb' value tc cb'
    push win_beh            ; tc rc cb' value tc cb' win_beh
    new 2                   ; tc rc cb' value rcb
    pick 4                  ; tc rc cb' value rcb rc
    pair 2                  ; tc rc cb' rreq=(rc rcb . value)
    state 1                 ; tc rc cb' rreq requestor
    send -1                 ; tc rc cb'
    my self                 ; tc rc cb' self
    push #?                 ; tc rc cb' self #?
    pair 1                  ; tc rc cb' result=(#? . self)
    state 2                 ; tc rc cb' result time_limit
    pick 4                  ; tc rc cb' result time_limit rc
    pick 4                  ; tc rc cb' result time_limit rc cb'
    push win_beh            ; tc rc cb' result time_limit rc cb' win_beh
    new 2                   ; tc rc cb' result time_limit tcb
    pick 6                  ; tc rc cb' result time_limit tcb tc
    pair 3                  ; tc rc cb' treq=(tc tcb time_limit . result)
    state 3                 ; tc rc cb' treq timer_dev
    send -1                 ; tc rc cb'
    ref std.commit

cancel_all_beh:             ; cancellers <- reason
    state 0                 ; cancellers
    push #nil               ; cancellers #nil
    msg 0                   ; cancellers #nil reason
    pair 1                  ; cancellers (reason)
    push lib.broadcast_beh  ; cancellers (reason) broadcast_beh
    new 1                   ; cancellers broadcast
    send -1                 ; --
    push std.sink_beh       ; sink_beh
    beh -1                  ; --
    ref std.commit

win_beh:                    ; (callback loser_canceller) <- (value . reason)
    state 2                 ; loser_canceller
    send 0                  ; --
    msg 0                   ; (value . reason)
    state 1                 ; (value . reason) callback
    ref std.send_msg

; Test suite

boot:                       ; () <- {caps}

; Scenario 1: there is a timeout before the requestor can succeed.

    msg 0                   ; {caps}
    push 5000               ; {caps} time_limit=5000
    push 10000              ; {caps} time_limit delay=10000
    push 111                ; {caps} time_limit delay value=111
    push test_beh           ; {caps} time_limit delay value test_beh
    new 3                   ; {caps} test
    send -1                 ; --

; Scenario 2: the requestor succeeds within the time limit.

    msg 0                   ; {caps}
    push 10000              ; {caps} time_limit=10000
    push 7500               ; {caps} time_limit delay=7500
    push 222                ; {caps} time_limit delay value=222
    push test_beh           ; {caps} time_limit delay value test_beh
    new 3                   ; {caps} test
    send -1                 ; --

; Scenario 3: the operation is cancelled early. There should be no output.

    msg 0                   ; {caps}
    push 2500               ; {caps} cancel_ms=2500
    push 5000               ; {caps} cancel_ms time_limit=5000
    push 5000               ; {caps} cancel_ms time_limit delay=5000
    push 333                ; {caps} cancel_ms time_limit delay value=333
    push test_beh           ; {caps} cancel_ms time_limit delay value test_beh
    new 4                   ; {caps} test
    send -1                 ; --

; Scenario 4: the operation is cancelled after the requestor succeeds.

    msg 0                   ; {caps}
    push 15000              ; {caps} cancel_ms=15000
    push 12500              ; {caps} cancel_ms time_limit=12500
    push 10000              ; {caps} cancel_ms time_limit delay=10000
    push 444                ; {caps} cancel_ms time_limit delay value=444
    push test_beh           ; {caps} cancel_ms time_limit delay value test_beh
    new 4                   ; {caps} test
    send -1                 ; --

; The debug device's output, in order, should resemble:

;   (#? . @600...)
;   (222)
;   (444)

    ref std.commit

; Place a time limit on a delay requestor, sending the result to the debug
; device.
; If the time limit is inadequate, the request fails.
; If the request is cancelled early, the callback is never called.

test_beh:                   ; (value delay_ms time_limit cancel_ms) <- {caps}
    msg 0                   ; {caps}
    push dev.timer_key      ; {caps} timer_key
    dict get                ; timer_dev
    dup 1                   ; timer_dev timer_dev
    state 2                 ; timer_dev timer_dev delay_ms
    push thru.beh           ; timer_dev timer_dev delay_ms thru_beh
    new 0                   ; timer_dev timer_dev delay_ms thru
    push delay.beh          ; timer_dev timer_dev delay_ms thru delay_beh
    new 3                   ; timer_dev delay
    roll 2                  ; delay timer_dev
    state 3                 ; delay timer_dev time_limit
    roll 3                  ; timer_dev time_limit delay
    push timeout_beh        ; timer_dev time_limit delay timeout_beh
    new 3                   ; timeout
    push canceller.beh      ; timeout canceller_beh
    new 0                   ; timeout canceller
    state 1                 ; timeout canceller value
    msg 0                   ; timeout canceller value {caps}
    push dev.debug_key      ; timeout canceller value {caps} debug_key
    dict get                ; timeout canceller value debug_dev
    pick 3                  ; timeout canceller value debug_dev canceller
    pair 2                  ; timeout canceller request=(canceller debug_dev . value)
    roll 3                  ; canceller request timeout
    send -1                 ; canceller
    state 4                 ; canceller cancel_ms
    dup 1                   ; canceller cancel_ms cancel_ms
    typeq #fixnum_t         ; canceller cancel_ms do_cancel?
    if_not std.commit
    msg 0                   ; canceller cancel_ms {caps}
    push dev.timer_key      ; canceller cancel_ms {caps} timer_key
    dict get                ; canceller cancel_ms timer_dev
    send 2
    ref std.commit

.export
    beh
    boot
