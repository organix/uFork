; The "race" requestor starts a list of 'requestors' in parallel. The value sent
; to the race requestor is sent to each of the requestors, and race's result is
; the result of the first requestor to successfully finish. All of the other
; requestors will be cancelled. If all of the requestors fail, then the race
; fails.

; The 'throttle' parameter limits how many of the requestors are allowed to run
; at once. If provided, it should be a fixnum greater than 0.

; The "fallback" requestor is a special case of the race requestor. To make a
; fallback requestor, simply specify a throttle of 1.

; This module is a port of parseq's race factory, originally written in
; JavaScript. See https://crockford.com/parseq.html.

.import
    canceller: "./canceller.asm"
    dev: "../dev.asm"
    lib: "../lib.asm"
    referee: "../testing/referee.asm"
    std: "../std.asm"
    unwrap_result: "./unwrap_result.asm"

cancel_tag:
    ref 0
start_tag:
    ref 1

beh:
race_beh:                   ; (requestors . throttle) <- request

; The work of handling the request is deferred to a dedicated "runner" actor,
; freeing up the race requestor to accept additional requests.

    msg -2                  ; value
    msg 2                   ; value callback
    state 1                 ; value callback queue=requestors
    push #nil               ; value callback queue running=()
    pair 3                  ; (running queue callback . value)
    push runner_beh         ; (running queue callback . value) runner_beh
    actor create            ; runner=runner_beh.(running queue callback . value)
    state -1                ; runner throttle
    push start_tag          ; runner throttle start_tag
    pair 1                  ; runner (start_tag . throttle)
    pick 2                  ; runner (start_tag . throttle) runner
    actor send              ; runner

; Provide a cancel capability if the request allows for it.

    msg 1                   ; runner to_cancel
    typeq #actor_t          ; runner cap?(to_cancel)
    if_not std.commit       ; runner
    push cancel_tag         ; runner label=cancel_tag
    roll 2                  ; label rcvr=runner
    pair 1                  ; (rcvr . label)
    push lib.label_beh      ; (rcvr . label) label_beh
    actor create            ; cancel=label_beh.(rcvr . label)
    msg 1                   ; cancel to_cancel
    actor send              ; --
    ref std.commit

runner_beh:                 ; (running queue callback . value) <- message

; The "runner" actor processes a single race request.
; There are three kinds of message it expects to receive:

;   (start_tag . quota)
;       Start up to 'quota' requestors from the queue. If 'quota' is omitted,
;       the entire queue is started.

;   (cancel_tag . reason)
;       Cancel all running requestors with the 'reason' and become inert.

;   (canceller . result)
;       A result has arrived from a finished requestor, labelled with its
;       canceller.

    msg 1                   ; tag
    eq start_tag            ; tag==start_tag?
    if start                ; --
    state 1                 ; running
    msg -1                  ; running reason
    msg 1                   ; running reason tag
    eq cancel_tag           ; running reason tag==cancel_tag?
    if cancel               ; running reason
    drop 2                  ; --

; The message is a requestor's result, labelled with its canceller. Mark
; the requestor as finished by removing its canceller from the list of those
; running.

    push #nil               ; dest=()
    state 1                 ; dest src=running
loop:

; Shunt elements from src to dest, excluding the canceller of the finished
; requestor. Note that this algorithm reverses the direction of the list, but
; that doesn't matter.

    pick 1                  ; dest src src
    if_not check_result     ; dest src=(first . rest)
    part 1                  ; dest rest first
    msg 1                   ; dest rest first canceller
    pick 2                  ; dest rest first canceller first
    cmp eq                  ; dest rest first canceller==first
    if skip                 ; dest rest first
    roll 3                  ; rest first dest
    roll 2                  ; rest dest first
    pair 1                  ; rest dest'=(first . dest)
    roll 2                  ; dest' rest
    ref loop
skip:
    drop 1                  ; dest rest
    ref loop
check_result:               ; running'=dest src
    drop 1                  ; running'

; If the requestor succeeded, inform the callback and finish up.

    msg 2                   ; running' ok
    if finish               ; running'

; The requestor failed. Are there any queued requestors? If so, start the next
; one.

    state 2                 ; running' queue
    if start_one            ; running'

; If there are no queued or running requestors then the race has failed.

    dup 1                   ; running' running'
    if_not finish           ; running'
