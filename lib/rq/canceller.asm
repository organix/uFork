; The "canceller" actor can be passed as the 'to_cancel' capability in a request
; message. You can pretty much treat it like the cancel capability that the
; requestor may eventually send.

; It is rare to provide a meaningful reason for cancellation, but if it is then
; the reason must be wrapped in a pair:

;   (reason . _) -> canceller

.import
    std: "../std.asm"
    dev: "../dev.asm"
    referee: "../testing/referee.asm"

beh:
canceller_beh:              ; _ <- message
    msg 0                   ; message
    typeq #actor_t          ; cap?
    if_not got_reason       ; --
    msg 0                   ; cancel
    push reason_wait_beh    ; cancel reason_wait_beh
    actor become            ; --
    ref std.commit

got_reason:
    msg 0                   ; (reason . _)
    push cancel_wait_beh    ; (reason . _) cancel_wait_beh
    actor become            ; --
    ref std.commit

cancel_wait_beh:            ; (reason . _) <- message
    msg 0                   ; message
    typeq #actor_t          ; cap?
    if_not std.commit       ; --
    state 1                 ; reason
    msg 0                   ; reason cancel
    ref send_reason_to_cancel

reason_wait_beh:            ; cancel <- message
    msg 0                   ; message
    typeq #actor_t          ; cap?
    if std.commit           ; --
    msg 1                   ; reason
    state 0                 ; reason cancel
send_reason_to_cancel:      ; reason cancel
    push #?                 ; reason cancel #?
    push std.sink_beh       ; reason cancel #? sink_beh
    actor become            ; reason cancel
    ref std.send_msg

; Test suite

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.timer_key      ; {caps} timer_key
    dict get                ; timer
    msg 0                   ; timer {caps}
    push dev.debug_key      ; timer {caps} debug_key
    dict get                ; timer referee=debug
    ref setup

test:                       ; judge <- {caps}
    msg 0                   ; {caps}
    push dev.timer_key      ; {caps} timer_key
    dict get                ; timer
    push #nil               ; timer ()
    push 1729               ; timer () 2nd=1729
    push 42                 ; timer () 2nd 1st=42
    push 100                ; timer () 2nd 1st probation_ms=100
    pick 5                  ; timer () 2nd 1st probation_ms timer
    state 0                 ; timer () 2nd 1st probation_ms timer judge
    pair 5                  ; timer (judge timer probation_ms 1st 2nd)
    push referee.beh        ; timer (judge timer probation_ms 1st 2nd) referee_beh
    actor create            ; timer referee=referee_beh.(judge timer probation_ms 1st 2nd)
setup:

; Cancel arrives before reason.

    dup 2                   ; ... timer cancel=referee
    push 25                 ; ... timer cancel cancel_ms=25
    push 50                 ; ... timer cancel cancel_ms reason_ms=50
    push 42                 ; ... timer cancel cancel_ms reason_ms reason=42
    call run_test           ; ...

; Reason arrives before cancel.

    dup 2                   ; ... timer cancel=referee
    push 100                ; ... timer cancel cancel_ms=100
    push 75                 ; ... timer cancel cancel_ms reason_ms=75
    push 1729               ; ... timer cancel cancel_ms reason_ms reason=1729
    call run_test           ; ...
    ref std.commit

; We create a canceller and send it a cancel capability and a reason, each after
; an independent delay. Each is sent twice, to test the canceller's tolerance
; to duplication.

run_test:                   ; ( timer cancel cancel_ms reason_ms reason -- )
    roll -6                 ; k timer cancel cancel_ms reason_ms reason
    push #?                 ; k timer cancel cancel_ms reason_ms reason #?
    push canceller_beh      ; k timer cancel cancel_ms reason_ms reason #? canceller_beh
    actor create            ; k timer cancel cancel_ms reason_ms reason canceller=canceller_beh.#?
    pick 6                  ; k timer cancel cancel_ms reason_ms reason canceller timer
    push #?                 ; k timer cancel cancel_ms reason_ms reason canceller timer #?
    roll 4                  ; k timer cancel cancel_ms reason_ms canceller timer #? reason
    pair 1                  ; k timer cancel cancel_ms reason_ms canceller timer (reason . #?)
    pick 3                  ; k timer cancel cancel_ms reason_ms canceller timer (reason . #?) canceller
    roll 5                  ; k timer cancel cancel_ms canceller timer (reason . #?) canceller reason_ms
    call schedule_twice     ; k timer cancel cancel_ms canceller
    roll -2                 ; k timer cancel canceller cancel_ms
    call schedule_twice     ; k
    return

schedule_twice:             ; ( timer message target delay -- )
    roll -5                 ; k timer message target delay
    pair 2                  ; k timer timer_req=(delay target . message)
    dup 1                   ; k timer timer_req timer_req
    pick 3                  ; k timer timer_req timer_req timer
    actor send              ; k timer timer_req
    roll 2                  ; k timer_req timer
    actor send              ; k
    return

.export
    beh
    boot
    test
