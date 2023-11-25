; The "is_eq" actor compares each messages it receives to an 'expected' value.
; If equal, the 'receiver' is sent the 'yes' message. Otherwise the receiver is
; sent the 'no' message.

.import
    std: "../std.asm"
    dev: "../dev.asm"
    referee: "./referee.asm"

beh:
is_eq_beh:              ; (receiver expected yes no) <- actual
    state 2             ; expected
    msg 0               ; expected actual
    cmp eq              ; expected==actual?
    if_not no           ; --
    state 3             ; yes
    ref send
no:
    state 4             ; no
    ref send
send:
    state 1             ; yes/no receiver
    ref std.send_msg

; Test suite

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push dev.debug_key  ; {caps} debug_key
    dict get            ; debug_dev
    ref suite

test:                   ; (verdict) <- {caps}
    push #t             ; 2nd=#t
    push #t             ; 2nd 1st=#t // order doesn't matter
    push #?             ; 2nd 1st probation=#?
    push #?             ; 2nd 1st probation timer=#?
    state 1             ; 2nd 1st probation timer verdict
    push referee.beh    ; 2nd 1st probation timer verdict referee_beh
    new 5               ; referee=referee_beh.(verdict timer probation 1st 2nd)
suite:

; The actor is sent the expected value, emitting #t for 'yes'.

    push 42             ; referee actual=42
    push #f             ; referee actual no=#f
    push #t             ; referee actual no yes=#t
    push 42             ; referee actual no yes expected=42
    pick 5              ; referee actual no yes expected receiver=referee
    push is_eq_beh      ; referee actual no yes expected receiver is_eq_beh
    new 4               ; referee actual is_eq=is_eq_beh.(receiver expected yes no)

; The actor is sent an unexpected value, emitting #t for 'no'.

    send -1             ; referee
    push 43             ; referee actual=43
    push #t             ; referee actual no=#t
    push #f             ; referee actual no yes=#f
    push 42             ; referee actual no yes expected=42
    pick 5              ; referee actual no yes expected receiver=referee
    push is_eq_beh      ; referee actual no yes expected receiver is_eq_beh
    new 4               ; referee actual is_eq=is_eq_beh.(receiver expected yes no)
    send -1             ; referee
    ref std.commit

.export
    beh
    boot
    test
