;
; subroutines implementing an unbounded version of `deque`
;

.import
    std: "./std.asm"
    list: "./list.asm"

new:                        ; ( -- deque )
    deque new               ; k deque
    ref std.return_value

empty:                      ; ( deque -- bool )
    roll -2                 ; k deque
    part 1                  ; k tail head
    typeq #pair_t           ; k tail is_pair(head)
    if not_empty            ; k tail
    dup 1                   ; k tail tail
    typeq #pair_t           ; k tail is_pair(tail)
    if not_empty            ; k tail
    drop 1                  ; k
    ref std.return_true
not_empty:                  ; k tail
    drop 1                  ; k
    ref std.return_false

push:                       ; ( deque value -- deque' )
    roll 3                  ; value k deque
    part 1                  ; value k back front
    roll 4                  ; k back front value
    pair 1                  ; k back front'=value,front
    pair 1                  ; k deque'=front',back
    ref std.return_value

pop:                        ; ( deque -- deque' value )
    roll -2                 ; k deque
    part 1                  ; k back front
    dup 1                   ; k back front front
    typeq #pair_t           ; k back front is_pair(front)
    if pop_front            ; k back front
    call list.rev_onto      ; k front'
    push #nil               ; k front' back'=#nil
    roll -2                 ; k back' front'
    dup 1                   ; k back' front' front'
    typeq #pair_t           ; k back' front' is_pair(front')
    if pop_front            ; k back' front'
    pair 1                  ; k deque'=front',back'
    push #?                 ; k deque' value=#?
    roll 3                  ; deque' value k
    return
pop_front:                  ; k back front
    part 1                  ; k back rest value=first
    roll -4                 ; value k back front'=rest
    pair 1                  ; value k deque'=front',back
    roll -3                 ; deque' value k
    return

put:                        ; ( deque value -- deque' )
    roll 3                  ; value k deque
    part 1                  ; value k back front
    roll 2                  ; value k front back
    roll 4                  ; k front back value
    pair 1                  ; k front back'=value,back
    roll 2                  ; k back' front
    pair 1                  ; k deque'=front,back'
    ref std.return_value

pull:                       ; ( deque -- deque' value )
    roll -2                 ; k deque
    part 1                  ; k back front
    roll 2                  ; k front back
    dup 1                   ; k front back back
    typeq #pair_t           ; k front back is_pair(back)
    if pull_back            ; k front back
    call list.rev_onto      ; k back'
    push #nil               ; k back' front'=#nil
    roll -2                 ; k front' back'
    dup 1                   ; k front' back' back'
    typeq #pair_t           ; k front' back' is_pair(back')
    if pull_back            ; k front' back'
    roll 2                  ; k back' front'
    pair 1                  ; k deque'=front',back'
    push #?                 ; k deque' value=#?
    roll 3                  ; deque' value k
    return
pull_back:                  ; k front back
    part 1                  ; k front rest value=first
    roll -4                 ; value k front back'=rest
    roll 2                  ; value k back' front
    pair 1                  ; value k deque'=front,back'
    roll -3                 ; deque' value k
    return

len:                        ; ( deque -- n )
    roll -2                 ; k deque
    part 1                  ; k back front
    call list.len           ; k back len(front)
    roll 2                  ; k len(front) back
    call list.len           ; k len(front) len(back)
    alu add                 ; k len=len(front)+len(back)
    ref std.return_value

; self-checked demo
demo:
    push #?                 ; #?
    call empty              ; #t
    assert #t               ; --
    call new                ; []
    dup 1                   ; [] []
    call empty              ; [] #t
    assert #t               ; []
demo_1:
    push 1                  ; [] 1
    call push               ; [1]
    push 2                  ; [1] 2
    call push               ; [2 1]
    push 3                  ; [2 1] 3
    call push               ; [3 2 1]
    pick 1                  ; [3 2 1] [3 2 1]
    call empty              ; [3 2 1] #f
    assert #f               ; [3 2 1]
demo_2:
    dup 1                   ; [3 2 1] [3 2 1]
    call len                ; [3 2 1] 3
    assert 3                ; [3 2 1]
demo_3:
    call pull               ; [3 2] 1
    assert 1                ; [3 2]
    call pull               ; [3] 2
    assert 2                ; [3]
    call pull               ; [] 3
    assert 3                ; []
    call pull               ; [] #?
    assert #?               ; []
demo_4:
    dup 1                   ; [] []
    call len                ; [] 0
    assert 0                ; []
demo_5:
    dup 1                   ; [] []
    msg 0                   ; [] [] {caps}
    call put                ; [] [{caps}]
    push 42                 ; [] [{caps}] 42
    call put                ; [] [{caps} 42]
    push #nil               ; [] [{caps} 42] #nil
    call put                ; [] [{caps} 42 #nil]
    call pop                ; [] [42 #nil] {caps}
    roll -2                 ; [] {caps} [42 #nil]
    call pop                ; [] {caps} [#nil] 42
    assert 42               ; [] {caps} [#nil]
    call pop                ; [] {caps} [] #nil
    assert #nil             ; [] {caps} []
    call empty              ; [] {caps} #t
    assert #t               ; [] {caps}
    msg 0                   ; [] {caps} {caps}
    cmp eq                  ; [] #t
    assert #t               ; []
demo_6:
    dup 1                   ; [] []
    push 1                  ; [] [] 1
    call put                ; [] [1]
    push 2                  ; [] [1] 2
    call put                ; [] [1 2]
    dup 1                   ; [] [1 2] [1 2]
    call empty              ; [] [1 2] #f
    assert #f               ; [] [1 2]
demo_7:
    call pop                ; [] [2] 1
    assert 1                ; [] [2]
    push 3                  ; [] [2] 3
    call put                ; [] [2 3]
    dup 1                   ; [] [2 3] [2 3]
    call len                ; [] [2 3] 2
    assert 2                ; [] [2 3]
demo_8:
    call pop                ; [] [3] 2
    assert 2                ; [] [3]
    call pop                ; [] [] 3
    assert 3                ; [] []
    call pop                ; [] [] #?
    assert #?               ; [] []
    call len                ; [] 0
    assert 0                ; []
    call empty              ; #t
    assert #t               ; --
    return

boot:                       ; _ <- {caps}
    call demo
    ref std.commit

test:                       ; judge <- {caps}
    call demo               ; --
    push #t                 ; if demo returns, report success!
    state 0                 ; #t judge
    ref std.send_msg

.export
    empty
    push
    pop
    put
    pull
    len
    boot
    test
