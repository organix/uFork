; Fibonacci service behavior.

; It expects a message containing a customer and a fixnum.
; The nth Fibonacci number is calculated and sent to the customer.

.import
    std: "https://ufork.org/lib/std.asm"
    dev: "https://ufork.org/lib/dev.asm"

;;  DEF fib_beh AS \(cust, n).[
;;      CASE greater(n, 1) OF
;;      TRUE : [
;;  #        SEND (k_fib, sub(n, 1)) TO NEW fib_beh
;;          SEND (k_fib, sub(n, 1)) TO SELF
;;  #        SEND (k_fib, sub(n, 2)) TO NEW fib_beh
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
fib_beh:                    ; _ <- cust,n
    msg -1                  ; n
    dup 1                   ; n n
    push 1                  ; n n 1
    cmp gt                  ; n n>1
    if_not std.cust_send    ; n

    msg 1                   ; n cust
    push k                  ; n cust k
    actor create            ; n k=k.cust

    pick 2                  ; n k n
    push 1                  ; n k n 1
    alu sub                 ; n k n-1
    pick 2                  ; n k n-1 k
    pair 1                  ; n k k,n-1

;    push #?                 ; n k k,n-1 #?
;    push fib_beh            ; n k k,n-1 #? fib_beh
;    actor create            ; n k k,n-1 fib.#?
    actor self              ; n k k,n-1 SELF
    actor send              ; n k

    roll 2                  ; k n
    push 2                  ; k n 2
    alu sub                 ; k n-2
    roll 2                  ; n-2 k
    pair 1                  ; k,n-2

;    push #?                 ; k,n-2 #?
;    push fib_beh            ; k,n-2 #? fib_beh
;    actor create            ; k,n-2 fib.#?
    actor self              ; k,n-2 SELF
    ref std.send_msg

k:                          ; cust <- m
    msg 0                   ; m
    state 0                 ; m cust
    pair 1                  ; cust,m
    push k2                 ; cust,m k2
    actor become            ; k2.cust,m
    ref std.commit

k2:                         ; cust,m <- n
    state -1                ; m
    msg 0                   ; m n
    alu add                 ; m+n
    state 1                 ; m+n cust
    ref std.send_msg

; Timing test

t_start:                    ; svc,clock,debug <- cust,req
    state -1                ; clock,debug
    part 1                  ; debug clock
    actor send              ; --
    actor self              ; SELF
    state 2                 ; SELF clock
    actor send              ; --
    state 0                 ; svc,clock,debug
    msg 0                   ; svc,clock,debug cust,req
    part 1                  ; svc,clock,debug req cust
    drop 1                  ; svc,clock,debug req
    actor self              ; svc,clock,debug req cust'=SELF
    pair 1                  ; svc,clock,debug cust',req
    pair 1                  ; (cust',req),svc,clock,debug
    push t_run              ; (cust',req),svc,clock,debug t_run
    actor become            ; --
    ref std.commit

t_run:                      ; (cust,req),svc,clock,debug <- t0
    state 1                 ; cust,req
    state 2                 ; cust,req svc
    actor send              ; --
    state -2                ; clock,debug
    msg 0                   ; clock,debug t0
    pair 1                  ; t0,clock,debug
    push t_stop             ; t0,clock,debug t_stop
    actor become            ; --
    ref std.commit

t_stop:                     ; t0,clock,debug <- res
    actor self              ; SELF
    state 2                 ; SELF clock
    actor send              ; --
    state 0                 ; t0,clock,debug
    push t_end              ; t0,clock,debug t_end
    actor become            ; --
    ref std.commit

t_end:                      ; t0,clock,debug <- t1
    msg 0                   ; t1
    state 1                 ; t1 t0
    alu sub                 ; t1-t0
    state -2                ; t1-t0 debug
    actor send              ; --
    msg 0                   ; t1
    state -2                ; t1 debug
    actor send              ; --    
    ref std.commit

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; debug
    msg 0                   ; debug {caps}
    push dev.clock_key      ; debug {caps} clock_key
    dict get                ; debug clock
    push #?                 ; debug clock #?
    push fib_beh            ; debug clock #? fib_beh
    actor create            ; debug clock svc=fib_beh.#?
    push 12                 ; debug clock svc n=12
    pick 3                  ; debug clock svc n cust=debug
    pair 1                  ; debug clock svc cust,n
    roll -4                 ; cust,n debug clock svc
    pair 2                  ; cust,n svc,clock,debug
    push t_start            ; cust,n svc,clock,debug t_start
    actor create            ; cust,n t_start.svc,clock,debug
    ref std.send_msg

.export
    beh
    boot
