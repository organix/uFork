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
race_beh:                   ; (requestors throttle) <- request

; The work of handling the request is deferred to a dedicated "runner" actor,
; freeing up the race requestor to accept additional requests.

    msg -2                  ; value
    msg 2                   ; value callback
    state 1                 ; value callback queue=requestors
    push #nil               ; value callback queue running=()
    push runner_beh         ; value callback queue running runner_beh
    new 4                   ; runner=runner_beh.(running queue callback value)
    state 2                 ; runner throttle
    push start_tag          ; runner throttle start_tag
    pick 3                  ; runner throttle start_tag runner
    send 2                  ; runner

; Provide a cancel capability if the request allows for it.

    msg 1                   ; runner to_cancel
    typeq #actor_t          ; runner cap?(to_cancel)
    if_not std.commit       ; runner
    push cancel_tag         ; runner label=cancel_tag
    roll 2                  ; label rcvr=runner
    pair 1                  ; (rcvr . label)
    push lib.label_beh      ; (rcvr . label) label_beh
    new -1                  ; cancel=label_beh.(rcvr . label)
    msg 1                   ; cancel to_cancel
    send -1                 ; --
    ref std.commit

runner_beh:                 ; (running queue callback value) <- message

; The "runner" actor processes a single race request.
; There are three kinds of message it expects to receive:

;   (start_tag quota)
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
    state 4                 ; running' value
    state 3                 ; running' value callback
    state 2                 ; running' value callback queue
    roll 4                  ; value callback queue running'
    my beh                  ; value callback queue running' BEH
    beh 4                   ; --
    ref std.commit
start_one:
    push 1                  ; running' quota=1
    push start_tag          ; running' quota start_tag
    my self                 ; running' quota start_tag SELF
    send 2                  ; running'
    ref become
finish:
    msg -1                  ; running' result
    state 3                 ; running' result callback
    send -1                 ; running'
    push #?                 ; running' reason=#?
    ref cancel
start:

; Start as many requestors as the quota allows. We are done once there are no
; more queued requestors, or the quota is exhausted.

    state 1                 ; running
    msg 2                   ; running quota
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

    push canceller.beh      ; ... requestor canceller_beh
    new 0                   ; ... requestor canceller=canceller_beh.()
    state 4                 ; ... requestor canceller value
    pick 2                  ; ... requestor canceller value label=canceller
    my self                 ; ... requestor canceller value label rcvr=SELF
    pair 1                  ; ... requestor canceller value (rcvr . label)
    push lib.label_beh      ; ... requestor canceller value (rcvr . label) label_beh
    new -1                  ; ... requestor canceller value callback=label_beh.(rcvr . label)
    pick 3                  ; ... requestor canceller value callback to_cancel=canceller
    pair 2                  ; ... requestor canceller request=(to_cancel callback . value)
    roll 3                  ; ... canceller request requestor
    send -1                 ; ... canceller

; Recurse.

    roll 3                  ; running queue' canceller quota'
    push start_tag          ; running queue' canceller quota' start_tag
    my self                 ; running queue' canceller quota' start_tag SELF
    send 2                  ; running queue' canceller

; Mark the requestor as running.

    state 4                 ; running queue' canceller value
    state 3                 ; running queue' canceller value callback
    roll 4                  ; running canceller value callback queue'
    roll 5                  ; canceller value callback queue' running
    roll 5                  ; value callback queue' running canceller
    pair 1                  ; value callback queue' running'=(canceller . running)
    my beh                  ; value callback queue' running' BEH
    beh 4                   ; --
    ref std.commit
cancel:                     ; running reason

; Cancel all running requestors and become a sink. Each canceller is sent the
; reason wrapped in a list.

    push #nil               ; running reason ()
    roll 2                  ; running () reason
    pair 1                  ; running (reason)
    push lib.broadcast_beh  ; running (reason) broadcast_beh
    new -1                  ; running broadcast=broadcast_beh.(reason)
    send -1                 ; --
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

    push 5000               ; 4th=5000
    push 3000               ; 4th 3rd=3000
    push #?                 ; 4th 3rd 2nd=#?
    push 1000               ; 4th 3rd 2nd 1st=1000
    push 50                 ; 4th 3rd 2nd 1st probation=50ms
    msg 0                   ; 4th 3rd 2nd 1st probation {caps}
    push dev.timer_key      ; 4th 3rd 2nd 1st probation {caps} timer_key
    dict get                ; 4th 3rd 2nd 1st probation timer
    state 1                 ; 4th 3rd 2nd 1st probation timer verdict
    push referee.beh        ; 4th 3rd 2nd 1st probation timer verdict referee_beh
    new 7                   ; referee=referee_beh.(verdict timer probation 1st 2nd 3rd 4th)
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

