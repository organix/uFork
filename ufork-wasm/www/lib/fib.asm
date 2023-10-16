; A fibonnacci service behavior.

; It expects a message containing a customer and a fixnum. The nth
; fibonnacci number is calculated and sent to the customer.

.import
    std: "./std.asm"
    dev: "./dev.asm"
    is_eq: "./testing/is_eq.asm"

;;  (define fib
;;      (lambda (n)
;;          (if (< n 2)
;;              n
;;              (+ (fib (- n 1)) (fib (- n 2))))))

beh:
fib_beh:                ; () <- (cust n)
    msg 2               ; n
    dup 1               ; n n
    push 2              ; n n 2
    cmp lt              ; n n<2
    if std.cust_send    ; n

    msg 1               ; n cust
    push k              ; n cust k
    new -1              ; n k=k.cust

    pick 2              ; n k n
    push 1              ; n k n 1
    alu sub             ; n k n-1
    pick 2              ; n k n-1 k
    push fib_beh        ; n k n-1 k fib_beh
    new 0               ; n k n-1 k fib.()
    send 2              ; n k

    roll 2              ; k n
    push 2              ; k n 2
    alu sub             ; k n-2
    roll 2              ; n-2 k
    push fib_beh        ; n-2 k fib_beh
    new 0               ; n-2 k fib.()
    send 2              ;
    ref std.commit

k:                      ; cust <- m
    msg 0               ; m
    state 0             ; m cust
    push k2             ; cust m k2
    beh 2               ; k2.(cust m)
    ref std.commit

k2:                     ; (cust m) <- n
    state 2             ; m
    msg 0               ; m n
    alu add             ; m+n
    state 1             ; m+n cust
    ref std.send_msg

; Test suite

boot:                   ; () <- {caps}
    push 9              ; n
    msg 0               ; n {caps}
    push dev.debug_key  ; n {caps} debug_key
    dict get            ; n cust=debug
    push fib_beh        ; n cust fib_beh
    new 0               ; n cust fib
    send 2
    ref std.commit

test:                   ; (verdict) <- {caps}
    push 6              ; n=6
    push #t             ; n yes=#t
    push 8              ; n yes expected=8
    state 1             ; n yes expected verdict
    push is_eq.beh      ; n yes expected verdict is_eq_beh
    new 3               ; n cust=is_eq_beh.(verdict expected yes)
    push fib_beh        ; n cust fib_beh
    new 0               ; n cust fib=fib_beh.()
    send 2              ; --
    ref std.commit

.export
    beh
    boot
    test
