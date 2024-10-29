; A behavior asserting that every message it receives is deeply equal to its
; state.

.import
    std: "../std.asm"
    eq: "../eq.asm"

beh:
assert_eq_beh:              ; expect <- actual
    msg 0                   ; actual
    state 0                 ; actual expect
    call eq.proc            ; actual==expect
    assert #t               ; --
    ref std.commit

boot:                       ; _ <- {caps}
    push 1111               ; actual=1111
    push 2222               ; actual expect=2222
    push assert_eq_beh      ; actual expect assert_eq_beh
    actor create            ; actual assert_eq
    actor send              ; --
    ref std.commit

.export
    beh
    boot
