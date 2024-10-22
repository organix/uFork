; A behavior asserting that every message it receives is equal to its state.

.import
    std: "../std.asm"

beh:
assert_eq_beh:              ; expect <- actual
    msg 0                   ; actual
    state 0                 ; actual expect
    cmp eq                  ; actual==expect
    assert #t               ; --
    ref std.commit

boot:                       ; () <- {caps}
    push 1111               ; actual=1111
    push 2222               ; actual expect=2222
    push assert_eq_beh      ; actual expect assert_eq_beh
    new -1                  ; actual assert_eq
    send -1                 ; --
    ref std.commit

.export
    beh
    boot
