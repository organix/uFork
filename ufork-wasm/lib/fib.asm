; A fibonnacci service behavior.

; It expects a message containing a customer and a fixnum. The nth
; fibonnacci number is calculated and sent to the customer.

.import
    std: "./std.asm"

beh:                    ; (cust n)
    msg 2               ; n
    dup 1               ; n n
    push 2              ; n n 2
    cmp lt              ; n n<2
    if std.cust_send    ; n

    msg 1               ; n cust
    push k              ; n cust k
    new 1               ; n k=(k cust)

    pick 2              ; n k n
    push 1              ; n k n 1
    alu sub             ; n k n-1
    pick 2              ; n k n-1 k
    push beh            ; n k n-1 k beh
    new 0               ; n k n-1 k fib
    send 2              ; n k

    roll 2              ; k n
    push 2              ; k n 2
    alu sub             ; k n-2
    roll 2              ; n-2 k
    push beh            ; n-2 k beh
    new 0               ; n-2 k fib
    send 2              ;
    ref std.commit

k:                      ; cust
    msg 0               ; cust m
    push k2             ; cust m k2
    beh 2               ; (k2 cust m)
    ref std.commit

k2:                     ; cust m
    msg 0               ; cust m n
    alu add             ; cust m+n
    roll 2              ; m+n cust
    ref std.send_0

boot:
;    push 5              ; n=5 -- will lead to assert failure
    push 6              ; n=6
    push eq8            ; n eq8
    new 0               ; n cust
    push beh            ; n cust beh
    new 0               ; n cust fib
    send 2 std.commit

eq8:
    msg 0               ; msg
    is_eq 8             ; assert_eq[8, msg]
    ref std.commit

.export
    beh
    boot
