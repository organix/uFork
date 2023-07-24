; A "referee" actor compares its received messages, in order, against a list of
; expected values.

; If there is any discrepancy, or if any additional messages arrive during a
; probationary period, the 'verdict' capability is sent #f. Otherwise 'verdict'
; is sent #t.

; The 'timer' is the timer device (optional), 'probation' a fixnum of
; milliseconds to wait after the last expected message is received,
; and 'expected_msgs' a list of expected message values.

.import
    std: "../std.asm"
    lib: "../lib.asm"
    dev: "../dev.asm"

beh:
referee_beh:            ; (verdict timer probation . expected_msgs) <- msg

; If the referee is not expecting any more message, fail.

    state -3            ; expected_msgs
    eq #nil             ; is_empty(expected_msgs)
    if fail             ; --

; If the message does not match the expected value, fail.

    state 4             ; expected
    msg 0               ; expected actual
    cmp eq              ; expected==actual
    if_not fail         ; --

; Remove the matching message from the state.

    state -4            ; expected_msgs'
    state 3             ; expected_msgs' probation
    state 2             ; expected_msgs' probation timer
    state 1             ; expected_msgs' probation timer verdict
    pair 3              ; state'=(verdict timer probation . expected_msgs')
    my beh              ; state' beh
    beh -1              ; --

; Are we expecting any more messages?

    state -4            ; expected_msgs'
    eq #nil             ; is_empty(expected_msgs')
    if_not std.commit   ; --

; None at all. If the timer capability was not provided, signal success
; immediately.

    state 2             ; timer
    typeq #actor_t      ; is_cap(timer)?
    if_not succeed      ; --

; Otherwise set a timer to signal success after a probationary period, during
; which time the referee is on the lookout for unexpected messages.

    state 1             ; verdict
    push lib.once_beh   ; verdict once_beh
    new 1               ; verdict'=once_beh.(verdict)
    push #t             ; verdict' result=#t
    pick 2              ; verdict' result verdict'
    state 3             ; verdict' result verdict' delay=probation
    state 2             ; verdict' result verdict' delay timer
    send 3              ; verdict'
    state -4            ; verdict' expected_msgs'
    state 3             ; verdict' expected_msgs' probation
    state 2             ; verdict' expected_msgs' probation timer
    roll 4              ; expected_msgs' probation timer verdict'
    pair 3              ; state'=(verdict' timer probation . expected_msgs')
    my beh              ; state' beh
    beh -1              ; --
    ref std.commit

succeed:
    push #t             ; msg=#t
    ref done_k
fail:
    push #f             ; msg=#f
done_k:
    push std.sink_beh   ; msg sink_beh
    beh 0               ; msg
    state 1             ; msg verdict
    ref std.send_msg

; Test suite

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push dev.timer_key  ; {caps} timer_key
    dict get            ; timer
    msg 0               ; timer {caps}
    push dev.debug_key  ; timer {caps} debug_key
    dict get            ; timer verdict'=debug
    ref setup

; Employ a referee of referees.

test:                   ; (verdict) <- {caps}
    msg 0               ; {caps}
    push dev.timer_key  ; {caps} timer_key
    dict get            ; timer
    push #t             ; timer expect_3=#t
    push #f             ; timer expect_3 expect_2=#f
    push #f             ; timer expect_3 expect_2 wrong=#f
    push #t             ; timer expect_3 expect_2 wrong no_timer=#t
    push 100            ; timer expect_3 expect_2 wrong no_timer probation=100ms
    pick 5              ; timer expect_3 expect_2 wrong no_timer probation timer
    state 1             ; timer expect_3 expect_2 wrong no_timer probation timer verdict
    push referee_beh    ; timer expect_3 expect_2 wrong no_timer probation timer verdict referee_beh
    new 7               ; timer verdict'=referee_of_referees
