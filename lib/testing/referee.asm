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
    beh -1                  ; --

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
    new -1                  ; judge'=once_beh.judge
    push #t                 ; judge' result=#t
    pick 2                  ; judge' result judge'
    state 3                 ; judge' result judge' delay=probation
    state 2                 ; judge' result judge' delay timer
    send 3                  ; judge'
    state -4                ; judge' expected_msgs'
    state 3                 ; judge' expected_msgs' probation
    state 2                 ; judge' expected_msgs' probation timer
    roll 4                  ; expected_msgs' probation timer judge'
    pair 3                  ; state'=(judge' timer probation . expected_msgs')
    push referee_beh        ; state' referee_beh
    beh -1                  ; --
    ref std.commit

succeed:
    push #t                 ; msg=#t
    ref done_k
fail:
    push #f                 ; msg=#f
done_k:
    push #?                 ; msg #?
    push std.sink_beh       ; msg #? sink_beh
    beh -1                  ; msg
    state 1                 ; msg judge
    ref std.send_msg

; Test suite

boot:                       ; () <- {caps}
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
    new -1                  ; timer judge=referee_of_referees
setup:
    roll 2                  ; judge timer

; Get 3 messages, but one is wrong. FAIL in ~50ms.

    dup 1                   ; judge timer timer
    push #nil               ; judge timer timer ()
    push 3                  ; judge timer timer () 3rd=3
    push 42                 ; judge timer timer () 3rd 2nd=42 // actual==2
    push 1                  ; judge timer timer () 3rd 2nd 1st=1
    push 100                ; judge timer timer () 3rd 2nd 1st probation=100ms
    pick 7                  ; judge timer timer () 3rd 2nd 1st probation timer
    pick 9                  ; judge timer timer () 3rd 2nd 1st probation timer judge
    pair 6                  ; judge timer timer referee_state
    push referee_beh        ; judge timer timer referee_state referee_beh
    new -1                  ; judge timer timer referee
    call send_thrice        ; judge timer

; Expect 2 messages, but get three. FAIL in ~75ms.

    dup 1                   ; judge timer timer
    push #nil               ; judge timer timer ()
    push 2                  ; judge timer timer () 2nd=2
    push 1                  ; judge timer timer () 2nd 1st=1
    push 100                ; judge timer timer () 2nd 1st probation=100ms
    pick 6                  ; judge timer timer () 2nd 1st probation timer
    pick 8                  ; judge timer timer () 2nd 1st probation timer judge
    pair 5                  ; judge timer timer referee_state
    push referee_beh        ; judge timer timer referee_state referee_beh
    new -1                  ; judge timer timer referee
    call send_thrice        ; judge timer

; Expect 1 message, get 3, but omit the timer. PASS in ~25ms.

    dup 1                   ; judge timer timer
    push #nil               ; judge timer timer ()
    push 1                  ; judge timer timer () 1st=1
    push #?                 ; judge timer timer () 1st probation=#?
    push #?                 ; judge timer timer () 1st probation timer=#?
    pick 7                  ; judge timer timer () 1st probation timer judge
    pair 4                  ; judge timer timer referee_state
    push referee_beh        ; judge timer timer referee_state referee_beh
    new -1                  ; judge timer timer referee
    call send_thrice        ; judge timer

; Get the 3 expected messages. PASS in ~175ms

    dup 1                   ; judge timer timer
    push #nil               ; judge timer timer ()
    push 3                  ; judge timer timer () 3rd=3
    push 2                  ; judge timer timer () 3rd 2nd=2
    push 1                  ; judge timer timer () 3rd 2nd 1st=1
    push 100                ; judge timer timer () 3rd 2nd 1st probation=100ms
    pick 7                  ; judge timer timer () 3rd 2nd 1st probation timer
    pick 9                  ; judge timer timer () 3rd 2nd 1st probation timer judge
    pair 6                  ; judge timer timer referee_state
    push referee_beh        ; judge timer timer referee_state referee_beh
    new -1                  ; judge timer timer referee
    call send_thrice        ; judge timer
    ref std.commit

; Sends three messages to the referee, a slight delay between each.

send_thrice:                ; ( timer referee -- )
    roll -3                 ; k timer referee
    push 1                  ; k timer referee 1st=1
    pick 2                  ; k timer referee 1st referee
    push 25                 ; k timer referee 1st referee 25ms
    pick 5                  ; k timer referee 1st referee 25ms timer
    send 3                  ; k timer referee
    push 2                  ; k timer referee 2nd=2
    pick 2                  ; k timer referee 2nd referee
    push 50                 ; k timer referee 2nd referee 50ms
    pick 5                  ; k timer referee 2nd referee 50ms timer
    send 3                  ; k timer referee
    push 3                  ; k timer referee 3rd=3
    pick 2                  ; k timer referee 3rd referee
    push 75                 ; k timer referee 3rd referee 75ms
    pick 5                  ; k timer referee 3rd referee 75ms timer
    send 3                  ; k timer referee
    drop 2                  ; k
    return

.export
    beh
    boot
    test
