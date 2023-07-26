; The "timeout" requestor places a time limit on another requestor.
; Upon timeout, the callback is sent a failed result like (#? . error), where
; the error is the timeout requestor itself.

; The 'timer_dev' is the timer device capability, and the 'time_limit' is the
; time allowed in milliseconds.

.import
    canceller: "./canceller.asm"
    delay: "./delay.asm"
    dev: "../dev.asm"
    lib: "../lib.asm"
    std: "../std.asm"
    thru: "./thru.asm"
    referee: "../testing/referee.asm"

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
    my self                 ; t␘ r␘ callback error=self
    push #?                 ; t␘ r␘ callback error #?
    pair 1                  ; t␘ r␘ callback result=(#? . error)
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

win_beh:                    ; (callback loser␘) <- (value . error)
    state 2                 ; loser␘
    send 0                  ; --
    msg 0                   ; (value . error)
    state 1                 ; (value . error) callback
    ref std.send_msg

; Test suite

boot:                       ; () <- {caps}

; The debug device's output, in order, should resemble:

;   (#? . @600...)
;   (222)
;   (444)

    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; debug
    msg 0                   ; debug {caps}
    push dev.timer_key      ; debug {caps} timer_key
    dict get                ; debug timer
    ref suite

test:                       ; (verdict) <- {caps}
    msg 0                   ; {caps}
    push dev.timer_key      ; {caps} timer_key
    dict get                ; timer
    push 444                ; timer 3rd=444
    push 222                ; timer 3rd 2nd=222
    push #?                 ; timer 3rd 2nd 1st=#?
    push 100                ; timer 3rd 2nd 1st probation=100ms
    pick 5                  ; timer 3rd 2nd 1st probation timer
    state 1                 ; timer 3rd 2nd 1st probation timer verdict
    push referee.beh        ; timer 3rd 2nd 1st probation timer verdict referee_beh
    new 6                   ; timer referee

; The referee is not able to compare two lists, to unwrap the result before
; giving it to the referee.

    push lib.unwrap_beh     ; timer referee unwrap_beh
    new 1                   ; timer referee'
    roll 2                  ; referee' timer
suite:

; Scenario 1: there is a timeout before the requestor can succeed.

    push 50                 ; ... time_limit=50
    push 100                ; ... time_limit delay=100
    push 111                ; ... time_limit delay value=111
    pick 4                  ; ... time_limit delay value timer
    pick 6                  ; ... time_limit delay value timer referee
    push test_beh           ; ... time_limit delay value timer referee test_beh
    new 5                   ; ... test=test_beh.(referee timer value delay time_limit)
    send 0                  ; ...

; Scenario 2: the requestor succeeds within the time limit.

    push 100                ; ... time_limit=100
    push 75                 ; ... time_limit delay=75
    push 222                ; ... time_limit delay value=222
    pick 4                  ; ... time_limit delay value timer
    pick 6                  ; ... time_limit delay value timer referee
    push test_beh           ; ... time_limit delay value timer referee test_beh
    new 5                   ; ... test=test_beh.(referee timer value delay time_limit)
    send 0                  ; ...

; Scenario 3: the operation is cancelled early. There should be no output.

    push 25                 ; ... cancel_ms=25
    push 50                 ; ... cancel_ms time_limit=50
    push 50                 ; ... cancel_ms time_limit delay=50
    push 333                ; ... cancel_ms time_limit delay value=333
    pick 5                  ; ... cancel_ms time_limit delay value timer
    pick 7                  ; ... cancel_ms time_limit delay value timer referee
    push test_beh           ; ... cancel_ms time_limit delay value timer referee test_beh
    new 6                   ; ... test=test_beh.(referee timer value delay time_limit cancel_ms)
    send 0                  ; ...

; Scenario 4: the operation is cancelled after the requestor succeeds.

    push 150                ; ... cancel_ms=150
    push 125                ; ... cancel_ms time_limit=125
    push 100                ; ... cancel_ms time_limit delay=100
    push 444                ; ... cancel_ms time_limit delay value=444
    pick 5                  ; ... cancel_ms time_limit delay value timer
    pick 7                  ; ... cancel_ms time_limit delay value timer referee
    push test_beh           ; ... cancel_ms time_limit delay value timer referee test_beh
    new 6                   ; ... test=test_beh.(referee timer value delay time_limit cancel_ms)
    send 0                  ; ...
    ref std.commit

; Place a time limit on a delay requestor, sending the result to the debug
; device.
; If the time limit is inadequate, the request fails.
; If the request is cancelled early, the callback is never called.

test_beh:                   ; (referee timer value delay_ms time_limit cancel_ms) <- ()
    state 2                 ; timer
    state 4                 ; timer delay_ms
    push thru.beh           ; timer delay_ms thru_beh
    new 0                   ; timer delay_ms thru=thru_beh.()
    push delay.beh          ; timer delay_ms thru delay_beh
    new 3                   ; delay=delay_beh.(thru delay_ms timer)
    state 2                 ; delay timer
    state 5                 ; delay timer time_limit
    roll 3                  ; timer time_limit delay
    push timeout_beh        ; timer time_limit delay timeout_beh
    new 3                   ; timeout=timeout_beh.(delay time_limit timer)
    push canceller.beh      ; timeout canceller_beh
    new 0                   ; timeout canceller=canceller_beh.()
    state 3                 ; timeout canceller value
    state 1                 ; timeout canceller value referee
    pick 3                  ; timeout canceller value referee canceller
    pair 2                  ; timeout canceller request=(canceller referee . value)
    roll 3                  ; canceller request timeout
    send -1                 ; canceller
    state 6                 ; canceller cancel_ms
    dup 1                   ; canceller cancel_ms cancel_ms
    typeq #fixnum_t         ; canceller cancel_ms do_cancel?
    if_not std.commit       ; canceller cancel_ms
    state 2                 ; canceller cancel_ms timer
    send 2                  ; --
    ref std.commit

.export
    beh
    boot
    test
