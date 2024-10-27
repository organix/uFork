;
; subroutines implementing an unbounded version of `deque`
;

.import
    std: "./std.asm"
;    std: "https://ufork.org/lib/std.asm"

new:                        ; ( k -- deque )
    deque new               ; k deque
    ref std.return_value

empty:                      ; ( deque k -- bool )
    roll -2                 ; k deque
    part 1                  ; k tail head
    typeq #pair_t           ; k tail is_pair(head)
    if not_empty            ; k tail
    dup 1                   ; k tail tail
    typeq #pair_t           ; k tail is_pair(tail)
    if not_empty            ; k tail
    drop 1                  ; k
    ref std.return_t
not_empty:                  ; k tail
    drop 1                  ; k
    ref std.return_f

push:                       ; ( deque value k -- deque' )
pop:                        ; ( deque k -- deque' value )
put:                        ; ( deque value k -- deque' )
pull:                       ; ( deque k -- deque' value )
len:                        ; ( deque k -- n )

; self-checked demo
demo:
    push #?                 ; #?
    call empty              ; #t
    assert #t               ; --
    call new                ; (())
    dup 1                   ; (()) (())
    call empty              ; (()) #t
    assert #t               ; (())
demo_1:
    push 1                  ; (()) 1
    deque push              ; ((1))
    push 2                  ; ((1)) 2
    deque push              ; ((2 1))
    push 3                  ; ((2 1)) 3
    deque push              ; ((3 2 1))
    pick 1                  ; ((3 2 1)) ((3 2 1))
    call empty              ; ((3 2 1)) #f
    assert #f               ; ((3 2 1))
demo_2:
    dup 1                   ; ((3 2 1)) ((3 2 1))
    deque len               ; ((3 2 1)) 3
    assert 3                ; ((3 2 1))
demo_3:
    deque pull              ; (() 2 3) 1
    assert 1                ; (() 2 3)
    deque pull              ; (() 3) 2
    assert 2                ; (() 3)
    deque pull              ; (()) 3
    assert 3                ; (())
    deque pull              ; (()) #?
    assert #?               ; (())
demo_4:
    dup 1                   ; (()) (())
    deque len               ; (()) 0
    assert 0                ; (())
demo_5:
    dup 1                   ; (()) (())
    msg 0                   ; (()) (()) {caps}
    deque put               ; (()) (() {caps})
    push 42                 ; (()) (() {caps}) 42
    deque put               ; (()) (() 42 {caps})
    push #nil               ; (()) (() 42 {caps}) ()
    deque put               ; (()) (() () 42 {caps})
    deque pop               ; (()) ((42 ())) {caps}
    roll -2                 ; (()) {caps} ((42 ()))
    deque pop               ; (()) {caps} ((())) 42
    assert 42               ; (()) {caps} ((()))
    deque pop               ; (()) {caps} (()) ()
    assert #nil             ; (()) {caps} (())
    call empty              ; (()) {caps} #t
    assert #t               ; (()) {caps}
    msg 0                   ; (()) {caps} {caps}
    cmp eq                  ; (()) #t
    assert #t               ; (())
demo_6:
    dup 1                   ; (()) (())
    push 1                  ; (()) (()) 1
    deque put               ; (()) (() 1)
    push 2                  ; (()) (() 1) 2
    deque put               ; (()) (() 2 1)
    dup 1                   ; (()) (() 2 1) (() 2 1)
    deque empty             ; (()) (() 2 1) #f
    assert #f               ; (()) (() 2 1)
demo_7:
    deque pop               ; (()) (() 2) 1
    assert 1                ; (()) ((2))
    push 3                  ; (()) ((2)) 3
    deque put               ; (()) ((2) 3)
    dup 1                   ; (()) ((2) 3) ((2) 3)
    deque len               ; (()) ((2) 3) 2
    assert 2                ; (()) ((2) 3)
demo_8:
    deque pop               ; (()) (() 3) 2
    assert 2                ; (()) (() 3)
    deque pop               ; (()) (()) 3
    assert 3                ; (()) (())
    deque pop               ; (()) (()) #?
    assert #?               ; (()) (())
    deque len               ; (()) 0
    assert 0                ; (())
    call empty              ; #t
    assert #t               ; --
    ref std.commit

; unit test suite
boot:                       ; _ <- {caps}
;    msg 0                   ; {caps}
;    end commit
    ref demo

.export
    empty
    push
    pop
    put
    pull
    len
    boot
