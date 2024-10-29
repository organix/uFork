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
sequence_beh:               ; requestors <- (to_cancel callback . value)

; The work of handling the request is deferred to a dedicated "runner" actor,
; freeing up the sequence requestor to accept additional requests.

    push #?                 ; canceller=#?
    msg 2                   ; canceller callback
    state 0                 ; canceller callback requestors
    pair 2                  ; (requestors callback . canceller)
    push runner_beh         ; (requestors callback . canceller) runner_beh
    actor create            ; runner=runner_beh.(requestors callback . canceller)
    msg -2                  ; runner value
    push start_tag          ; runner value start_tag
    pair 1                  ; runner (start_tag . value)
    pick 2                  ; runner (start_tag . value) runner
    actor send              ; runner

; Provide a cancel capability if the request allows for it.

    msg 1                   ; runner to_cancel
    typeq #actor_t          ; runner cap?(to_cancel)
    if_not std.commit       ; runner
    push cancel_tag         ; runner label=cancel_tag
    roll 2                  ; label rcvr=runner
    pair 1                  ; (rcvr . label)
    push lib.label_beh      ; (rcvr . label) label_beh
    actor create            ; cancel=label_beh.(rcvr label)
    msg 1                   ; cancel to_cancel
    actor send              ; --
    ref std.commit

runner_beh:                 ; (requestors callback . canceller) <- message

; The "runner" actor processes a single sequence request.
; There are three kinds of message it expects to receive:

;   (start_tag . value)
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
    
on_result:                  ; (requestors callback . canceller) <- (result_tag . result)
    msg 2                   ; ok
    if_not fail             ; --
    msg -2                  ; value
    push start_tag          ; value start_tag
    pair 1                  ; (start_tag . value)
    my self                 ; (start_tag . value) SELF
    actor send              ; --
    ref std.commit

fail:                       ; --
    msg -1                  ; result
    state 2                 ; result callback
    actor send              ; --
    ref done

on_start:                   ; (requestors callback . _) <- (start_tag . value)
    state 1                 ; requestors
    if_not succeed          ; --
    push #?                 ; #?
    push canceller.beh      ; #? canceller_beh
    actor create            ; canceller=canceller_beh.#?
    state 1                 ; canceller requestors
    part 1                  ; canceller pending next
    msg -1                  ; canceller pending next value
    push result_tag         ; canceller pending next value label=result_tag
    my self                 ; canceller pending next value label rcvr=SELF
    pair 1                  ; canceller pending next value (rcvr . label)
    push lib.label_beh      ; canceller pending next value (rcvr . label) label_beh
    actor create            ; canceller pending next value callback=label_beh.(rcvr . label)
    pick 5                  ; canceller pending next value callback to_cancel=canceller
    pair 2                  ; canceller pending next request=(to_cancel callbackvalue)
    roll 2                  ; canceller pending request=(to_cancel callback=SELF value) next
    actor send              ; canceller pending
    state 2                 ; canceller pending callback
    roll 2                  ; canceller callback pending
    pair 2                  ; (pending callback . canceller)
    push runner_beh         ; (pending callback . canceller) runner_beh
    actor become            ; --
    ref std.commit

succeed:
    msg -1                  ; value
    push #t                 ; value ok=#t
    pair 1                  ; result=(ok . value)
    state 2                 ; result callback
    actor send              ; --
    ref done

