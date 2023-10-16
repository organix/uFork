;
; Test fixtures and mock-objects
;

.import
    std: "./std.asm"
    dev: "./dev.asm"

; A mock-object representing a failed test.
; Non-verify messages are ignored.

failed:                 ; (ctrl) <- (ctrl')
    state 1             ; ctrl
    msg 1               ; ctrl ctrl'
    cmp eq              ; ctrl==ctrl'
    if std.rv_false     ; --  // verify returns `#f` verdict
    ref std.commit

; Become `failed`

fail:                   ; --
    state 1             ; ctrl
    push failed         ; ctrl failed
    beh 1               ; --
    ref std.commit

; A mock-object representing a successful test.
; Non-verify messages cause failure.

success:                ; (ctrl) <- (ctrl')
    state 1             ; ctrl
    msg 1               ; ctrl ctrl'
    cmp eq              ; ctrl==ctrl'
    if std.rv_true      ; --  // verify returns `#t` verdict
    ref fail

; Become `success`

ok:                     ; --
    state 1             ; ctrl
    push success        ; ctrl success
    beh 1               ; --
    ref std.commit

; A mock-object that expects a single matching message.

mock_eq:                ; (ctrl expect) <- (ctrl') | actual
    state 1             ; ctrl
    msg 1               ; ctrl ctrl'
    cmp eq              ; ctrl==ctrl'
    if std.rv_false     ; --  // verify returns `#f` verdict

    state 2             ; expect
    msg 0               ; expect actual
    cmp eq              ; expect==actual
    if ok fail          ; --

; A mock-object that expects `pred(actual)` is truthy.

mock_pred:              ; (ctrl pred) <- (ctrl') | actual
    state 1             ; ctrl
    msg 1               ; ctrl ctrl'
    cmp eq              ; ctrl==ctrl'
    if std.rv_false     ; --  // verify returns `#f` verdict

    msg 0               ; actual
    state 1             ; actual ctrl
    push mock_pred_ok   ; actual ctrl mock_pred_ok
    new 1               ; actual cust=mock_pred_ok.(ctrl)
    state 2             ; actual cust pred
    send 2              ; --
    ref std.commit

mock_pred_ok:           ; (ctrl) <- bool
    msg 0               ; truthy
    if ok fail          ; --

; A mock-object that verifies a list of mocks.

mock_list_setup:        ; (ctrl) <- mocks
    msg 0               ; mocks
    state 1             ; mocks ctrl
    pair 1              ; (ctrl . mocks)
    push mock_list      ; (ctrl . mocks) mock_list
    beh -1              ; --
    ref std.commit

mock_list:              ; (ctrl . mocks) <- (ctrl')
    state 1             ; ctrl
    msg 1               ; ctrl ctrl'
    cmp eq              ; ctrl==ctrl'
    if_not std.rv_false ; --  // verify returns `#f` verdict

    state -1            ; mocks
    part 1              ; mocks' mock
    dup 1               ; mocks' mock mock
    typeq #actor_t      ; mocks' mock is_actor(mocks)
    if_not std.rv_true  ; mocks' mock  // return `#t` verdict at end

    my self             ; mocks' mock SELF
    roll 2              ; mocks' SELF mock
    send 1              ; mocks'

    state 1             ; mocks' ctrl
    pair 1              ; (ctrl . mocks')
    push mock_list_ok   ; (ctrl . mocks') mock_list_ok
    beh -1              ; --
    ref std.commit

mock_list_ok:           ; (ctrl . mocks) <- verdict
    msg 0               ; truthy
    if_not mock_list_f  ; --

    state 0             ; (ctrl . mocks)
    push mock_list      ; (ctrl . mocks') mock_list
    beh -1              ; --

    state 1             ; ctrl
    my self             ; ctrl SELF
    send 1              ; --
    ref std.commit

mock_list_f:            ; --
    push #f             ; #f  // return `#f` on first failure
    state 1             ; #f ctrl
    ref std.send_msg

; A verify customer that asserts success.

assert_ok:              ; _ <- verdict
    debug               ; pause if running in debugger
    msg 0               ; verdict
    assert #t           ; assert(verdict==#t)
    ref std.commit

;
; Test suite
;

; setup the mock

step_0:                 ; (debug timer) <- ()
    push 42             ; expect=42
    my self             ; expect ctrl=SELF
    push mock_eq        ; expect ctrl mock_eq
    new 2               ; mock=mock_eq.(ctrl 42)
    my self             ; mock SELF
    send -1             ; --

    state 0             ; state
    push step_1         ; state beh=step_1
    beh -1              ; --
    ref std.commit

; first mock interaction

step_1:                 ; (debug timer) <- mock
    msg 0               ; mock
    my self             ; mock SELF
    send -1             ; --

;    push 86             ; 86  // non-matching message
    push 42             ; 42  // matching message
    msg 0               ; 42 mock
    send -1             ; --

    state 0             ; state
;    push step_2         ; state beh=step_2  // step 2 causes failure...
    push step_3         ; state beh=step_3
    beh -1              ; --
    ref std.commit

; second mock interaction

step_2:                 ; (debug timer) <- mock
    msg 0               ; mock
    my self             ; mock SELF
    send -1             ; --

;    push 86             ; 86  // non-matching message
    push 42             ; 42  // matching message
    msg 0               ; 42 mock
    send -1             ; --

    state 0             ; state
    push step_3         ; state beh=step_3
    beh -1              ; --
    ref std.commit

; verify the mock

step_3:                 ; (debug timer) <- mock
    my self             ; ctrl=SELF
    msg 0               ; ctrl mock
    send 1              ; --

    push assert_ok      ; assert_ok
    beh 0               ; --
    ref std.commit

; run test suite on boot

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push dev.timer_key  ; {caps} timer_key
    dict get            ; timer
    msg 0               ; timer {caps}
    push dev.debug_key  ; timer {caps} debug_key
    dict get            ; timer debug
    push step_0         ; timer debug step_0
    new 2               ; test=step_0.(debug timer)
    send 0              ; --
    ref std.commit

.export
    failed
    success
    mock_eq
    assert_ok
    boot