become:
    state -3                ; running' value
    state 3                 ; running' value callback
    state 2                 ; running' value callback queue
    roll 4                  ; value callback queue running'
    pair 3                  ; (running' queue callback . value)
    push runner_beh         ; (running' queue callback . value) runner_beh
    actor become            ; --
    ref std.commit
start_one:
    push 1                  ; running' quota=1
    push start_tag          ; running' quota start_tag
    pair 1                  ; running' (start_tag . quota)
    actor self              ; running' (start_tag . quota) SELF
    actor send              ; running'
    ref become
finish:
    msg -1                  ; running' result
    state 3                 ; running' result callback
    actor send              ; running'
    push #?                 ; running' reason=#?
    ref cancel
start:

; Start as many requestors as the quota allows. We are done once there are no
; more queued requestors, or the quota is exhausted.

    state 1                 ; running
    msg -1                  ; running quota
    state 2                 ; running quota queue
    pick 1                  ; running quota queue queue
    if_not std.commit       ; running quota queue
    part 1                  ; running quota queue' requestor
    pick 3                  ; running quota queue' requestor quota
    typeq #fixnum_t         ; running quota queue' requestor fixnum?(quota)
    if_not pop              ; running quota queue' requestor
    roll 3                  ; running queue' requestor quota
    push 1                  ; running queue' requestor quota 1
    alu sub                 ; running queue' requestor quota'=quota-1
    roll -3                 ; running quota' queue' requestor
    pick 3                  ; running quota' queue' requestor quota'
    push 0                  ; running quota' queue' requestor quota' 0
    cmp lt                  ; running quota' queue' requestor quota'<0
    if std.commit           ; running quota' queue' requestor
pop:

; Start the next queued requestor. Provide it with a unique canceller. The
; result will be delivered to the runner, labelled with the canceller.

    push #?                 ; ... requestor #?
    push canceller.beh      ; ... requestor #? canceller_beh
    actor create            ; ... requestor canceller=canceller_beh.#?
    state -3                ; ... requestor canceller value
    pick 2                  ; ... requestor canceller value label=canceller
    actor self              ; ... requestor canceller value label rcvr=SELF
    pair 1                  ; ... requestor canceller value (rcvr . label)
    push lib.label_beh      ; ... requestor canceller value (rcvr . label) label_beh
    actor create            ; ... requestor canceller value callback=label_beh.(rcvr . label)
    pick 3                  ; ... requestor canceller value callback to_cancel=canceller
    pair 2                  ; ... requestor canceller request=(to_cancel callback . value)
    roll 3                  ; ... canceller request requestor
    actor send              ; ... canceller

; Recurse.

    roll 3                  ; running queue' canceller quota'
    push start_tag          ; running queue' canceller quota' start_tag
    pair 1                  ; running queue' canceller (start_tag . quota')
    actor self              ; running queue' canceller (start_tag . quota') SELF
    actor send              ; running queue' canceller

; Mark the requestor as running.

    state -3                ; running queue' canceller value
    state 3                 ; running queue' canceller value callback
    roll 4                  ; running canceller value callback queue'
    roll 5                  ; canceller value callback queue' running
    roll 5                  ; value callback queue' running canceller
    pair 1                  ; value callback queue' running'=(canceller . running)
    pair 3                  ; (running' queue' callback . value)
    push runner_beh         ; (running' queue' callback . value) runner_beh
    actor become            ; --
    ref std.commit
cancel:                     ; running reason

