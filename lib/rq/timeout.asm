; The "timeout" requestor places a time limit on another requestor.
; Upon timeout, the callback is sent a failed result whose error is the
; timeout requestor itself.

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
    unwrap_result: "./unwrap_result.asm"

beh:
timeout_beh:                ; (requestor time_limit . timer_dev) <- request

; Create two cancellers, one for the requestor and one for the timer.

    push #?                 ; #?
    push canceller.beh      ; #? canceller_beh
    new -1                  ; t␘=canceller_beh.#?
    push #?                 ; t␘ #?
    push canceller.beh      ; t␘ #? canceller_beh
    new -1                  ; t␘ r␘=canceller_beh.#?

; Does the request contain a 'to_cancel' capability? If not, jump to 'race'.

    msg 1                   ; t␘ r␘ to_cancel
    typeq #actor_t          ; t␘ r␘ cap?
    if_not race             ; t␘ r␘

; Create a cancel capability that cancels both the requestor and timer. Send it
; to the 'to_cancel' capability from the request.

    push #nil               ; t␘ r␘ ()
    pick 3                  ; t␘ r␘ () t␘
    pick 3                  ; t␘ r␘ () t␘ r␘
    pair 2                  ; t␘ r␘ (r␘ t␘)
    push cancel_all_beh     ; t␘ r␘ (r␘ t␘) cancel_all_beh
    new -1                  ; t␘ r␘ cancel_all=cancel_all_beh.(r␘ t␘)
    msg 1                   ; t␘ r␘ cancel_all to_cancel
    send -1                 ; t␘ r␘

; Set up a race between the requestor and the timer. Whichever finishes first
; sends its result to the callback and cancels the loser.

race:
    msg 2                   ; t␘ r␘ raw_callback
    push lib.once_beh       ; t␘ r␘ raw_callback once_beh
    new -1                  ; t␘ r␘ callback=once_beh.raw_callback
    msg -2                  ; t␘ r␘ callback value
    pick 4                  ; t␘ r␘ callback value t␘
    pick 3                  ; t␘ r␘ callback value t␘ callback
    pair 1                  ; t␘ r␘ callback value (callback . t␘)
    push win_beh            ; t␘ r␘ callback value (callback . t␘) win_beh
    new -1                  ; t␘ r␘ callback value rcb=win_beh.(callback . t␘)
    pick 4                  ; t␘ r␘ callback value rcb r␘
    pair 2                  ; t␘ r␘ callback rreq=(r␘ rcb . value)
    state 1                 ; t␘ r␘ callback rreq requestor
    send -1                 ; t␘ r␘ callback
    my self                 ; t␘ r␘ callback error=self
    push #f                 ; t␘ r␘ callback error ok=#f
    pair 1                  ; t␘ r␘ callback result=(ok . error)
    state 2                 ; t␘ r␘ callback result time_limit
    pick 4                  ; t␘ r␘ callback result time_limit r␘
    pick 4                  ; t␘ r␘ callback result time_limit r␘ callback
    pair 1                  ; t␘ r␘ callback result time_limit (callback . r␘)
    push win_beh            ; t␘ r␘ callback result time_limit (callback . r␘) win_beh
    new -1                  ; t␘ r␘ callback result time_limit tcb=win_beh.(callback . r␘)
    pick 6                  ; t␘ r␘ callback result time_limit tcb t␘
    pair 3                  ; t␘ r␘ callback treq=(t␘ tcb time_limit . result)
    state -2                ; t␘ r␘ callback treq timer_dev
    send -1                 ; t␘ r␘ callback
    ref std.commit

cancel_all_beh:             ; cancellers <- reason
    state 0                 ; cancellers
    push #nil               ; cancellers ()
    msg 0                   ; cancellers () reason
    pair 1                  ; cancellers (reason)
    push lib.broadcast_beh  ; cancellers (reason) broadcast_beh
    new -1                  ; cancellers broadcast=broadcast_beh.(reason)
    send -1                 ; --
    push std.sink_beh       ; sink_beh
    beh -1                  ; --
    ref std.commit

win_beh:                    ; (callback . loser␘) <- result
    push #?                 ; #?
    state -1                ; #? loser␘
    send -1                 ; --
    msg 0                   ; result
    state 1                 ; result callback
    ref std.send_msg

; Test suite

boot:                       ; () <- {caps}

; The debug device's output, in order, should resemble:

