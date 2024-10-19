; The "sequence" requestor starts each requestor in the list, one after the
; other. The value produced by each is fed into the next one. If any requestor
; fails, the sequence fails.

; This module is a port of parseq's sequence factory, originally written in
; JavaScript. See https://crockford.com/parseq.html.

.import
    canceller: "./canceller.asm"
    dev: "../dev.asm"
    lib: "../lib.asm"
    referee: "../testing/referee.asm"
    std: "../std.asm"
    unwrap_result: "./unwrap_result.asm"

start_tag:
    ref 0
cancel_tag:
    ref 1
result_tag:
    ref 2

beh:
sequence_beh:               ; (requestors) <- (to_cancel callback . value)

; The work of handling the request is deferred to a dedicated "runner" actor,
; freeing up the sequence requestor to accept additional requests.

    msg 2                   ; callback
    state 1                 ; callback requestors
    push runner_beh         ; callback requestors runner_beh
    new 2                   ; runner=runner_beh.(requestors callback)
    msg -2                  ; runner value
    push start_tag          ; runner value start_tag
    pick 3                  ; runner value start_tag runner
    send 2                  ; runner

; Provide a cancel capability if the request allows for it.

    msg 1                   ; runner to_cancel
    typeq #actor_t          ; runner cap?(to_cancel)
    if_not std.commit       ; runner
    push cancel_tag         ; runner label=cancel_tag
    roll 2                  ; label rcvr=runner
    pair 1                  ; (rcvr . label)
    push lib.label_beh      ; (rcvr . label) label_beh
    new -1                  ; cancel=label_beh.(rcvr label)
    msg 1                   ; cancel to_cancel
    send -1                 ; --
    ref std.commit

runner_beh:                 ; (requestors callback canceller) <- message

; The "runner" actor processes a single sequence request.
; There are three kinds of message it expects to receive:

;   (start_tag value)
;       Start the next requestor, feeding it the 'value'. If there are no
;       more requestors, inform the callback and become inert.

;   (cancel_tag . reason)
;       Cancel the running requestor with the 'reason' and become inert.

;   (result_tag . result)
;       A result has arrived from the running requestor.

    debug
    msg 1                   ; tag
    eq start_tag            ; tag==start_tag?
    if on_start             ; --
    msg 1                   ; tag
    eq cancel_tag           ; tag==cancel_tag?
    if on_cancel            ; --
    msg 1                   ; tag
    eq result_tag           ; tag==result_tag?
    if on_result            ; --
    ref std.commit
    
on_result:                  ; (requestors callback canceller) <- (result_tag . result)
    msg 2                   ; ok
    if_not fail             ; --
    msg -2                  ; value
    push start_tag          ; value start_tag
    my self                 ; value start_tag SELF
    send 2                  ; --
    ref std.commit

fail:                       ; --
    msg -1                  ; result
    state 2                 ; result callback
    send -1                 ; --
    ref done

on_start:                   ; (requestors callback) <- (start_tag value)
    state 1                 ; requestors
    if_not succeed          ; --
    push canceller.beh      ; canceller_beh
    new 0                   ; canceller=canceller_beh.()
    state 1                 ; canceller requestors
    part 1                  ; canceller pending next
    msg 2                   ; canceller pending next value
    push result_tag         ; canceller pending next value label=result_tag
    my self                 ; canceller pending next value label rcvr=SELF
    pair 1                  ; canceller pending next value (rcvr . label)
    push lib.label_beh      ; canceller pending next value (rcvr . label) label_beh
    new -1                  ; canceller pending next value callback=label_beh.(rcvr . label)
    pick 5                  ; canceller pending next value callback to_cancel=canceller
    pair 2                  ; canceller pending next request=(to_cancel callbackvalue)
    roll 2                  ; canceller pending request=(to_cancel callback=SELF value) next
    send -1                 ; canceller pending
    state 2                 ; canceller pending callback
    roll 2                  ; canceller callback pending
    my beh                  ; canceller callback pending BEH
    beh 3                   ; --
    ref std.commit

succeed:
    msg 2                   ; value
    push #t                 ; value ok=#t
    pair 1                  ; result=(ok . value)
    state 2                 ; result callback
    send -1                 ; --
    ref done

on_cancel:                  ; (requestors callback canceller) <- (cancel_tag . reason)
    msg -1                  ; reason
    state 3                 ; reason canceller
    send 1                  ; --
    ref done

done:
    push std.sink_beh       ; sink_beh
    beh 0                   ; --
    ref std.commit

; Test suite

boot:                       ; () <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; referee=debug
    ref pre_setup
test:                       ; (verdict) <- {caps}

; FIXME: Validate the entire result, not just the result's value. This requires
; some kind of "deep" validator.

    push #?                 ; 3rd=#?
    push 4000               ; 3rd 2nd=4000
    push 1000               ; 3rd 2nd 1st=1000
    push 50                 ; 3rd 2nd 1st probation=50ms
    msg 0                   ; 3rd 2nd 1st probation {caps}
    push dev.timer_key      ; 3rd 2nd 1st probation {caps} timer_key
    dict get                ; 3rd 2nd 1st probation timer
    state 1                 ; 3rd 2nd 1st probation timer verdict
    push referee.beh        ; 3rd 2nd 1st probation timer verdict referee_beh
    new 6                   ; referee=referee_beh.(verdict timer probation 1st 2nd 3rd)
    push unwrap_result.beh  ; referee unwrap_result_beh
    new 1                   ; referee'=unwrap_result_beh.(referee)
