; A "referee" actor compares its received messages, in order, against a list of
; expected values.

; If there is any discrepancy, or if any additional messages arrive during a
; probationary period, the 'judge' capability is sent #f. Otherwise 'judge'
; is sent #t.

; The 'timer' is the timer device (optional), 'probation' a fixnum of
; milliseconds to wait after the last expected message is received,
; and 'expected_msgs' a list of expected message values.

.import
    std: "../std.asm"
    lib: "../lib.asm"
    dev: "../dev.asm"

beh:
referee_beh:                ; (judge timer probation . expected_msgs) <- msg

; If the referee is not expecting any more message, fail.

    state -3                ; expected_msgs
    eq #nil                 ; is_empty(expected_msgs)
    if fail                 ; --

; If the message does not match the expected value, fail.

    state 4                 ; expected
    msg 0                   ; expected actual
    cmp eq                  ; expected==actual
    if_not fail             ; --

; Remove the matching message from the state.

    state -4                ; expected_msgs'
    state 3                 ; expected_msgs' probation
    state 2                 ; expected_msgs' probation timer
    state 1                 ; expected_msgs' probation timer judge
    pair 3                  ; state'=(judge timer probation . expected_msgs')
    push referee_beh        ; state' referee_beh
    actor become            ; --

; Are we expecting any more messages?

    state -4                ; expected_msgs'
    eq #nil                 ; is_empty(expected_msgs')
    if_not std.commit       ; --

; None at all. If the timer capability was not provided, signal success
; immediately.

    state 2                 ; timer
    typeq #actor_t          ; is_cap(timer)?
    if_not succeed          ; --

; Otherwise set a timer to signal success after a probationary period, during
; which time the referee is on the lookout for unexpected messages.

    state 1                 ; judge
    push lib.once_beh       ; judge once_beh
    actor create            ; judge'=once_beh.judge
    push #t                 ; judge' result=#t
    pick 2                  ; judge' result judge'
    state 3                 ; judge' result judge' delay=probation
    pair 2                  ; judge' timer_req=(delay judge' . result)
    state 2                 ; judge' timer_req timer
    actor send              ; judge'
    state -4                ; judge' expected_msgs'
    state 3                 ; judge' expected_msgs' probation
    state 2                 ; judge' expected_msgs' probation timer
    roll 4                  ; expected_msgs' probation timer judge'
    pair 3                  ; state'=(judge' timer probation . expected_msgs')
    push referee_beh        ; state' referee_beh
    actor become            ; --
    ref std.commit

succeed:
    push #t                 ; msg=#t
    ref done_k
fail:
    push #f                 ; msg=#f
done_k:
    push #?                 ; msg #?
    push std.sink_beh       ; msg #? sink_beh
    actor become            ; msg
    state 1                 ; msg judge
    ref std.send_msg

; Test suite

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.timer_key      ; {caps} timer_key
    dict get                ; timer
    msg 0                   ; timer {caps}
    push dev.debug_key      ; timer {caps} debug_key
    dict get                ; timer judge=debug
    ref setup

; Employ a referee of referees.

test:                       ; judge <- {caps}
    msg 0                   ; {caps}
    push dev.timer_key      ; {caps} timer_key
    dict get                ; timer
    push #nil               ; timer ()
    push #t                 ; timer () expect_3=#t
    push #f                 ; timer () expect_3 expect_2=#f
    push #f                 ; timer () expect_3 expect_2 wrong=#f
    push #t                 ; timer () expect_3 expect_2 wrong no_timer=#t
    push 100                ; timer () expect_3 expect_2 wrong no_timer probation=100ms
    pick 7                  ; timer () expect_3 expect_2 wrong no_timer probation timer
    state 0                 ; timer () expect_3 expect_2 wrong no_timer probation timer judge
    pair 7                  ; timer (judge timer probation no_timer wrong expect_2 expect_3)
    push referee_beh        ; timer (judge timer probation no_timer wrong expect_2 expect_3) referee_beh
    actor create            ; timer ref=referee_of_referees
