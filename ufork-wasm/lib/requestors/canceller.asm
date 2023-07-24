; The "canceller" actor can be passed as the 'to_cancel' capability in a request
; message. You can pretty much treat it like the cancel capability that the
; requestor may eventually send.

; It is rare to provide a meaningful reason for cancellation, but if it is then
; the reason must be wrapped in a list:

;   (reason) -> canceller

; A more cancel-like capability can be made by wrapping a canceller in
; 'wrap_beh' from lib.asm.

.import
    std: "../std.asm"
    dev: "../dev.asm"
    lib: "../lib.asm"
    referee: "../testing/referee.asm"

beh:
canceller_beh:                  ; () <- message
    msg 0                       ; message
    typeq #actor_t              ; cap?
    if_not got_reason           ; --
    msg 0                       ; cancel
    push wait_for_reason_beh    ; cancel wait_for_reason_beh
    beh -1                      ; --
    ref std.commit

got_reason:
    msg 0                       ; (reason)
    push wait_for_cancel_beh    ; (reason) wait_for_cancel_beh
    beh -1                      ; --
    ref std.commit

wait_for_cancel_beh:            ; (reason) <- message
    msg 0                       ; message
    typeq #actor_t              ; cap?
    if_not std.commit           ; --
    state 1                     ; reason
    msg 0                       ; reason cancel
    ref send_reason_to_cancel

wait_for_reason_beh:            ; cancel <- message
    msg 0                       ; message
    typeq #actor_t              ; cap?
    if std.commit               ; --
    msg 1                       ; reason
    state 0                     ; reason cancel
send_reason_to_cancel:          ; reason cancel
    push std.sink_beh           ; reason cancel sink_beh
    beh 0                       ; reason cancel
    ref std.send_msg

; Test suite

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push dev.timer_key  ; {caps} timer_key
    dict get            ; timer
    msg 0               ; timer {caps}
    push dev.debug_key  ; timer {caps} debug_key
    dict get            ; timer referee=debug
    ref setup

test:                   ; (verdict) <- {caps}
    msg 0               ; {caps}
    push dev.timer_key  ; {caps} timer_key
    dict get            ; timer
    push 1729           ; timer 2nd=1729
    push 42             ; timer 2nd 1st=42
    push 100            ; timer 2nd 1st probation_ms=100
    pick 4              ; timer 2nd 1st probation_ms timer
    state 1             ; timer 2nd 1st probation_ms timer verdict
    push referee.beh    ; timer 2nd 1st probation_ms timer verdict referee_beh
    new 5               ; timer referee=referee_beh.(verdict timer probation_ms 1st 2nd)
setup:

; Cancel arrives before reason.

    dup 2               ; ... timer cancel=referee
    push 25             ; ... timer cancel cancel_ms=25
    push 50             ; ... timer cancel cancel_ms reason_ms=50
    push 42             ; ... timer cancel cancel_ms reason_ms reason=42
    push test_beh       ; ... timer cancel cancel_ms reason_ms reason test_beh
    new 5               ; ... test
    send 0              ; ...

; Reason arrives before cancel.

    dup 2               ; ... timer cancel=referee
    push 100            ; ... timer cancel cancel_ms=100
    push 75             ; ... timer cancel cancel_ms reason_ms=75
    push 1729           ; ... timer cancel cancel_ms reason_ms reason=1729
    push test_beh       ; ... timer cancel cancel_ms reason_ms reason test_beh
    new 5               ; ... test
    send 0              ; ...
    ref std.commit

; We create a canceller and send it a cancel capability and a reason, each after
; an independent delay. Each is sent twice, to test the canceller's tolerance
; to duplication.

test_beh:               ; (reason reason_ms cancel_ms cancel timer) <- ()
    push canceller_beh  ; canceller_beh
    new 0               ; canceller=canceller_beh.()
    state 0             ; canceller (reason ...)
    pick 2              ; canceller (reason ...) canceller
    state 2             ; canceller (reason ...) canceller reason_ms
    state 5             ; canceller (reason ...) canceller reason_ms timer
    dup 4               ; ... (reason ...) canceller reason_ms timer
    send 3              ; ... (reason ...) canceller reason_ms timer
    send 3              ; canceller
    state 4             ; canceller cancel
    pick 2              ; canceller cancel canceller
    state 3             ; canceller cancel canceller cancel_ms
    state 5             ; canceller cancel canceller cancel_ms timer
    dup 4               ; ... cancel canceller cancel_ms timer
    send 3              ; ... cancel canceller cancel_ms timer
    send 3              ; canceller
    ref std.commit

.export
    beh
    boot
    test