; Four requestors are raced, all of which fail except the third.
; Expected output: (#t . +1000) @ 15ms

    push 5                  ; ... 1st_delay=5ms
    push 666                ; ... 1st_error=666
    push #f                 ; ... 1st_ok=#f
    push 10                 ; ... 2nd_delay=10ms
    push 666                ; ... 2nd_error=666
    push #f                 ; ... 2nd_ok=#f
    push 15                 ; ... 3rd_delay=15ms
    push 1000               ; ... 3rd_value=1000
    push #t                 ; ... 3rd_ok=#t
    push 20                 ; ... 4th_delay=20ms
    push 666                ; ... 4th_error=666
    push #f                 ; ... 4th_ok=#f
    push #?                 ; ... throttle=#?
    state 2                 ; ... throttle referee
    state 1                 ; ... throttle referee timer
    push test_beh           ; ... throttle referee timer test_beh
    new 3                   ; ... test=test_beh.(timer referee throttle)
    send 12                 ; --

; Two requestors are raced, both of which fail.
; Expected output: (#f . +666) @ 30ms

    push 25                 ; ... 1st_delay=25ms
    push 666                ; ... 1st_error=666
    push #f                 ; ... 1st_ok=#f
    push 30                 ; ... 2nd_delay=30ms
    push 666                ; ... 2nd_error=666
    push #f                 ; ... 2nd_ok=#f
    push #?                 ; ... throttle=#?
    state 2                 ; ... throttle referee
    state 1                 ; ... throttle referee timer
    push test_beh           ; ... throttle referee timer test_beh
    new 3                   ; ... test=test_beh.(timer referee throttle)
    send 6                  ; --

; Two requestors are raced, both of which succeed.
; Expected output: (#t . +3000) @ 35ms

    push 35                 ; ... 1st_delay=35ms
    push 3000               ; ... 1st_value=3000
    push #t                 ; ... 1st_ok=#t
    push 40                 ; ... 2nd_delay=40ms
    push -3000              ; ... 2nd_value=-3000
    push #t                 ; ... 2nd_ok=#t
    push #?                 ; ... throttle=#?
    state 2                 ; ... throttle referee
    state 1                 ; ... throttle referee timer
    push test_beh           ; ... throttle referee timer test_beh
    new 3                   ; ... test=test_beh.(timer referee throttle)
    send 6                  ; --

; Two requestors are raced, but the race is cancelled before one succeeds.
; Expected output: nothing

    push 45                 ; ... 1st_delay=45ms
    push 666                ; ... 1st_error=666
    push #f                 ; ... 1st_ok=#f
    push 55                 ; ... 2nd_delay=55ms
    push 4000               ; ... 2nd_value=4000
    push #t                 ; ... 2nd_ok=#t
    push 50                 ; ... cancel_at=50ms
    push #?                 ; ... cancel_at throttle=#?
    state 2                 ; ... cancel_at throttle referee
    state 1                 ; ... cancel_at throttle referee timer
    push test_beh           ; ... cancel_at throttle referee timer test_beh
    new 4                   ; ... test=test_beh.(timer referee throttle cancel_at)
    send 6                  ; --

; Fallback. Three requestors are raced, throttled one at a time.
; Expected output: (#t . +5000) @ 45ms

    push 30                 ; ... 1st_delay=30ms
    push 666                ; ... 1st_error=666
    push #f                 ; ... 1st_ok=#f
    push 15                 ; ... 2nd_delay=15ms
    push 5000               ; ... 2nd_value=5000
    push #t                 ; ... 2nd_ok=#t
    push 5                  ; ... 3rd_delay=5ms
    push -5000              ; ... 3rd_value=-5000
    push #t                 ; ... 3rd_ok=#t
    push 1                  ; ... throttle=1
    state 2                 ; ... throttle referee
    state 1                 ; ... throttle referee timer
    push test_beh           ; ... throttle referee timer test_beh
    new 3                   ; ... test=test_beh.(timer referee throttle)
    send 9                  ; --
    ref std.commit

test_beh:                   ; (timer referee throttle cancel_at) <- spec

; The 'spec' is a list describing the requestors to be raced.
; It should look something like

;   (ok value delay ... ok value delay ok value delay)
;    \---- nth ---/ ... \---- 2nd ---/ \---- 1st ---/

; where 1st denotes the first requestor, 2nd denotes the second requestor, etc.

    push #nil               ; requestors=()
    msg 0                   ; requestors spec

; The spec is consumed three elements at a time, until it is empty.

consume_spec:
    dup 1                   ; requestors spec spec
    if_not make_request     ; requestors spec
    part 3                  ; requestors spec' delay value/error ok
    pair 1                  ; requestors spec' delay result=(ok . value/error)
    roll -2                 ; requestors spec' result delay
    state 1                 ; requestors spec' result delay timer
    push mock_beh           ; requestors spec' result delay timer mock_beh
    new 3                   ; requestors spec' mock=mock_beh.(timer delay result)
    roll 3                  ; spec' mock requestors
    roll 2                  ; spec' requestors mock
    pair 1                  ; spec' requestors'=(mock . requestors)
    roll 2                  ; requestors' spec'
    ref consume_spec
make_request:
    drop 1                  ; requestors
    push #?                 ; requestors value=#?
    state 2                 ; requestors value callback=referee
    push #?                 ; requestors value callback to_cancel=#?
    state 4                 ; requestors value callback to_cancel cancel_at
    eq #?                   ; requestors value callback to_cancel cancel_at==#?
    if make_race            ; requestors value callback to_cancel
    drop 1                  ; requestors value callback
    push canceller.beh      ; requestors value callback canceller_beh
    new 0                   ; requestors value callback canceller=canceller_beh.()
    push #?                 ; requestors value callback canceller message=#?
    pick 2                  ; requestors value callback canceller message target=canceller
    state 4                 ; requestors value callback canceller message target delay=cancel_at
    state 1                 ; requestors value callback canceller message target delay timer
    send 3                  ; requestors value callback to_cancel=canceller
    ref make_race
make_race:
    pair 2                  ; requestors request=(to_cancel callback . value)
    state 3                 ; requestors request throttle
    roll 3                  ; request throttle requestors
    push race_beh           ; request throttle requestors race_beh
    new 2                   ; request race=race_beh.(requestors throttle)
    send -1                 ; --
    ref std.commit

mock_beh:                   ; (timer delay result) <- request

; A requestor that produces a given 'result' after 'delay' milliseconds.

    state 3                 ; result
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
