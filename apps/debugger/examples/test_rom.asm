; Self-testing ROM image

boot:                       ; _ <- {caps}
test_pairs:
    push 422                ; 422
    pair 0                  ; 422
    assert 422              ; --
    push 3                  ; 3
    push 2                  ; 3 2
    pair 1                  ; (2 . 3)
    push 1                  ; (2 . 3) 1
    pair 1                  ; (1 2 . 3)
    part 1                  ; (2 . 3) 1
    assert 1                ; (2 . 3)
    dup 0                   ; (2 . 3)
    part 1                  ; 3 2
    assert 2                ; 3
    dup 1                   ; 3 3
    part 1                  ; 3 #? #?
    drop 1                  ; 3 #?
    assert #?               ; 3
    drop 0                  ; 3
    assert 3                ; --
test_if:
    part 1                  ; #? #?
    drop 1                  ; #?
    if stop                 ; --
    push 0                  ; 0
    eq 0                    ; #t
    if_not stop             ; --
    push -1                 ; -1
    eq 0                    ; #f
    if stop                 ; --
    push #nil               ; ()
    if stop                 ; --
    push 0                  ; 0
    if stop                 ; --
test_nth:
    push list-0             ; (273 546 819)
    part 1                  ; (546 819) 273
    assert 273              ; (546 819)
    part 1                  ; (819) 546
    assert 546              ; (819)
    part 1                  ; () 819
    assert 819              ; ()
    assert #nil             ; --
    push list-0             ; (273 546 819)
    nth 0                   ; (273 546 819)
    assert list-0           ; --
    push list-0             ; (273 546 819)
    nth 1                   ; 273
    assert 273              ; --
    push list-0             ; (273 546 819)
    nth -1                  ; (546 819)
    assert list-1           ; --
    push list-0             ; (273 546 819)
    nth 2                   ; 546
    assert 546              ; --
    push list-0             ; (273 546 819)
    nth -2                  ; (819)
    assert list-2           ; --
    push list-0             ; (273 546 819)
    nth 3                   ; 819
    assert 819              ; --
    push list-0             ; (273 546 819)
    nth -3                  ; ()
    assert list-3           ; --
;    assert #nil             ; --
    push list-0             ; (273 546 819)
    nth 4                   ; #?
    assert #?               ; --
    push list-0             ; (273 546 819)
    nth -4                  ; #?
    assert #?               ; --
test_pick_and_roll:
    push 3                  ; 3
    push 2                  ; 3 2
    push 1                  ; 3 2 1
    pick 0                  ; 3 2 1 #?
    assert #?               ; 3 2 1
    pick 1                  ; 3 2 1 1
    assert 1                ; 3 2 1
    pick -1                 ; 3 2 1 1
    assert 1                ; 3 2 1
    pick 2                  ; 3 2 1 2
    assert 2                ; 3 2 1
    pick -2                 ; 3 1 2 1
    assert 1                ; 3 1 2
    roll 0                  ; 3 1 2
    dup 1                   ; 3 1 2 2
    assert 2                ; 3 1 2
    roll 1                  ; 3 1 2
    dup 1                   ; 3 1 2 2
    assert 2                ; 3 1 2
    roll -1                 ; 3 1 2
    dup 1                   ; 3 1 2 2
    assert 2                ; 3 1 2
    roll 2                  ; 3 2 1
    dup 1                   ; 3 2 1 1
    assert 1                ; 3 2 1
    roll -3                 ; 1 3 2
    assert 2                ; 1 3
    pick 3                  ; 1 3 #?
    assert #?               ; 1 3
    roll 3                  ; 1 3 #?
    assert #?               ; 1 3
    assert 3                ; 1
    pick 3                  ; 1 #?
    assert #?               ; 1
    roll -2                 ; --
    assert #?               ; #?
test_actors:
    push #?                 ; #?
    push cell_beh           ; #? cell_beh
    actor create            ; rcvr=cell_beh.#?
    dup 1                   ; rcvr rcvr
    typeq #actor_t          ; rcvr is_actor(rcvr)
    assert #t               ; rcvr
    push once_beh           ; rcvr once_beh
    actor create            ; actor=once_beh.rcvr
    push #t                 ; actor #t
    pick 2                  ; actor #t actor
    actor send              ; actor
    push #f                 ; actor #f
    pick 2                  ; actor #f actor
    actor send              ; actor
    drop 1                  ; --
test_fib:
    push 6                  ; n=6
    push 8                  ; n fib(n)=8
    push assert_eq_beh      ; n fib(n) assert_eq_beh
    actor create            ; n cust=assert_eq_beh.8
    pair 1                  ; (cust . n)
    push #?                 ; (cust . n) #?
    push fib_beh            ; (cust . n) #? fib_beh
    actor create            ; (cust . n) fib
    ref send_msg

; static data
list-0:                     ; (273 546 819)
    pair_t 16#111           ; 273
list-1:                     ; (546 819)
    pair_t 16#222           ; 546
list-2:                     ; (819)
    pair_t 16#333           ; 819
list-3:                     ; ()
    ref #nil

; taken from `assert_eq.asm`
assert_eq_beh:              ; expect <- actual
    msg 0                   ; actual
    state 0                 ; actual expect
    cmp eq                  ; actual==expect
    assert #t               ; --
    ref commit

; dumb data cell
cell_beh:                   ; value <- value'
    msg 0                   ; value'
    push cell_beh           ; value' cell_beh
    actor become            ; --
    ref commit

; example from `fib.asm`
fib_beh:                    ; _ <- (cust . n)
    msg -1                  ; n
    dup 1                   ; n n
    push 2                  ; n n 2
    cmp lt                  ; n n<2
    if cust_send            ; n

    msg 1                   ; n cust
    push fib_k              ; n cust k
    actor create            ; n k=k.cust

    pick 2                  ; n k n
    push 1                  ; n k n 1
    alu sub                 ; n k n-1
    pick 2                  ; n k n-1 k
    pair 1                  ; n k (k . n-1)
    push #?                 ; n k (k . n-1) #?
    push fib_beh            ; n k (k . n-1) #? fib_beh
    actor create            ; n k (k . n-1) fib.#?
    actor send              ; n k

    roll 2                  ; k n
    push 2                  ; k n 2
    alu sub                 ; k n-2
    roll 2                  ; n-2 k
    pair 1                  ; (k . n-2)
    push #?                 ; (k . n-2) #?
    push fib_beh            ; (k . n-2) #? fib_beh
    actor create            ; (k . n-2) fib.#?
    ref send_msg

fib_k:                      ; cust <- m
    msg 0                   ; m
    state 0                 ; m cust
    pair 1                  ; (cust . m)
    push fib_k2             ; (cust . m) k2
    actor become            ; k2.(cust . m)
    ref commit

fib_k2:                     ; (cust . m) <- n
    state -1                ; m
    msg 0                   ; m n
    alu add                 ; m+n
    state 1                 ; m+n cust
    ref send_msg

; adaptated from `lib.asm`
once_beh:                   ; rcvr <- msg
    push #?                 ; #?
    push sink_beh           ; #? sink_beh
    actor become            ; --
    msg 0                   ; msg
    state 0                 ; msg rcvr
    ref send_msg

; shared tails from `std.asm`
cust_send:                  ; msg
    msg 1                   ; msg cust
send_msg:                   ; msg cust
    actor send              ; --
sink_beh:                   ; _ <- _
commit:
    end commit
stop:
    end stop

.export
    boot
