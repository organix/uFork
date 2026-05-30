; Iterative calculation of Fibonacci numbers.
; Also a list-iterator for calculating mutliple Fibonacci numbers.

; These examples are meant to illustrate some strategies
; for implementing functional closure activations
; and parallel process of a list.

.import
    std: "https://ufork.org/lib/std.asm"
    dev: "https://ufork.org/lib/dev.asm"
    fork: "https://ufork.org/lib/fork.asm"

;;  DEF fib_iter(f_1, f_2) AS \(cust, n).[
;;      CASE greater(n, 2) OF
;;      TRUE : [
;;          BECOME fib_iter(add(f_1, f_2), f_1)
;;          SEND (cust, sub(n, 1)) TO SELF
;;      ]
;;      _ : [
;;          SEND add(f_1, f_2) TO cust
;;      ]
;;      END
;;  ]
fib_iter:                   ; f_1,f_2 <- cust,n
    msg -1                  ; n
    push 2                  ; n 2
    cmp gt                  ; n>2
    if_not fib_iter_end     ; --

    state 1                 ; f_1
    state 1                 ; f_1 f_1
    state -1                ; f_1 f_1 f_2
    alu add                 ; f_1 f_1+f_2
    pair 1                  ; f_1+f_2,f_1
    push fib_iter           ; f_1+f_2,f_1 fib_iter
    actor become            ; --

    msg -1                  ; n
    push 1                  ; n 1
    alu sub                 ; n-1
    msg 1                   ; n-1 cust
    pair 1                  ; cust,n-1
    actor self              ; cust,n-1 SELF
    ref std.send_msg

fib_iter_end:               ; --
    state 0                 ; f_1,f_2
    part 1                  ; f_2 f_1
    alu add                 ; f_2+f_1
    ref std.cust_send

;;  DEF fib_list AS \list.(
;;      CASE list OF
;;      (first, rest) : (fib_fn(first), fib_list(rest))
;;      _ : fib_fn(list)
;;      END
;;  )

fib_list:                   ; _ <- (cust, list)
    msg -1                  ; list
    typeq #pair_t           ; is_pair(list)
    if_not fib_last         ; --

    msg -1                  ; h_req,t_req=list
    actor self              ; h_req,t_req t_svc=SELF
    push 0                  ; h_req,t_req t_svc 0
    push 1                  ; h_req,t_req t_svc 0 1
    pair 1                  ; h_req,t_req t_svc 1,0
    push fib_iter           ; h_req,t_req t_svc 1,0 fib_iter
    actor create            ; h_req,t_req t_svc h_svc=fib_iter.1,0
    msg 1                   ; h_req,t_req t_svc h_svc cust
    pair 2                  ; h_req,t_req cust,h_svc,t_svc
    push fork.beh           ; h_req,t_req cust,h_svc,t_svc fork_beh
    actor create            ; h_req,t_req fork_beh.cust,h_svc,t_svc
    ref std.send_msg

fib_last:                   ; --
    msg 0                   ; cust,last
    part 1                  ; n=last cust
    call fib_call           ; --
    ref std.commit

;;  CREATE fib WITH fib_iter(1, 0)
;;  SEND (cust, n) TO fib
fib_call:                   ; n cust --
    roll -3                 ; k n cust
    pair 1                  ; k cust,n

    push 0                  ; k cust,n 0
    push 1                  ; k cust,n 0 1
    pair 1                  ; k cust,n 1,0
    push fib_iter           ; k cust,n 1,0 fib_iter
    actor create            ; k cust,n fib_iter.1,0

    actor send              ; k
    return

;;  SEND fib_list(1, 2, 3, 4, 5, 6, 7, 8, 9) TO println
;;  # => +1,+1,+2,+3,+5,+8,+13,+21,+34
;;  SEND fib_list(10, 20, 30, 40) TO println
;;  # => +55,+6765,+832040,+102334155

list_1to9:                  ; 1,2,3,4,5,6,7,8,9
    pair_t 1
    pair_t 2
    pair_t 3
    pair_t 4
    pair_t 5
    pair_t 6
    pair_t 7
    pair_t 8
    ref 9

list_10to40by10:            ; 10,20,30,40
    pair_t 10
    pair_t 20
    pair_t 30
    ref 40

;;  CREATE fib WITH fib_iter(1, 0)
;;  SEND (println, 20) TO fib  # => 6765
boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; debug

    dup 1                   ; debug cust=debug
;    push list_1to9          ; debug cust list=1,2,3,4,5,6,7,8,9
    push list_10to40by10    ; debug cust list=10,20,30,40
    roll 2                  ; debug list cust
    pair 1                  ; debug cust,list
    push #?                 ; debug cust,list #?
    push fib_list           ; debug cust,list #? fib_list
    actor create            ; debug cust,list fib_list.#?
    actor send              ; debug

    push 20                 ; debug n=20
    roll 2                  ; n cust=debug
;    call fib_call           ; --
;    ref std.commit
    pair 1                  ; cust,n
    push 0                  ; cust,n 0
    push 1                  ; cust,n 0 1
    pair 1                  ; cust,n 1,0
    push fib_iter           ; cust,n 1,0 fib_iter
    actor create            ; cust,n fib_iter.1,0
    ref std.send_msg

.export
    boot