; Cancel all running requestors and become a sink. Each canceller is sent the
; reason wrapped in a list.

    push #?                 ; running reason #?
    roll 2                  ; running #? reason
    pair 1                  ; running (reason . #?)
    push lib.broadcast_beh  ; running (reason . #?) broadcast_beh
    actor create            ; running broadcast=broadcast_beh.(reason . #?)
    actor send              ; --
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
    push 5000               ; () 4th=5000
    push 3000               ; () 4th 3rd=3000
    push #?                 ; () 4th 3rd 2nd=#?
    push 1000               ; () 4th 3rd 2nd 1st=1000
    push 50                 ; () 4th 3rd 2nd 1st probation=50ms
    msg 0                   ; () 4th 3rd 2nd 1st probation {caps}
    push dev.timer_key      ; () 4th 3rd 2nd 1st probation {caps} timer_key
    dict get                ; () 4th 3rd 2nd 1st probation timer
    state 0                 ; () 4th 3rd 2nd 1st probation timer judge
    pair 7                  ; (judge timer probation 1st 2nd 3rd 4th)
    push referee.beh        ; (judge timer probation 1st 2nd 3rd 4th) referee_beh
    actor create            ; referee=referee_beh.(judge timer probation 1st 2nd 3rd 4th)
    push unwrap_result.beh  ; referee unwrap_result_beh
    actor create            ; referee'=unwrap_result_beh.referee
    ; msg 0                   ; referee' {caps}
    ; push dev.debug_key      ; referee' {caps} debug_key
    ; dict get                ; referee' debug
    ; pair 1                  ; (debug . referee')
    ; push lib.tee_beh        ; (debug . referee') tee_beh
    ; actor create            ; referee''

suite:
    msg 0                   ; referee {caps}
    push dev.timer_key      ; referee {caps} timer_key
    dict get                ; referee timer

; Four requestors are raced, all of which fail except the third.
; Expected output: (#t . +1000) @ 15ms

    dup 2                   ; ... referee timer
    push #?                 ; ... referee timer throttle=#?
    push #?                 ; ... referee timer throttle cancel_at=#?
    push #nil               ; ... ... ()
    push 5                  ; ... ... 1st_delay=5ms
    push 666                ; ... ... 1st_error=666
    push #f                 ; ... ... 1st_ok=#f
    push 10                 ; ... ... 2nd_delay=10ms
    push 666                ; ... ... 2nd_error=666
    push #f                 ; ... ... 2nd_ok=#f
    push 15                 ; ... ... 3rd_delay=15ms
    push 1000               ; ... ... 3rd_value=1000
    push #t                 ; ... ... 3rd_ok=#t
    push 20                 ; ... ... 4th_delay=20ms
    push 666                ; ... ... 4th_error=666
    push #f                 ; ... ... 4th_ok=#f
    pair 12                 ; ... referee timer throttle cancel_at spec
    call run_test           ; ...

; Two requestors are raced, both of which fail.
; Expected output: (#f . +666) @ 30ms

    dup 2                   ; ... referee timer
    push #?                 ; ... referee timer throttle=#?
    push #?                 ; ... referee timer throttle cancel_at=#?
    push #nil               ; ... ... ()
    push 25                 ; ... ... 1st_delay=25ms
    push 666                ; ... ... 1st_error=666
    push #f                 ; ... ... 1st_ok=#f
    push 30                 ; ... ... 2nd_delay=30ms
    push 666                ; ... ... 2nd_error=666
    push #f                 ; ... ... 2nd_ok=#f
    pair 6                  ; ... referee timer throttle cancel_at spec
    call run_test           ; ...

; Two requestors are raced, both of which succeed.
; Expected output: (#t . +3000) @ 35ms

    dup 2                   ; ... referee timer
    push #?                 ; ... referee timer throttle=#?
    push #?                 ; ... referee timer throttle cancel_at=#?
    push #nil               ; ... ... ()
    push 35                 ; ... ... 1st_delay=35ms
    push 3000               ; ... ... 1st_value=3000
    push #t                 ; ... ... 1st_ok=#t
    push 40                 ; ... ... 2nd_delay=40ms
    push -3000              ; ... ... 2nd_value=-3000
    push #t                 ; ... ... 2nd_ok=#t
    pair 6                  ; ... referee timer throttle cancel_at spec
    call run_test           ; ...

; Two requestors are raced, but the race is cancelled before one succeeds.
; Expected output: nothing

    dup 2                   ; ... referee timer
    push #?                 ; ... referee timer throttle=#?
    push 50                 ; ... referee timer throttle cancel_at=50ms
    push #nil               ; ... ... ()
    push 45                 ; ... ... 1st_delay=45ms
    push 666                ; ... ... 1st_error=666
    push #f                 ; ... ... 1st_ok=#f
    push 55                 ; ... ... 2nd_delay=55ms
    push 4000               ; ... ... 2nd_value=4000
    push #t                 ; ... ... 2nd_ok=#t
    pair 6                  ; ... referee timer throttle cancel_at spec
    call run_test           ; ...

; Fallback. Three requestors are raced, throttled one at a time.
; Expected output: (#t . +5000) @ 45ms

    dup 2                   ; ... referee timer
    push 1                  ; ... referee timer throttle=1
    push #?                 ; ... referee timer throttle cancel_at=#?
    push #nil               ; ... ... ()
    push 30                 ; ... ... 1st_delay=30ms
    push 666                ; ... ... 1st_error=666
    push #f                 ; ... ... 1st_ok=#f
    push 15                 ; ... ... 2nd_delay=15ms
    push 5000               ; ... ... 2nd_value=5000
    push #t                 ; ... ... 2nd_ok=#t
    push 5                  ; ... ... 3rd_delay=5ms
    push -5000              ; ... ... 3rd_value=-5000
    push #t                 ; ... ... 3rd_ok=#t
    pair 9                  ; ... referee timer throttle cancel_at spec
    call run_test           ; ...
    ref std.commit

run_test:                   ; ( referee timer throttle cancel_at spec -- )

; The 'spec' is a list describing the requestors to be raced.
; It should look something like

;   (ok value delay ... ok value delay ok value delay)
;    \---- nth ---/ ... \---- 2nd ---/ \---- 1st ---/

; where 1st denotes the first requestor, 2nd denotes the second requestor, etc.

    roll -6                 ; k referee timer throttle cancel_at spec
    push #nil               ; k referee timer throttle cancel_at spec requestors=()

; The spec is consumed three elements at a time, until it is empty.

consume_spec:
    roll 2                  ; k referee timer throttle cancel_at requestors spec
    dup 1                   ; k referee timer throttle cancel_at requestors spec spec
    if_not make_request     ; k referee timer throttle cancel_at requestors spec
    part 3                  ; k referee timer throttle cancel_at requestors spec' delay value/error ok
    pair 1                  ; k referee timer throttle cancel_at requestors spec' delay result=(ok . value/error)
    pick 7                  ; k referee timer throttle cancel_at requestors spec' delay result timer
    pair 2                  ; k referee timer throttle cancel_at requestors spec' (timer result . delay)
    push mock_beh           ; k referee timer throttle cancel_at requestors spec' (timer result . delay) mock_beh
    actor create            ; k referee timer throttle cancel_at requestors spec' mock=mock_beh.(timer delay . result)
    roll 3                  ; k referee timer throttle cancel_at spec' mock requestors
    roll 2                  ; k referee timer throttle cancel_at spec' requestors mock
    pair 1                  ; k referee timer throttle cancel_at spec' requestors'=(mock . requestors)
    ref consume_spec
make_request:               ; k referee timer throttle cancel_at requestors spec
    drop 1                  ; k referee timer throttle cancel_at requestors
    push #?                 ; k referee timer throttle cancel_at requestors value=#?
    roll 6                  ; k timer throttle cancel_at requestors value callback=referee
    push #?                 ; k timer throttle cancel_at requestors value callback to_cancel=#?
    pick 5                  ; k timer throttle cancel_at requestors value callback to_cancel cancel_at
    eq #?                   ; k timer throttle cancel_at requestors value callback to_cancel cancel_at==#?
    if make_race            ; k timer throttle cancel_at requestors value callback to_cancel
    drop 1                  ; k timer throttle cancel_at requestors value callback
    push #?                 ; k timer throttle cancel_at requestors value callback #?
    push canceller.beh      ; k timer throttle cancel_at requestors value callback #? canceller_beh
    actor create            ; k timer throttle cancel_at requestors value callback canceller=canceller_beh.#?
    push #?                 ; k timer throttle cancel_at requestors value callback canceller message=#?
    pick 2                  ; k timer throttle cancel_at requestors value callback canceller message target=canceller
    pick 7                  ; k timer throttle cancel_at requestors value callback canceller message target delay=cancel_at
    pair 2                  ; k timer throttle cancel_at requestors value callback canceller (delay target . message)
    pick 8                  ; k timer throttle cancel_at requestors value callback canceller (delay target . message) timer
    actor send              ; k timer throttle cancel_at requestors value callback to_cancel=canceller
make_race:
    pair 2                  ; k timer throttle cancel_at requestors request=(to_cancel callback . value)
    roll 4                  ; k timer cancel_at requestors request throttle
    roll 3                  ; k timer cancel_at request throttle requestors
    pair 1                  ; k timer cancel_at request (requestors . throttle)
    push race_beh           ; k timer cancel_at request (requestors . throttle) race_beh
    actor create            ; k timer cancel_at request race=race_beh.(requestors . throttle)
    actor send              ; k timer cancel_at
    drop 2                  ; k
    return

mock_beh:                   ; (timer result . delay) <- request

; A requestor that produces a given 'result' after 'delay' milliseconds.

    state 2                 ; result
    state -2                ; result delay
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