;   (#f . @600...)
;   (#t . +222)
;   (#t . +444)

    msg 0                   ; {caps}
    push dev.timer_key      ; {caps} timer_key
    dict get                ; timer
    msg 0                   ; timer {caps}
    push dev.debug_key      ; timer {caps} debug_key
    dict get                ; timer debug
    ref suite

test:                       ; judge <- {caps}
    msg 0                   ; {caps}
    push dev.timer_key      ; {caps} timer_key
    dict get                ; timer
    push #nil               ; timer ()
    push 444                ; timer () 3rd=444
    push 222                ; timer () 3rd 2nd=222
    push #?                 ; timer () 3rd 2nd 1st=#?
    push 100                ; timer () 3rd 2nd 1st probation=100ms
    pick 6                  ; timer () 3rd 2nd 1st probation timer
    state 0                 ; timer () 3rd 2nd 1st probation timer judge
    pair 6                  ; timer (judge timer probation 1st 2nd 3rd)
    push referee.beh        ; timer (judge timer probation 1st 2nd 3rd) referee_beh
    new -1                  ; timer referee=referee_beh.(judge timer probation 1st 2nd 3rd)

; The referee is not able to compare two lists, so unwrap the result before
; giving it to the referee.

    push unwrap_result.beh  ; timer referee unwrap_result_beh
    new -1                  ; timer referee'=unwrap_result_beh.referee
suite:

; Scenario 1: there is a timeout before the requestor can succeed.

    dup 2                   ; ... timer referee
    push #?                 ; ... timer referee cancel_ms=#?
    push 50                 ; ... timer referee cancel_ms time_limit=50
    push 100                ; ... timer referee cancel_ms time_limit delay_ms=100
    push 111                ; ... timer referee cancel_ms time_limit delay_ms value=111
    call run_test           ; ...

; Scenario 2: the requestor succeeds within the time limit.

    dup 2                   ; ... timer referee
    push #?                 ; ... timer referee cancel_ms=#?
    push 100                ; ... timer referee cancel_ms time_limit=100
    push 75                 ; ... timer referee cancel_ms time_limit delay_ms=75
    push 222                ; ... timer referee cancel_ms time_limit delay_ms value=222
    call run_test           ; ...

; Scenario 3: the operation is cancelled early. There should be no output.

    dup 2                   ; ... timer referee
    push 25                 ; ... timer referee cancel_ms=25
    push 50                 ; ... timer referee cancel_ms time_limit=50
    push 50                 ; ... timer referee cancel_ms time_limit delay_ms=50
    push 333                ; ... timer referee cancel_ms time_limit delay_ms value=333
    call run_test           ; ...

; Scenario 4: the operation is cancelled after the requestor succeeds.

    dup 2                   ; ... timer referee
    push 150                ; ... timer referee cancel_ms=150
    push 125                ; ... timer referee cancel_ms time_limit=125
    push 100                ; ... timer referee cancel_ms time_limit delay_ms=100
    push 444                ; ... timer referee cancel_ms time_limit delay_ms value=444
    call run_test           ; ...
    ref std.commit

; Place a time limit on a delay requestor, sending the result to the debug
; device.
; If the time limit is inadequate, the request fails.
; If the request is cancelled early, the callback is never called.

run_test:                   ; ( timer referee cancel_ms time_limit delay_ms value -- )
    roll -7                 ; k timer referee cancel_ms time_limit delay_ms value
    pick 6                  ; k timer referee cancel_ms time_limit delay_ms value timer
    roll 3                  ; k timer referee cancel_ms time_limit value timer delay_ms
    pair 1                  ; k timer referee cancel_ms time_limit value (delay_ms . timer)
    push delay.beh          ; k timer referee cancel_ms time_limit value (delay_ms . timer) delay_beh
    new -1                  ; k timer referee cancel_ms time_limit value delay=delay_beh.(delay_ms . timer)
    pick 6                  ; k timer referee cancel_ms time_limit value delay timer
    roll 4                  ; k timer referee cancel_ms value delay timer time_limit
    roll 3                  ; k timer referee cancel_ms value timer time_limit delay
    pair 2                  ; k timer referee cancel_ms value (delay time_limit . timer)
    push timeout_beh        ; k timer referee cancel_ms value (delay time_limit . timer) timeout_beh
    new -1                  ; k timer referee cancel_ms value timeout=timeout_beh.(delay time_limit . timer)
    push #?                 ; k timer referee cancel_ms value timeout #?
    push canceller.beh      ; k timer referee cancel_ms value timeout #? canceller_beh
    new -1                  ; k timer referee cancel_ms value timeout canceller=canceller_beh.#?
    roll 3                  ; k timer referee cancel_ms timeout canceller value
    roll 5                  ; k timer cancel_ms timeout canceller value referee
    pick 3                  ; k timer cancel_ms timeout canceller value referee canceller
    pair 2                  ; k timer cancel_ms timeout canceller timeout_request=(canceller referee . value)
    roll 3                  ; k timer cancel_ms canceller timeout_request timeout
    send -1                 ; k timer cancel_ms canceller
    pick 2                  ; k timer cancel_ms canceller cancel_ms
    typeq #fixnum_t         ; k timer cancel_ms canceller fixnum(cancel_ms)
    if_not skip_cancel      ; k timer cancel_ms canceller
    push #nil               ; k timer cancel_ms canceller ()
    roll 2                  ; k timer cancel_ms () canceller
    roll 3                  ; k timer () canceller cancel_ms
    pair 2                  ; k timer (cancel_ms canceller)
    roll 2                  ; k (cancel_ms canceller) timer
    send -1                 ; k
    return

skip_cancel:
    drop 3                  ; --
    return

.export
    beh
    boot
    test