on_cancel:                  ; (requestors callback . canceller) <- (cancel_tag . reason)
    push #?                 ; #?
    msg -1                  ; #? reason
    pair 1                  ; (reason . #?)
    state -2                ; (reason . #?) canceller
    actor send              ; --
    ref done

done:
    push #?                 ; #?
    push std.sink_beh       ; #? sink_beh
    actor become            ; --
    ref std.commit

; Test suite

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; referee=debug
    ref suite
test:                       ; judge <- {caps}

; FIXME: Validate the entire result, not just the result's value. This requires
; some kind of "deep" validator.

    push #nil               ; ()
    push #?                 ; () 3rd=#?
    push 4000               ; () 3rd 2nd=4000
    push 1000               ; () 3rd 2nd 1st=1000
    push 50                 ; () 3rd 2nd 1st probation=50ms
    msg 0                   ; () 3rd 2nd 1st probation {caps}
    push dev.timer_key      ; () 3rd 2nd 1st probation {caps} timer_key
    dict get                ; () 3rd 2nd 1st probation timer
    state 0                 ; () 3rd 2nd 1st probation timer judge
    pair 6                  ; (judge timer probation 1st 2nd 3rd)
    push referee.beh        ; (judge timer probation 1st 2nd 3rd) referee_beh
    actor create            ; referee=referee_beh.(judge timer probation 1st 2nd 3rd)
    push unwrap_result.beh  ; referee unwrap_result_beh
    actor create            ; referee'=unwrap_result_beh.referee
suite:
    msg 0                   ; referee {caps}
    push dev.timer_key      ; referee {caps} timer_key
    dict get                ; referee timer

; An empty requestor list is provided.
; Expected output: (#t . +1000) @ 0ms

    dup 2                   ; ... referee timer
    push #?                 ; ... referee timer cancel_at=#?
    push #nil               ; ... referee timer cancel_at spec=()
    call run_test           ; ...

; Two successful requestors.
; Expected output: (#t . +4000) @ 15ms

    dup 2                   ; ... referee timer
    push #?                 ; ... referee timer cancel_at=#?
    push #nil               ; ... ... ()
    push #?                 ; ... ... 1st_error=#?
    push 5                  ; ... ... 1st_delay=5ms
    push #?                 ; ... ... 2nd_error=#?
    push 10                 ; ... ... 2nd_delay=10ms
    pair 4                  ; ... referee timer cancel_at spec
    call run_test           ; ...

; Three requestors, cancelled before the second one can finish.
; Expected output: nothing

    dup 2                   ; ... referee timer
    push 15                 ; ... referee timer cancel_at=15ms
    push #nil               ; ... ... ()
    push #?                 ; ... ... 1st_error=#?
    push 10                 ; ... ... 1st_delay=10ms
    push #?                 ; ... ... 2nd_error=#?
    push 10                 ; ... ... 2nd_delay=10ms
    push #?                 ; ... ... 3rd_error=#?
    push 10                 ; ... ... 3rd_delay=10ms
    pair 6                  ; ... referee timer cancel_at spec
    call run_test           ; ...

; Three requestors, the second one fails.
; Expected output: (#f . 666) at 20ms

    dup 2                   ; ... referee timer
    push #?                 ; ... referee timer cancel_at=#?
    push #nil               ; ... ... ()
    push #?                 ; ... ... 1st_error=#?
    push 10                 ; ... ... 1st_delay=10ms
    push 666                ; ... ... 2nd_error=666
    push 10                 ; ... ... 2nd_delay=10ms
    push #?                 ; ... ... 3rd_error=#?
    push 10                 ; ... ... 3rd_delay=10ms
    pair 6                  ; ... referee timer cancel_at spec
    call run_test           ; ...
    ref std.commit

run_test:                   ; ( referee timer cancel_at spec -- )

; The 'spec' is a list describing the sequence of requestors to be run.
; It should look something like

;   (delay error ... delay error delay error)
;    \-- nth --/ ... \-- 2nd --/ \-- 1st --/

; where 1st denotes the first requestor, 2nd denotes the second requestor, etc.

    roll -5                 ; k referee timer cancel_at spec
    push #nil               ; k referee timer cancel_at spec requestors=()

; The spec is consumed two elements at a time, until it is empty.

consume_spec:
    roll 2                  ; k referee timer cancel_at requestors spec
    dup 1                   ; k referee timer cancel_at requestors spec spec
    if_not make_request     ; k referee timer cancel_at requestors spec
    part 2                  ; k referee timer cancel_at requestors spec' error delay
    pick 6                  ; k referee timer cancel_at requestors spec' error delay timer
    pair 2                  ; k referee timer cancel_at requestors spec' (timer delay . error)
    push mock_double_beh    ; k referee timer cancel_at requestors spec' (timer delay . error) mock_double_beh
    actor create            ; k referee timer cancel_at requestors spec' mock=mock_double_beh.(timer delay . error)
    roll 3                  ; k referee timer cancel_at spec' mock requestors
    roll 2                  ; k referee timer cancel_at spec' requestors mock
    pair 1                  ; k referee timer cancel_at spec' requestors'=(mock . requestors)
    ref consume_spec
make_request:               ; k referee timer cancel_at requestors spec
    drop 1                  ; k referee timer cancel_at requestors
    push 1000               ; k referee timer cancel_at requestors value=1000
    roll 5                  ; k timer cancel_at requestors value callback=referee
    push #?                 ; k timer cancel_at requestors value callback to_cancel=#?
    pick 5                  ; k timer cancel_at requestors value callback to_cancel cancel_at
    eq #?                   ; k timer cancel_at requestors value callback to_cancel cancel_at==#?
    if make_sequence        ; k timer cancel_at requestors value callback to_cancel
    drop 1                  ; k timer cancel_at requestors value callback
    push #?                 ; k timer cancel_at requestors value callback #?
    push canceller.beh      ; k timer cancel_at requestors value callback #? canceller_beh
    actor create            ; k timer cancel_at requestors value callback canceller=canceller_beh.#?
    push #?                 ; k timer cancel_at requestors value callback canceller message=#?
    pick 2                  ; k timer cancel_at requestors value callback canceller message target=canceller
    pick 7                  ; k timer cancel_at requestors value callback canceller message target delay=cancel_at
    pair 2                  ; k timer cancel_at requestors value callback canceller (delay target . message)
    pick 7                  ; k timer cancel_at requestors value callback canceller (delay target . message) timer
    actor send              ; k timer cancel_at requestors value callback to_cancel=canceller
make_sequence:
    pair 2                  ; k timer cancel_at requestors request=(to_cancel callback . value)
    roll 2                  ; k timer cancel_at request requestors
    push sequence_beh       ; k timer cancel_at request requestors sequence_beh
    actor create            ; k timer cancel_at request sequence=sequence_beh.requestors
    actor send              ; k timer cancel_at
    drop 2                  ; k
    return
    
mock_double_beh:            ; (timer delay . error) <- (to_cancel callback . value)
    state -2                ; error
    if mock_double_fail     ; --
    msg -2                  ; value
    push 2                  ; value 2
    alu mul                 ; value'
    push #t                 ; value' ok=#t
    pair 1                  ; result=(ok . value')
    ref mock_double_timer
mock_double_fail:
    state -2                ; error
    push #f                 ; error ok=#f
    pair 1                  ; result=(ok . error)
mock_double_timer:
    state 2                 ; result delay
    msg 2                   ; result delay callback
    msg 1                   ; result delay callback to_cancel
    pair 3                  ; timer_request=(to_cancel callback delay . result)
    state 1                 ; timer_request timer
    actor send              ; --
    ref std.commit

.export
    beh
    boot
    test
