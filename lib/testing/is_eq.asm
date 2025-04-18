; The "is_eq" actor compares each messages it receives to an 'expected' value.
; If equal, the 'receiver' is sent the 'yes' message. Otherwise the receiver is
; sent the 'no' message.

.import
    std: "../std.asm"
    dev: "../dev.asm"
    referee: "./referee.asm"

beh:
is_eq_beh:                  ; receiver,expected,yes,no <- actual
    state 2                 ; expected
    msg 0                   ; expected actual
    cmp eq                  ; expected==actual?
    if_not no               ; --
    state 3                 ; yes
    ref send
no:
    state -3                ; no
    ref send
send:
    state 1                 ; yes/no receiver
    ref std.send_msg

; Test suite

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; debug_dev
    ref suite

test:                       ; judge <- {caps}
    push #nil               ; #nil
    push #t                 ; #nil 2nd=#t
    push #t                 ; #nil 2nd 1st=#t // order doesn't matter
    push #?                 ; #nil 2nd 1st probation=#?
    push #?                 ; #nil 2nd 1st probation timer=#?
    state 0                 ; #nil 2nd 1st probation timer judge
    pair 5                  ; judge,timer,probation,1st,2nd,#nil
    push referee.beh        ; judge,timer,probation,1st,2nd,#nil referee_beh
    actor create            ; referee=referee_beh.judge,timer,probation,1st,2nd,#nil
suite:

; The actor is sent the expected value, emitting #t for 'yes'.

    push 42                 ; referee actual=42
    push #f                 ; referee actual no=#f
    push #t                 ; referee actual no yes=#t
    push 42                 ; referee actual no yes expected=42
    pick 5                  ; referee actual no yes expected receiver=referee
    pair 3                  ; referee actual receiver,expected,yes,no
    push is_eq_beh          ; referee actual receiver,expected,yes,no is_eq_beh
    actor create            ; referee actual is_eq=is_eq_beh.receiver,expected,yes,no

; The actor is sent an unexpected value, emitting #t for 'no'.

    actor send              ; referee
    push 43                 ; referee actual=43
    push #t                 ; referee actual no=#t
    push #f                 ; referee actual no yes=#f
    push 42                 ; referee actual no yes expected=42
    pick 5                  ; referee actual no yes expected receiver=referee
    pair 3                  ; referee actual receiver,expected,yes,no
    push is_eq_beh          ; referee actual receiver,expected,yes,no is_eq_beh
    actor create            ; referee actual is_eq=is_eq_beh.receiver,expected,yes,no
    actor send              ; referee
    ref std.commit

.export
    beh
    boot
    test
