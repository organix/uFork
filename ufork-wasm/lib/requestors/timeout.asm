; The "timeout" requestor places a time limit on another requestor.
; Upon timeout, the callback is sent a failed result like (#? . reason), where
; the reason is the timeout requestor itself.

; The 'timer_dev' is the timer device capability, and the 'time_limit' is the
; time allowed in milliseconds.

.import
    canceller: "./canceller.asm"
    delay: "./delay.asm"
    dev: "../dev.asm"
    lib: "../lib.asm"
    std: "../std.asm"
    thru: "./thru.asm"

beh:
timeout_beh:                ; (requestor time_limit timer_dev) <- request

; Create two cancellers, one for the requestor and one for the timer.

    push canceller.beh      ; canceller_beh
    new 0                   ; t␘=canceller_beh.()
    push canceller.beh      ; t␘ canceller_beh
    new 0                   ; t␘ r␘=canceller_beh.()

; Does the request contain a 'to_cancel' capability? If not, jump to 'race'.

    msg 1                   ; t␘ r␘ to_cancel
    typeq #actor_t          ; t␘ r␘ cap?
    if_not race             ; t␘ r␘

; Create a cancel capability that cancels both the requestor and timer. Send it
; to the 'to_cancel' capability from the request.

    dup 2                   ; t␘ r␘ t␘ r␘
    push cancel_all_beh     ; t␘ r␘ t␘ r␘ cancel_all_beh
    new 2                   ; t␘ r␘ cancel_all=cancel_all_beh.(r␘ t␘)
    msg 1                   ; t␘ r␘ cancel_all to_cancel
    send -1                 ; t␘ r␘

; Set up a race between the requestor and the timer. Whichever finishes first
; sends its result to the callback and cancels the loser.

race:
    msg 2                   ; t␘ r␘ raw_callback
    push lib.once_beh       ; t␘ r␘ raw_callback once_beh
    new 1                   ; t␘ r␘ callback=once_beh.(raw_callback)
    msg -2                  ; t␘ r␘ callback value
    pick 4                  ; t␘ r␘ callback value t␘
    pick 3                  ; t␘ r␘ callback value t␘ callback
    push win_beh            ; t␘ r␘ callback value t␘ callback win_beh
    new 2                   ; t␘ r␘ callback value rcb=win_beh.(callback t␘)
    pick 4                  ; t␘ r␘ callback value rcb r␘
    pair 2                  ; t␘ r␘ callback rreq=(r␘ rcb . value)
    state 1                 ; t␘ r␘ callback rreq requestor
    send -1                 ; t␘ r␘ callback
    my self                 ; t␘ r␘ callback reason=self
    push #?                 ; t␘ r␘ callback reason #?
    pair 1                  ; t␘ r␘ callback result=(#? . reason)
    state 2                 ; t␘ r␘ callback result time_limit
    pick 4                  ; t␘ r␘ callback result time_limit r␘
    pick 4                  ; t␘ r␘ callback result time_limit r␘ callback
    push win_beh            ; t␘ r␘ callback result time_limit r␘ callback win_beh
    new 2                   ; t␘ r␘ callback result time_limit tcb=win_beh.(callback r␘)
    pick 6                  ; t␘ r␘ callback result time_limit tcb t␘
    pair 3                  ; t␘ r␘ callback treq=(t␘ tcb time_limit . result)
    state 3                 ; t␘ r␘ callback treq timer_dev
    send -1                 ; t␘ r␘ callback
    ref std.commit

cancel_all_beh:             ; cancellers <- reason
    state 0                 ; cancellers
    push #nil               ; cancellers #nil
    msg 0                   ; cancellers #nil reason
    pair 1                  ; cancellers (reason)
    push lib.broadcast_beh  ; cancellers (reason) broadcast_beh
    new 1                   ; cancellers broadcast=broadcast_beh.((reason))
    send -1                 ; --
    push std.sink_beh       ; sink_beh
    beh -1                  ; --
    ref std.commit

win_beh:                    ; (callback loser␘) <- (value . reason)
    state 2                 ; loser␘
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
    new 3                   ; {caps} test=test_beh.(value delay time_limit)
    send -1                 ; --

; Scenario 2: the requestor succeeds within the time limit.

    msg 0                   ; {caps}
    push 10000              ; {caps} time_limit=10000
    push 7500               ; {caps} time_limit delay=7500
    push 222                ; {caps} time_limit delay value=222
    push test_beh           ; {caps} time_limit delay value test_beh
    new 3                   ; {caps} test=test_beh.(value delay time_limit)
    send -1                 ; --

; Scenario 3: the operation is cancelled early. There should be no output.

    msg 0                   ; {caps}
    push 2500               ; {caps} cancel_ms=2500
    push 5000               ; {caps} cancel_ms time_limit=5000
    push 5000               ; {caps} cancel_ms time_limit delay=5000
    push 333                ; {caps} cancel_ms time_limit delay value=333
    push test_beh           ; {caps} cancel_ms time_limit delay value test_beh
    new 4                   ; {caps} test=test_beh.(value delay time_limit cancel_ms)
    send -1                 ; --

; Scenario 4: the operation is cancelled after the requestor succeeds.

    msg 0                   ; {caps}
    push 15000              ; {caps} cancel_ms=15000
    push 12500              ; {caps} cancel_ms time_limit=12500
    push 10000              ; {caps} cancel_ms time_limit delay=10000
    push 444                ; {caps} cancel_ms time_limit delay value=444
    push test_beh           ; {caps} cancel_ms time_limit delay value test_beh
    new 4                   ; {caps} test=test_beh.(value delay time_limit cancel_ms)
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
    new 0                   ; timer_dev timer_dev delay_ms thru=thru_beh.()
    push delay.beh          ; timer_dev timer_dev delay_ms thru delay_beh
    new 3                   ; timer_dev delay=delay_beh.(thru delay_ms timer_dev)
    roll 2                  ; delay timer_dev
    state 3                 ; delay timer_dev time_limit
    roll 3                  ; timer_dev time_limit delay
    push timeout_beh        ; timer_dev time_limit delay timeout_beh
    new 3                   ; timeout=timeout_beh.(delay time_limit timer_dev)
    push canceller.beh      ; timeout canceller_beh
    new 0                   ; timeout canceller=canceller_beh.()
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