setup:
    dup 2               ; ... timer verdict'
    push wrong_beh      ; ... timer verdict' wrong_beh
    new 2               ; ... wrong
    send 0              ; ...
    dup 2               ; ... timer verdict'
    push no_timer_beh   ; ... timer verdict' no_timer_beh
    new 2               ; ... no_timer
    send 0              ; ...
    dup 2               ; ... timer verdict'
    push expect_2_beh   ; ... timer verdict' expect_2_beh
    new 2               ; ... expect_2
    send 0              ; ...
    dup 2               ; ... timer verdict'
    push expect_3_beh   ; ... timer verdict' expect_3_beh
    new 2               ; ... expect_3
    send 0              ; ...
    ref std.commit

; Get 3 messages, but one is wrong. FAIL in ~50ms.

wrong_beh:              ; (verdict timer) <- ()
    push 3              ; 3rd=3
    push 42             ; 3rd 2nd=42 // actual==2
    push 1              ; 3rd 2nd 1st=1
    push 100            ; 3rd 2nd 1st probation=100ms
    state 2             ; 3rd 2nd 1st probation timer
    state 1             ; 3rd 2nd 1st probation timer verdict
    push referee_beh    ; 3rd 2nd 1st probation timer verdict referee_beh
    new 6               ; referee
    state 2             ; referee timer
    push fixture_beh    ; referee timer fixture_beh
    new 2               ; fixture
    send 0              ; --
    ref std.commit

; Expect 2 messages, but get three. FAIL in ~75ms.

expect_2_beh:           ; (verdict timer) <- ()
    push 2              ; 2nd=2
    push 1              ; 2nd 1st=1
    push 100            ; 2nd 1st probation=100ms
    state 2             ; 2nd 1st probation timer
    state 1             ; 2nd 1st probation timer verdict
    push referee_beh    ; 2nd 1st probation timer verdict referee_beh
    new 5               ; referee
    state 2             ; referee timer
    push fixture_beh    ; referee timer fixture_beh
    new 2               ; fixture
    send 0              ; --
    ref std.commit

; Expect 1 message, get 3, but omit the timer. PASS in ~25ms.

no_timer_beh:           ; (verdict timer) <- ()
    push 1              ; 1st=1
    push #?             ; 1st probation=#?
    push #?             ; 1st probation timer=#?
    state 1             ; 1st probation timer verdict
    push referee_beh    ; 1st probation timer verdict referee_beh
    new 4               ; referee
    state 2             ; referee timer
    push fixture_beh    ; referee timer fixture_beh
    new 2               ; fixture
    send 0              ; --
    ref std.commit

; Get the 3 expected messages. PASS in ~175ms

expect_3_beh:           ; (verdict timer) <- ()
    push 3              ; 3rd=3
    push 2              ; 3rd 2nd=2
    push 1              ; 3rd 2nd 1st=1
    push 100            ; 3rd 2nd 1st probation=100ms
    state 2             ; 3rd 2nd 1st probation timer
    state 1             ; 3rd 2nd 1st probation timer verdict
    push referee_beh    ; 3rd 2nd 1st probation timer verdict referee_beh
    new 6               ; referee
    state 2             ; referee timer
    push fixture_beh    ; referee timer fixture_beh
    new 2               ; fixture
    send 0              ; --
    ref std.commit

; Sends three messages to the referee, a slight delay between each.

fixture_beh:            ; (timer referee) <- ()
    state 1             ; timer
    state 2             ; timer referee
    push 1              ; timer referee 1st=1
    pick 2              ; timer referee 1st referee
    push 25             ; timer referee 1st referee 25ms
    pick 5              ; timer referee 1st referee 25ms timer
    send 3              ; timer referee
    push 2              ; timer referee 2nd=2
    pick 2              ; timer referee 2nd referee
    push 50             ; timer referee 2nd referee 50ms
    pick 5              ; timer referee 2nd referee 50ms timer
    send 3              ; timer referee
    push 3              ; timer referee 3rd=3
    pick 2              ; timer referee 3rd referee
    push 75             ; timer referee 3rd referee 75ms
    pick 5              ; timer referee 3rd referee 75ms timer
    send 3              ; timer referee
    ref std.commit

.export
    beh
    boot
    test
