;
; Test uFork/FPGA hardware devices
;

debug_key:                  ; from `dev.asm`
    ref 0
clock_key:
    ref 1
; timer_key:
;     ref 2
; io_key:
;     ref 3
; blob_key:
;     ref 4
random_key:
    ref 5

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push debug_key          ; {caps} debug_key
    dict get                ; debug

    push test               ; judge=debug test
    actor become            ; --
    ref resend

test:                       ; judge <- {caps}
;    if_not fib_test
;    if_not cnt_test
;    if_not clk_test
;    if_not rnd_test
    if_not dev_test

    ; make sure we're getting debug output...
    push 16#ABE             ; msg=+2750
    state 0                 ; msg target=judge
    ref send_msg

dev_test:                   ; _ <- {caps}
    msg 0                   ; {caps}
    push debug_key          ; {caps} debug_key
    dict get                ; debug
    msg 0                   ; debug {caps}
    push clock_key          ; debug {caps} clock_key
    dict get                ; debug clock
    msg 0                   ; debug clock {caps}
    push random_key         ; debug clock {caps} random_key
    dict get                ; debug clock random
    pair 2                  ; random,clock,debug
    push dev_iter_cnt       ; random,clock,debug dev_iter_cnt
    actor create            ; target=dev_iter_cnt.random,clock,debug
    push 7                  ; target count=7
    roll 2                  ; count target
    ref send_msg

dev_iter_cnt:               ; random,clock,debug <- count
    msg 0                   ; count
    if_not commit           ; --
    actor self              ; SELF
    state 1                 ; SELF random
    actor send              ; --
    state 0                 ; random,clock,debug
    msg 0                   ; random,clock,debug count
    pair 1                  ; count,random,clock,debug
    push dev_iter_rnd       ; count,random,clock,debug dev_iter_rnd
    ref become

dev_iter_rnd:               ; count,random,clock,debug <- rnd
    actor self              ; SELF
    state 3                 ; SELF clock
    actor send              ; --
    state 0                 ; count,random,clock,debug
    msg 0                   ; count,random,clock,debug rnd
    pair 1                  ; rnd,count,random,clock,debug
    push dev_iter_clk       ; rnd,count,random,clock,debug dev_iter_clk
    ref become

dev_iter_clk:               ; rnd,count,random,clock,debug <- clk
    state 0                 ; rnd,count,random,clock,debug
    part 2                  ; random,clock,debug count rnd
    msg 0                   ; random,clock,debug count rnd clk
    pair 2                  ; random,clock,debug clk,rnd,count
    state -4                ; random,clock,debug clk,rnd,count debug
    actor send              ; random,clock,debug
    push dev_iter_cnt       ; random,clock,debug dev_iter_cnt
    actor become            ; --
    state 2                 ; count
    push 1                  ; count 1
    alu sub                 ; count'=count-1
    ref self_send

cnt_test:                   ; _ <- {caps}
    msg 0                   ; {caps}
    push debug_key          ; {caps} debug_key
    dict get                ; debug
    push cnt_down           ; debug cnt_down
    actor create            ; target=cnt_down.debug
    push 7                  ; target count=7
    roll 2                  ; count target
    ref send_msg

cnt_down:                   ; debug <- count
    msg 0                   ; count
    if_not commit           ; --
    msg 0                   ; count
    state 0                 ; count debug
    actor send              ; --
    msg 0                   ; count
    push 1                  ; count 1
    alu sub                 ; count'=count-1
    ref self_send

clk_test:                   ; _ <- {caps}
    msg 0                   ; {caps}
    push debug_key          ; {caps} debug_key
    dict get                ; debug
    msg 0                   ; debug {caps}
    push clock_key          ; debug {caps} clock_key
    dict get                ; debug dev=clock
    pair 1                  ; dev,debug
    push dev_down           ; dev,debug dev_down
    actor create            ; target=dev_down.dev,debug
    push 7                  ; target count=7
    roll 2                  ; count target
    ref send_msg

dev_down:                   ; dev,debug <- count
    msg 0                   ; count
    if_not commit           ; --
    state 0                 ; dev,debug
    part 1                  ; debug dev
    actor send              ; --
    msg 0                   ; count
    push 1                  ; count 1
    alu sub                 ; count'=count-1
    ref self_send

rnd_test:                   ; _ <- {caps}
    msg 0                   ; {caps}
    push debug_key          ; {caps} debug_key
    dict get                ; debug
    msg 0                   ; debug {caps}
    push random_key         ; debug {caps} random_key
    dict get                ; debug dev=random
    pair 1                  ; dev,debug
    push dev_down           ; dev,debug dev_down
    actor create            ; target=dev_down.dev,debug
    push 7                  ; target count=7
    roll 2                  ; count target
    ref send_msg

;;  DEF fib_beh AS \(cust, n).[
;;      CASE greater(n, 1) OF
;;      TRUE : [
;;          SEND (k_fib, sub(n, 1)) TO SELF
;;          SEND (k_fib, sub(n, 2)) TO NEW fib_beh
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
    if_not cust_send        ; n

    msg 1                   ; n cust
    push k                  ; n cust k
    actor create            ; n k=k.cust

    pick 2                  ; n k n
    push 1                  ; n k n 1
    alu sub                 ; n k n-1
    pick 2                  ; n k n-1 k
    pair 1                  ; n k k,n-1
    actor self              ; n k k,n-1 SELF
;    push #?                 ; n k k,n-1 #?
;    push fib_beh            ; n k k,n-1 #? fib_beh
;    actor create            ; n k k,n-1 fib.#?
    actor send              ; n k

    roll 2                  ; k n
    push 2                  ; k n 2
    alu sub                 ; k n-2
    roll 2                  ; n-2 k
    pair 1                  ; k,n-2
;    actor self              ; k,n-2 SELF
    push #?                 ; k,n-2 #?
    push fib_beh            ; k,n-2 #? fib_beh
    actor create            ; k,n-2 fib.#?
    ref send_msg

k:                          ; cust <- m
    msg 0                   ; m
    state 0                 ; m cust
    pair 1                  ; cust,m
    push k2                 ; cust,m k2
    ref become

k2:                         ; cust,m <- n
    state -1                ; m
    msg 0                   ; m n
    alu add                 ; m+n
    state 1                 ; m+n cust
    ref send_msg

fib_test:                   ; judge <- {caps}
    push 6                  ; n=6 (==> 8)
;    push 9                  ; n=9 (==> 34)
    state 0                 ; n cust=judge
    pair 1                  ; cust,n
    push #?                 ; cust,n #?
    push fib_beh            ; cust,n #? fib_beh
    actor create            ; cust,n fib
    ref send_msg

; shared tails from `std.asm`
cust_send:                  ; msg
    msg 1                   ; msg actor=cust
send_msg:                   ; msg actor
    actor send              ; --
sink_beh:                   ; _ <- _
commit:                     ; ...
    end commit

become:                     ; state beh
    actor become            ; --
    ref commit

resend:                     ; _ <- msg
    msg 0                   ; msg
self_send:                  ; msg
    actor self              ; msg actor=SELF
    ref send_msg

abort:                      ; ...
    push #?                 ; ... reason=#?
reason_abort:               ; reason
    end abort

stop:                       ; ...
    end stop

.export
    boot
    test
