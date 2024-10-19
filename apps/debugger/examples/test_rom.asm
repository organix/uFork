; Self-testing ROM image

boot:                       ; _ <- caps
    push 42                 ; 42
    msg 0                   ; 42 caps
    my self                 ; 42 caps self
    push reboot             ; 42 state=(self caps) beh=reboot
    beh 2                   ; 42 --
    assert 42               ; --
    ref test_pairs

reboot:                     ; (self) <- _
    dup 0                   ; --
    part 0                  ; --
    ref commit

test_pairs:
    pair 0                  ; ()
    assert #nil             ; --
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
    part -1                 ; --
    assert #?               ; --
    push #nil               ; ()
    part -1                 ; --
    assert #?               ; --
    push #nil               ; ()
    push 1                  ; () 1
    pair 1                  ; (1)
    part -1                 ; 1
    assert 1                ; --
    assert #?               ; --
    ref test_if

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
    ref test_nth

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
    ref test_pick_and_roll

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
    ref test_actors

test_actors:
    push #?                 ; #?
    push cell_beh           ; #? cell_beh
    new -1                  ; rcvr=cell_beh.#?
    push once_beh           ; rcvr once_beh
    new -1                  ; actor=once_beh.rcvr
    push #t                 ; actor #t
    pick 2                  ; actor #t actor
    send -1                 ; actor
    push #f                 ; actor #f
    pick 2                  ; actor #f actor
    send -1                 ; actor
    drop 1                  ; --
    ref test_fib

test_fib:
    push 6                  ; n=6
    push 8                  ; n fib(n)=8
    push assert_beh         ; n fib(n) assert_beh
    new 1                   ; n cust=assert_beh.8
    push fib_beh            ; n cust fib_beh
    new 0                   ; n cust fib
    send 2                  ; --
    ref commit

; static data
list-0:                     ; (273 546 819)
    pair_t 16#111           ; 273
list-1:                     ; (546 819)
    pair_t 16#222           ; 546
list-2:                     ; (819)
    pair_t 16#333           ; 819
list-3:                     ; ()
    ref #nil

; test assertion
assert_beh:                 ; (expect) <- actual
    debug
    state 1                 ; expect
    msg 0                   ; expect actual
    cmp eq                  ; expect==actual
    assert #t
    ref commit

; dumb data cell
cell_beh:                   ; value <- value'
    msg 0                   ; value'
    push cell_beh           ; value' cell_beh
    beh -1                  ; --
    ref commit

; example from `fib.asm`
;;  (define fib
;;      (lambda (n)
;;          (if (< n 2)
;;              n
;;              (+ (fib (- n 1)) (fib (- n 2))))))
fib_beh:                    ; () <- (cust n)
    msg 2                   ; n
    dup 1                   ; n n
    push 2                  ; n n 2
    cmp lt                  ; n n<2
    if cust_send            ; n

    msg 1                   ; n cust
    push fib_k              ; n cust fib_k
    new -1                  ; n k=fib_k.cust

    pick 2                  ; n k n
    push 1                  ; n k n 1
    alu sub                 ; n k n-1
    pick 2                  ; n k n-1 k
    push fib_beh            ; n k n-1 k fib_beh
    new 0                   ; n k n-1 k fib.()
    send 2                  ; n k

    roll 2                  ; k n
    push 2                  ; k n 2
    alu sub                 ; k n-2
    roll 2                  ; n-2 k
    push fib_beh            ; n-2 k fib_beh
    new 0                   ; n-2 k fib.()
    send 2                  ;
    ref commit

fib_k:                      ; cust <- m
    msg 0                   ; m
    state 0                 ; m cust
    push fib_k2             ; cust m fib_k2
    beh 2                   ; fib_k2.(cust m)
    ref commit

fib_k2:                     ; (cust m) <- n
    state 2                 ; m
    msg 0                   ; m n
    alu add                 ; m+n
    state 1                 ; m+n cust
    ref send_msg

; adaptated from `lib.asm`
once_beh:                   ; rcvr <- msg
    push -3                 ; -3
    push -2                 ; -3 -2
    push -1                 ; -3 -2 -1
    push sink_beh           ; ... beh=sink_beh
    ; beh -1                  ; --
    beh 0                   ; --
    msg 0                   ; msg
    state 0                 ; msg rcvr
    ref send_msg

; shared tails from `std.asm`
cust_send:                  ; msg
    msg 1                   ; msg cust
send_msg:                   ; msg cust
    send -1                 ; --
sink_beh:                   ; _ <- _
commit:
    end commit
stop:
    end stop

.export
    boot