setup:
    roll 2                  ; ref timer

; Get 3 messages, but one is wrong. FAIL in ~50ms.

    dup 1                   ; ref timer timer
    push #nil               ; ref timer timer ()
    push 3                  ; ref timer timer () 3rd=3
    push 42                 ; ref timer timer () 3rd 2nd=42 // actual==2
    push 1                  ; ref timer timer () 3rd 2nd 1st=1
    push 100                ; ref timer timer () 3rd 2nd 1st probation=100ms
    pick 7                  ; ref timer timer () 3rd 2nd 1st probation timer
    pick 9                  ; ref timer timer () 3rd 2nd 1st probation timer judge=ref
    pair 6                  ; ref timer timer referee_state
    push referee_beh        ; ref timer timer referee_state referee_beh
    actor create            ; ref timer timer referee
    call send_sequence      ; ref timer

; Expect 2 messages, but get three. FAIL in ~75ms.

    dup 1                   ; ref timer timer
    push #nil               ; ref timer timer ()
    push 2                  ; ref timer timer () 2nd=2
    push 1                  ; ref timer timer () 2nd 1st=1
    push 100                ; ref timer timer () 2nd 1st probation=100ms
    pick 6                  ; ref timer timer () 2nd 1st probation timer
    pick 8                  ; ref timer timer () 2nd 1st probation timer judge=ref
    pair 5                  ; ref timer timer referee_state
    push referee_beh        ; ref timer timer referee_state referee_beh
    actor create            ; ref timer timer referee
    call send_sequence      ; ref timer

; Expect 1 message, get 3, but omit the timer. PASS in ~25ms.

    dup 1                   ; ref timer timer
    push #nil               ; ref timer timer ()
    push 1                  ; ref timer timer () 1st=1
    push #?                 ; ref timer timer () 1st probation=#?
    push #?                 ; ref timer timer () 1st probation timer=#?
    pick 7                  ; ref timer timer () 1st probation timer judge=ref
    pair 4                  ; ref timer timer referee_state
    push referee_beh        ; ref timer timer referee_state referee_beh
    actor create            ; ref timer timer referee
    call send_sequence      ; ref timer

; Get the 3 expected messages. PASS in ~175ms

    dup 1                   ; ref timer timer
    push #nil               ; ref timer timer ()
    push 3                  ; ref timer timer () 3rd=3
    push 2                  ; ref timer timer () 3rd 2nd=2
    push 1                  ; ref timer timer () 3rd 2nd 1st=1
    push 100                ; ref timer timer () 3rd 2nd 1st probation=100ms
    pick 7                  ; ref timer timer () 3rd 2nd 1st probation timer
    pick 9                  ; ref timer timer () 3rd 2nd 1st probation timer judge=ref
    pair 6                  ; ref timer timer referee_state
    push referee_beh        ; ref timer timer referee_state referee_beh
    actor create            ; ref timer timer referee
    call send_sequence      ; ref timer
    ref std.commit

; Sends three messages to the referee, a slight delay between each.

send_spec:                  ; (msg delay msg delay ...)
    pair_t 1
    pair_t 25
    pair_t 2
    pair_t 50
    pair_t 3
    pair_t 75
    ref #nil

send_sequence:              ; ( timer referee -- )
    roll -3                 ; k timer referee
    push send_spec          ; k timer referee send_spec
send_next:
    dup 1                   ; k timer referee send_spec send_spec
    if_not send_done        ; k timer referee send_spec
    part 2                  ; k timer referee send_spec' delay msg
    pick 4                  ; k timer referee send_spec' delay msg referee
    roll 3                  ; k timer referee send_spec' msg referee delay
    pair 2                  ; k timer referee send_spec' timer_req=(delay referee . msg)
    pick 4                  ; k timer referee send_spec' timer_req timer
    actor send              ; k timer referee send_spec'
    ref send_next
send_done:                  ; k timer referee send_spec
    drop 3                  ; k
    return

.export
    beh
    boot
    test