pre_setup:
    msg 0                   ; referee {caps}
    push dev.timer_key      ; referee {caps} timer_key
    dict get                ; referee timer
    push setup_beh          ; referee timer setup_beh
    new 2                   ; setup=setup_beh.(timer referee)
    send 0                  ; --
    ref std.commit

setup_beh:                  ; (timer referee) <- ()

; An empty requestor list is provided.
; Expected output: (#t . +1000) @ 0ms

    state 2                 ; referee
    state 1                 ; referee timer
    push test_beh           ; referee timer test_beh
    new 2                   ; test=test_beh.(timer referee)
    send 0                  ; --

; Two successful requestors.
; Expected output: (#t . +4000) @ 15ms

    push #?                 ; ... 1st_error=#?
    push 5                  ; ... 1st_delay=5ms
    push #?                 ; ... 2nd_error=#?
    push 10                 ; ... 2nd_delay=10ms
    state 2                 ; ... referee
    state 1                 ; ... referee timer
    push test_beh           ; ... referee timer test_beh
    new 2                   ; ... test=test_beh.(timer referee)
    send 4                  ; --

; Three requestors, cancelled before the second one can finish.
; Expected output: nothing

    push #?                 ; ... 1st_error=#?
    push 10                 ; ... 1st_delay=10ms
    push #?                 ; ... 2nd_error=#?
    push 10                 ; ... 2nd_delay=10ms
    push #?                 ; ... 3rd_error=#?
    push 10                 ; ... 3rd_delay=10ms
    push 15                 ; ... cancel_at=15ms
    state 2                 ; ... cancel_at referee
    state 1                 ; ... cancel_at referee timer
    push test_beh           ; ... cancel_at referee timer test_beh
    new 3                   ; ... test=test_beh.(timer referee cancel_at)
    send 6                  ; --

; Three requestors, the second one fails.
; Expected output: (#f . 666) at 20ms

    push #?                 ; ... 1st_error=#?
    push 10                 ; ... 1st_delay=10ms
    push 666                ; ... 2nd_error=666
    push 10                 ; ... 2nd_delay=10ms
    push #?                 ; ... 3rd_error=#?
    push 10                 ; ... 3rd_delay=10ms
    state 2                 ; ... referee
    state 1                 ; ... referee timer
    push test_beh           ; ... referee timer test_beh
    new 2                   ; ... test=test_beh.(timer referee)
    send 6                  ; --
    ref std.commit

test_beh:                   ; (timer referee cancel_at) <- spec

; The 'spec' is a list describing the sequence of requestors to be run.
; It should look something like

;   (delay error ... delay error delay error)
;    \-- nth --/ ... \-- 2nd --/ \-- 1st --/

; where 1st denotes the first requestor, 2nd denotes the second requestor, etc.

    push #nil               ; requestors=()
    msg 0                   ; requestors spec

; The spec is consumed two elements at a time, until it is empty.

consume_spec:
    dup 1                   ; requestors spec spec
    if_not make_request     ; requestors spec
    part 2                  ; requestors spec' error delay
    state 1                 ; requestors spec' error delay timer
    push mock_double_beh    ; requestors spec' error delay timer mock_double_beh
    new 3                   ; requestors spec' mock=mock_double_beh.(error delay timer)
    roll 3                  ; spec' mock requestors
    roll 2                  ; spec' requestors mock
    pair 1                  ; spec' requestors'=(mock . requestors)
    roll 2                  ; requestors' spec'
    ref consume_spec
make_request:
    drop 1                  ; requestors
    push 1000               ; requestors value=1000
    state 2                 ; requestors value callback=referee
    push #?                 ; requestors value callback to_cancel=#?
    state 3                 ; requestors value callback to_cancel cancel_at
    eq #?                   ; requestors value callback to_cancel cancel_at==#?
    if make_sequence        ; requestors value callback to_cancel
    drop 1                  ; requestors value callback
    push canceller.beh      ; requestors value callback canceller_beh
    new 0                   ; requestors value callback canceller=canceller_beh.()
    push #?                 ; requestors value callback canceller message=#?
    pick 2                  ; requestors value callback canceller message target=canceller
    state 3                 ; requestors value callback canceller message target delay=cancel_at
    state 1                 ; requestors value callback canceller message target delay timer
    send 3                  ; requestors value callback to_cancel=canceller
    ref make_sequence
make_sequence:
    pair 2                  ; requestors request=(to_cancel callback . value)
    roll 2                  ; request requestors
    push sequence_beh       ; request requestors sequence_beh
    new 1                   ; request sequence=sequence_beh.(requestors)
    send -1                 ; --
    ref std.commit
    
mock_double_beh:            ; (timer delay error) <- (to_cancel callback . value)
    state 3                 ; error
    if mock_double_fail     ; --
    msg -2                  ; value
    push 2                  ; value 2
    alu mul                 ; value'
    push #t                 ; value' ok=#t
    pair 1                  ; result=(ok . value')
    ref mock_double_timer
mock_double_fail:
    state 3                 ; error
    push #f                 ; error ok=#f
    pair 1                  ; result=(ok . error)
mock_double_timer:
    state 2                 ; result delay
    msg 2                   ; result delay callback
    msg 1                   ; result delay callback to_cancel
    pair 3                  ; timer_request=(to_cancel callback delay . result)
    state 1                 ; timer_request timer
    send -1                 ; --
    ref std.commit

.export
    beh
    boot
    test
