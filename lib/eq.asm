; An assembly procedure that compares two values for deep equality.
; Does not currently support dictionaries or deques.

.import
    dev: "./dev.asm"
    std: "./std.asm"

proc:
eq:                         ; ( b a -- boolean )
    roll -3                 ; k b a
eq_tail:                    ; k b a
    dup 2                   ; k b a b a
    cmp eq                  ; k b a b==a
    if eq_t                 ; k b a
    dup 1                   ; k b a a
    typeq #pair_t           ; k b a is_pair(a)
    if_not eq_f             ; k b a
    roll 2                  ; k a b
    dup 1                   ; k a b b
    typeq #pair_t           ; k a b is_pair(b)
    if_not eq_f             ; k a b
    part 1                  ; k a tl(b) hd(b)
    roll 3                  ; k tl(b) hd(b) a
    part 1                  ; k tl(b) hd(b) tl(a) hd(a)
    roll 3                  ; k tl(b) tl(a) hd(a) hd(b)
    call eq                 ; k tl(b) tl(a) hd(b)==hd(a)
    if eq_tail              ; k tl(b) tl(a)
eq_f:                       ; k b a
    drop 2                  ; k
    ref std.return_f
eq_t:                       ; k b a
    drop 2                  ; k
    ref std.return_t

; Test suite

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; judge=debug
    ref suite

list:                       ; (1 2 3)
    pair_t 1
    pair_t 2
    pair_t 3
    pair_t #nil

test:                       ; judge <- {caps}
    state 0                 ; judge
suite:

; Equal primitives.

    push 42                 ; judge 42
    push 42                 ; judge 42 42
    call eq                 ; judge #t
    assert #t               ; judge

; Non-equal primitives.

    push 42                 ; judge 42
    push 1729               ; judge 42 1729
    call eq                 ; judge #f
    assert #f               ; judge

; Primitive versus pair.

    push 42                 ; judge 42
    push list               ; judge 42 (1 2 3)
    call eq                 ; judge #f
    assert #f               ; judge

; Equal pair structure.

    push #nil               ; judge ()
    push 2                  ; judge () 2
    push 1                  ; judge () 2 1
    pair 1                  ; judge () (1 . 2)
    pair 1                  ; judge ((1 . 2))
    push #nil               ; judge ((1 . 2)) ()
    push 2                  ; judge ((1 . 2)) () 2
    push 1                  ; judge ((1 . 2)) () 2 1
    pair 1                  ; judge ((1 . 2)) () (1 . 2)
    pair 1                  ; judge ((1 . 2)) ((1 . 2))
    call eq                 ; judge #t
    assert #t               ; judge

; Non-equal pair structure.

    push #nil               ; judge ()
    push 2                  ; judge () 2
    push 1                  ; judge () 2 1
    pair 1                  ; judge () (1 . 2)
    pair 1                  ; judge ((1 . 2))
    push #nil               ; judge ((1 . 2)) ()
    push 42                 ; judge ((1 . 2)) () 42
    push 1                  ; judge ((1 . 2)) () 42 1
    pair 1                  ; judge ((1 . 2)) () (1 . 42)
    pair 1                  ; judge ((1 . 2)) ((1 . 42))
    call eq                 ; judge #f
    assert #f               ; judge

; Report back.

    push #t                 ; judge #t
    roll 2                  ; #t judge
    ref std.send_msg

.export
    boot
    proc
    test
