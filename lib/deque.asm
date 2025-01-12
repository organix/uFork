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
    call new                ; (#nil)
    dup 1                   ; (#nil) (#nil)
    call empty              ; (#nil) #t
    assert #t               ; (#nil)
demo_1:
    push 1                  ; (#nil) 1
    call push               ; ((1))
    push 2                  ; ((1)) 2
    call push               ; ((2 1))
    push 3                  ; ((2 1)) 3
    call push               ; ((3 2 1))
    pick 1                  ; ((3 2 1)) ((3 2 1))
    call empty              ; ((3 2 1)) #f
    assert #f               ; ((3 2 1))
demo_2:
    dup 1                   ; ((3 2 1)) ((3 2 1))
    call len                ; ((3 2 1)) 3
    assert 3                ; ((3 2 1))
demo_3:
    call pull               ; (#nil 2 3) 1
    assert 1                ; (#nil 2 3)
    call pull               ; (#nil 3) 2
    assert 2                ; (#nil 3)
    call pull               ; (#nil) 3
    assert 3                ; (#nil)
    call pull               ; (#nil) #?
    assert #?               ; (#nil)
demo_4:
    dup 1                   ; (#nil) (#nil)
    call len                ; (#nil) 0
    assert 0                ; (#nil)
demo_5:
    dup 1                   ; (#nil) (#nil)
    msg 0                   ; (#nil) (#nil) {caps}
    call put                ; (#nil) (#nil {caps})
    push 42                 ; (#nil) (#nil {caps}) 42
    call put                ; (#nil) (#nil 42 {caps})
    push #nil               ; (#nil) (#nil 42 {caps}) #nil
    call put                ; (#nil) (#nil #nil 42 {caps})
    call pop                ; (#nil) ((42 #nil)) {caps}
    roll -2                 ; (#nil) {caps} ((42 #nil))
    call pop                ; (#nil) {caps} ((#nil)) 42
    assert 42               ; (#nil) {caps} ((#nil))
    call pop                ; (#nil) {caps} (#nil) #nil
    assert #nil             ; (#nil) {caps} (#nil)
    call empty              ; (#nil) {caps} #t
    assert #t               ; (#nil) {caps}
    msg 0                   ; (#nil) {caps} {caps}
    cmp eq                  ; (#nil) #t
    assert #t               ; (#nil)
demo_6:
    dup 1                   ; (#nil) (#nil)
    push 1                  ; (#nil) (#nil) 1
    call put                ; (#nil) (#nil 1)
    push 2                  ; (#nil) (#nil 1) 2
    call put                ; (#nil) (#nil 2 1)
    dup 1                   ; (#nil) (#nil 2 1) (#nil 2 1)
    call empty              ; (#nil) (#nil 2 1) #f
    assert #f               ; (#nil) (#nil 2 1)
demo_7:
    call pop                ; (#nil) (#nil 2) 1
    assert 1                ; (#nil) ((2))
    push 3                  ; (#nil) ((2)) 3
    call put                ; (#nil) ((2) 3)
    dup 1                   ; (#nil) ((2) 3) ((2) 3)
    call len                ; (#nil) ((2) 3) 2
    assert 2                ; (#nil) ((2) 3)
demo_8:
    call pop                ; (#nil) (#nil 3) 2
    assert 2                ; (#nil) (#nil 3)
    call pop                ; (#nil) (#nil) 3
    assert 3                ; (#nil) (#nil)
    call pop                ; (#nil) (#nil) #?
    assert #?               ; (#nil) (#nil)
    call len                ; (#nil) 0
    assert 0                ; (#nil)
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
