;;;
;;; uFork ASM Playground
;;;
;;; This module contains a variety of uFork ASM code fragments
;;; that illustrate "interesting" behavior. Run the code in the
;;; debugger and single-step to observe the behavior.
;;;

.import
    std: "./std.asm"
    dev: "./dev.asm"
    lib: "./lib.asm"
;    asm: "./asm.asm"

; An infinite loop will consume cycles, but no memory or events.

loop_forever:
    dup 0 loop_forever

; Send yourself an incrementing number forever.

ticker:                 ; () <- n
    msg 0               ; n
    push 1              ; n 1
    alu add             ; n+1
    my self             ; n+1 SELF
    ref std.send_msg    ; --

; Send yourself two messages for each one received.

msg_bomb:               ; () <- ()
    my self             ; SELF
    send 0              ; --
    my self             ; SELF
    send 0              ; --
    ref std.commit

; Create and activate two clones for each message received.

fork_bomb:              ; () <- ()
    push fork_bomb      ; fork_bomb
    new 0               ; fork_bomb.()
    send 0              ; --
    push fork_bomb      ; fork_bomb
    new 0               ; fork_bomb.()
    send 0              ; --
    ref std.commit

; Count up to a specified `limit` (forever, if `limit==#?`).

count_to:               ; (limit) <- count
    state 1             ; limit
    typeq #fixnum_t     ; typeof(limit)==#fixnum_t
    if_not count_next   ; --
    msg 0               ; count
    state 1             ; count limit
    cmp ge              ; count>=limit
    if std.commit       ; --
count_next:
    msg 0               ; count
    push 1              ; count 1
    alu add             ; count+1
    my self             ; count+1 SELF
    ref std.send_msg

; Compiled Scheme boilerplate

"symbol_t":
    type_t 1
"closure_t":
    type_t 2
"behavior_t":
    type_t 2
"~empty_env":
    pair_t #nil
    ref #nil
"~cont_beh":
    state 1
    my self
    send -1
    state 3
    state 4
    msg 0
    pair 1
    pair 1
    state 2
    beh -1
    end commit

; A traditional recursive (but not tail-recursive) example function.

;;  (define fact
;;      (lambda (n)
;;          (if (> n 1)
;;              (* n (fact (- n 1)))
;;              1)))

fact:                   ; () <- (cust n)
    msg 2               ; ... n
    push 1              ; ... n 1
    cmp gt              ; ... n>1
    if fact_1 fact_2    ; ...
fact_1:
    msg 2               ; ... n
    msg 2               ; ... n n
    push 1              ; ... n n 1
    alu sub             ; ... n n-1

;    dup 0               ; ... n m=fact(n-1)  // no-op placeholder for recursive call...
    my self             ; ... n n-1 SELF
    push fact           ; ... n n-1 SELF fact
    new 0               ; ... n n-1 SELF fact.()
    send 2              ; ... n
    pair -1             ; sp=(n ...)
    state -1            ; sp env
    push k_fact_1       ; sp env beh=k_fact_1
    msg 0               ; sp env beh msg
    push "~cont_beh"    ; sp env beh msg ~cont_beh
    beh 4               ; --
    ref std.commit
;    end commit

k_fact_1:               ; (sp' . env) <- msg
    state 1             ; sp'
    part -1             ; ... n m

    ; continuation parameter `k`
    alu mul             ; ... rv=n*m
    ref fact_3
fact_2:
    push 1              ; ... rv=1
    ref fact_3
fact_3:                 ; ... rv
    ref std.cust_send
;    msg 1               ; ... rv cust
;    send -1             ; ...
;    end commit

; Boot code runs when the module is loaded (but not when imported).

try_me:                 ; (sp . env) <- (cust . args)
    state 0             ; (sp . env)
    part -1             ; ...
    state 1             ; ... sp
    part -1             ; ... ...
    end commit

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push dev.debug_key  ; {caps} dev.debug_key
    dict get            ; debug_dev

;
;   YOUR CODE GOES HERE
;

    push 1              ; debug_dev 1
    pick 2              ; debug_dev 1 debug_dev
    send -1             ; debug_dev
    push 2              ; debug_dev 2
    pick 2              ; debug_dev 1 debug_dev
    send -1             ; debug_dev
    push 3              ; debug_dev 3
    pick 2              ; debug_dev 1 debug_dev
    send -1             ; debug_dev
    if std.commit       ; -- early exit

;    push try_me         ; ... try_me
;    new 0               ; ... try_me.()
;    send 0              ; ...

    push 5              ; debug_dev n=5
    pick 2              ; debug_dev n cust=debug_dev
    push fact           ; debug_dev n cust fact
    new 0               ; debug_dev n cust fact.()
    send 2              ; debug_dev

;    depth               ; 3 2 1 depth
;    my self             ; 3 2 1 depth SELF
;    send -1             ; 3 2 1
;    push step_1         ; (1 2 3 . #?) step_1
;    beh -1              ; --

    ; start unbounded counter
;    push count_to       ; ... count_to
;    new 0               ; ... count_to.()
;    send 0              ; ...

    ref std.commit

step_1:                 ; (1 2 3 . #?) <- depth'
    my state            ; 3 2 1
    depth               ; 3 2 1 depth
    msg 0               ; 3 2 1 depth depth'
    cmp eq              ; 3 2 1 depth==depth'
    is_eq #t            ; 3 2 1
    ref std.commit

assert:                 ; expect <- actual
    state 0             ; expect
    msg 0               ; expect actual
    cmp eq              ; expect==actual
    is_eq #t            ; assert(expect==actual)
    ref std.commit

.export
    boot
