; A fibonnacci service behavior.

; It expects a message containing a customer and a fixnum. The nth
; fibonnacci number is calculated and sent to the customer.

.import
    std: "https://ufork.org/lib/std.asm"
    dev: "https://ufork.org/lib/dev.asm"
    is_eq: "https://ufork.org/lib/testing/is_eq.asm"

;;  DEF fib_beh(m) AS \(cust, n).[
;;      CASE greater(n, m) OF
;;      TRUE : [
;;          SEND (k_fib, sub(n, 1)) TO SELF
;;          SEND (k_fib, sub(n, 2)) TO SELF
;;          CREATE k_fib WITH \a.[
;;              BECOME \b.[
;;                  SEND add(a, b) TO cust
;;              ]
;;          ]
;;      ]
;;      _ : [ SEND n TO cust ]
;;      END
;;  ]
beh:
fib_beh:                    ; _ <- (cust . n)
    msg -1                  ; n
    dup 1                   ; n n
    push 2                  ; n n 2
    cmp lt                  ; n n<2
    if std.cust_send        ; n

    msg 1                   ; n cust
    push k                  ; n cust k
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
    ref std.send_msg

k:                          ; cust <- m
    msg 0                   ; m
    state 0                 ; m cust
    pair 1                  ; (cust . m)
    push k2                 ; (cust . m) k2
    actor become            ; k2.(cust . m)
    ref std.commit

k2:                         ; (cust . m) <- n
    state -1                ; m
    msg 0                   ; m n
    alu add                 ; m+n
    state 1                 ; m+n cust
    ref std.send_msg

; Test suite

boot:                       ; _ <- {caps}
    push 9                  ; n
    msg 0                   ; n {caps}
    push dev.debug_key      ; n {caps} debug_key
    dict get                ; n cust=debug
    ref suite

test:                       ; judge <- {caps}
    push 6                  ; n=6
    push #f                 ; n no=#f
    push #t                 ; n no yes=#t
    push 8                  ; n no yes expected=8
    state 0                 ; n no yes expected judge
    pair 3                  ; n (judge expected yes . no)
    push is_eq.beh          ; n (judge expected yes . no) is_eq_beh
    actor create            ; n cust=is_eq_beh.(judge expected yes . no)
suite:
    pair 1                  ; (cust . n)
    push #?                 ; (cust . n) #?
    push fib_beh            ; (cust . n) #? fib_beh
    actor create            ; (cust . n) fib
    ref std.send_msg

.export
    beh
    boot
    test
