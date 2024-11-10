;
; Test fixtures and mock-objects
;

.import
    std: "../std.asm"
    dev: "../dev.asm"

; A mock-object representing a failed test.
; Non-verify messages are ignored.

failed:                     ; ctrl <- ctrl'
    state 0                 ; ctrl
    msg 0                   ; ctrl ctrl'
    cmp eq                  ; ctrl==ctrl'
    if mock_false           ; --  // verify returns `#f` verdict
    ref std.commit
mock_false:
    push #f                 ; #f
    msg 0                   ; #f ctrl
    ref std.send_msg

; A mock-object representing a successful test.
; Non-verify messages cause failure.

success:                    ; ctrl <- ctrl'
    state 0                 ; ctrl
    msg 0                   ; ctrl ctrl'
    cmp eq                  ; ctrl==ctrl'
    if mock_true            ; --  // verify returns `#t` verdict
    state 0                 ; ctrl
    push failed             ; ctrl failed
    actor become            ; --
    ref std.commit
mock_true:
    push #t                 ; #t
    msg 0                   ; #t ctrl
    ref std.send_msg

; A mock-object that expects a single matching message.

mock_eq:                    ; (ctrl . expect) <- ctrl' | actual
    state 1                 ; ctrl
    msg 0                   ; ctrl ctrl'
    cmp eq                  ; ctrl==ctrl'
    if mock_false           ; --  // verify returns `#f` verdict

    state -1                ; expect
    msg 0                   ; expect actual
    cmp eq                  ; expect==actual
    if ok fail              ; --

; Become `failed`

fail:                       ; --
    state 1                 ; ctrl
    push failed             ; ctrl failed
    actor become            ; --
    ref std.commit

; Become `success`

ok:                         ; --
    state 1                 ; ctrl
    push success            ; ctrl success
    actor become            ; --
    ref std.commit

; A mock-object that expects `pred(actual)` is truthy.

mock_pred:                  ; (ctrl . pred) <- ctrl' | actual
    state 1                 ; ctrl
    msg 0                   ; ctrl ctrl'
    cmp eq                  ; ctrl==ctrl'
    if mock_false           ; --  // verify returns `#f` verdict

    push #nil               ; () actual
    msg 0                   ; () actual
    push #?                 ; () actual #?
    state 1                 ; () actual #? ctrl
    pair 1                  ; () actual (ctrl . #?)
    push mock_pred_ok       ; () actual (ctrl . #?) mock_pred_ok
    actor create            ; () actual cust=mock_pred_ok.(ctrl . #?)
    pair 2                  ; (cust actual)
    state -1                ; (cust actual) pred
    ref std.send_msg

mock_pred_ok:               ; (ctrl . _) <- bool
    msg 0                   ; truthy
    if ok fail              ; --

; A mock-object that verifies a list of mocks.

mock_list_setup:            ; (ctrl . _) <- mocks
    msg 0                   ; mocks
    state 1                 ; mocks ctrl
    pair 1                  ; (ctrl . mocks)
    push mock_list          ; (ctrl . mocks) mock_list
    actor become            ; --
    ref std.commit

mock_list:                  ; (ctrl . mocks) <- ctrl'
    state 1                 ; ctrl
    msg 0                   ; ctrl ctrl'
    cmp eq                  ; ctrl==ctrl'
    if_not mock_false       ; --  // verify returns `#f` verdict

    state -1                ; mocks
    part 1                  ; mocks' mock
    dup 1                   ; mocks' mock mock
    typeq #actor_t          ; mocks' mock is_actor(mocks)
    if_not mock_true        ; mocks' mock  // return `#t` verdict at end

    actor self              ; mocks' mock SELF
    roll 2                  ; mocks' SELF mock
    actor send              ; mocks'

    state 1                 ; mocks' ctrl
    pair 1                  ; (ctrl . mocks')
    push mock_list_ok       ; (ctrl . mocks') mock_list_ok
    actor become            ; --
    ref std.commit

mock_list_ok:               ; (ctrl . mocks) <- verdict
    msg 0                   ; truthy
    if_not mock_list_f      ; --

    state 0                 ; (ctrl . mocks)
    push mock_list          ; (ctrl . mocks') mock_list
    actor become            ; --

    state 1                 ; ctrl
    actor self              ; ctrl SELF
    actor send              ; --
    ref std.commit

mock_list_f:                ; --
    push #f                 ; #f  // return `#f` on first failure
    state 1                 ; #f ctrl
    ref std.send_msg

; A verify customer that asserts success.

assert_ok:                  ; _ <- verdict
    debug                   ; pause if running in debugger
    msg 0                   ; verdict
    assert #t               ; assert(verdict==#t)
    ref std.commit

;
; Test suite
;

; setup the mock

step_0:                     ; (debug . timer) <- _
    push 42                 ; expect=42
    actor self              ; expect ctrl=SELF
    pair 1                  ; (ctrl . expect)
    push mock_eq            ; (ctrl . expect) mock_eq
    actor create            ; mock=mock_eq.(ctrl . expect)
    actor self              ; mock SELF
    actor send              ; --

    state 0                 ; state
    push step_1             ; state beh=step_1
    actor become            ; --
    ref std.commit

; first mock interaction

step_1:                     ; (debug . timer) <- mock
    msg 0                   ; mock
    actor self              ; mock SELF
    actor send              ; --

;    push 86             ; 86  // non-matching message
    push 42                 ; 42  // matching message
    msg 0                   ; 42 mock
    actor send              ; --

    state 0                 ; state
;    push step_2         ; state beh=step_2  // step 2 causes failure...
    push step_3             ; state beh=step_3
    actor become            ; --
    ref std.commit

; second mock interaction

step_2:                     ; (debug . timer) <- mock
    msg 0                   ; mock
    actor self              ; mock SELF
    actor send              ; --

;    push 86             ; 86  // non-matching message
    push 42                 ; 42  // matching message
    msg 0                   ; 42 mock
    actor send              ; --

    state 0                 ; state
    push step_3             ; state beh=step_3
    actor become            ; --
    ref std.commit

; verify the mock

step_3:                     ; (debug . timer) <- mock
    actor self              ; ctrl=SELF
    msg 0                   ; ctrl mock
    actor send              ; --

    push #?                 ; #?
    push assert_ok          ; #? assert_ok
    actor become            ; --
    ref std.commit

; run test suite on boot

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.timer_key      ; {caps} timer_key
    dict get                ; timer
    msg 0                   ; timer {caps}
    push dev.debug_key      ; timer {caps} debug_key
    dict get                ; timer debug
    pair 1                  ; (debug . timer)
    push step_0             ; (debug . timer) step_0
    actor create            ; test=step_0.(debug . timer)
    push #?                 ; test #?
    roll 2                  ; #? test
    actor send              ; --
    ref std.commit

.export
    failed
    success
    mock_eq
    assert_ok
    boot
