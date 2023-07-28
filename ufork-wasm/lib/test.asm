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

fail:
    state 1             ; ctrl
    push failed         ; ctrl failed
    beh 1               ; --
    ref std.commit

; A mock-object representing a successful test.
; Non-verify messages cause failue.

success:                ; (ctrl) <- (ctrl')
    state 1             ; ctrl
    msg 1               ; ctrl ctrl'
    cmp eq              ; ctrl==ctrl'
    if std.rv_true      ; --  // verify returns `#t` verdict
    ref fail

; Become `success`

ok:
    state 1             ; ctrl
    push success        ; ctrl success
    beh 1               ; --
    ref std.commit

; A mock-object that expects a matching messages.

mock_eq:                ; (ctrl expect) <- (ctrl') | actual
    state 1             ; ctrl
    msg 1               ; ctrl ctrl'
    cmp eq              ; ctrl==ctrl'
    if std.rv_false     ; --  // verify returns `#f` verdict

    state 2             ; expect
    msg 0               ; expect actual
    cmp eq              ; expect==actual
    if ok fail          ; --

; A verify customer that asserts success.

assert_ok:              ; _ <- verdict
    msg 0               ; verdict
    debug               ; pause if running in debugger
    is_eq #t            ; assert(verdict==#t)
    ref std.commit

; Test suite

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push dev.timer_key  ; {caps} timer_key
    dict get            ; timer
    msg 0               ; timer {caps}
    push dev.debug_key  ; timer {caps} debug_key
    dict get            ; timer debug

    my self             ; ... ctrl=SELF
    push success        ; ... ctrl success
    new 1               ; ... mock=success.(ctrl)

    my self             ; ... mock ctrl=SELF
    roll 2              ; ... ctrl mock
    send 1              ; ...

    push assert_ok      ; assert_ok
    beh 0               ; --
    ref std.commit

.export
    failed
    success
    mock_eq
    assert_ok
    boot
