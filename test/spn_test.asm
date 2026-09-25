;
; Test uFork/FPGA dispatch (& sponsor) mechanisms
;

debug_key:                  ; from `dev.asm`
    ref 0

E_MEM_LIM:                  ; Sponsor memory limit reached
    ref -11
E_CPU_LIM:                  ; Sponsor instruction limit reached
    ref -12
E_MSG_LIM:                  ; Sponsor event limit reached
    ref -13

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push debug_key          ; {caps} debug_key
    dict get                ; debug

    ; make sure we're getting debug output...
    push 16#ABE             ; debug +2750
    pick 2                  ; debug +2750 debug
    actor send              ; debug

    push test               ; judge=debug test
    actor become            ; --
    ref resend

test:                       ; judge <- {caps}
;    if_not fib_test         ; --
    if_not spn_test         ; --
;    assert #t               ; [E_ASSERT]
;    call no_mem_test        ; [E_NO_MEM]
;    return                  ; [E_NOT_EXE]
;    if test_fail            ; --

test_pass:
    ; trivial case of test success
    push #t                 ; verdict=#t
    state 0                 ; verdict judge
    ref send_msg

test_fail:
    ; trivial case of test failure
    push #f                 ; verdict=#f
    state 0                 ; verdict judge
    ref send_msg

; Send concurrent messages and check if they all arrive.

actor_busy_test:            ; judge <- {caps}
    push 0                  ; 0
    push sum_beh            ; 0 sum_beh
    actor create            ; sum=sum_beh.0

    push 16#1               ; sum +1
    pick 2                  ; sum +1 sum
    actor send              ; sum

    push 16#10              ; sum +16
    pick 2                  ; sum +16 sum
    actor send              ; sum

    push 16#100             ; sum +256
    pick 2                  ; sum +256 sum
    actor send              ; sum

    state 0                 ; sum message=judge
    roll 2                  ; message target=sum
    push 5                  ; message target delay=5
    pair 2                  ; delay,target,message
    actor self              ; delay,target,message SELF
    actor send              ; --

    push 3                  ; quantum=3
    push timer_beh          ; quantum timer_beh
    ref become

; Test sponsor mechanism.

spn_test:                   ; judge <- {caps}
    sponsor new             ; sponsor
    push 512                ; sponsor memory=512
    sponsor memory          ; sponsor
    push 5                  ; sponsor events=5
    sponsor events          ; sponsor
    push 512                ; sponsor cycles=512
    sponsor cycles          ; sponsor

    dup 1                   ; sponsor sponsor
    push 4                  ; sponsor sponsor msg=4
    push 0                  ; sponsor sponsor msg cnt=0
    push tree_cnt           ; sponsor sponsor msg cnt tree_cnt
    actor create            ; sponsor sponsor msg actor=tree_cnt.cnt
    dup 1                   ; sponsor sponsor msg actor subject=actor
    state 0                 ; sponsor sponsor msg actor subject judge
    pair 1                  ; sponsor sponsor msg actor judge,subject
    push spn_ctrl           ; sponsor sponsor msg actor judge,subject spn_ctrl
    actor become            ; sponsor sponsor msg actor
    actor post              ; sponsor

    actor self              ; sponsor SELF
    sponsor start           ; --
    ref commit

spn_ctrl:                   ; judge,subject <- spn
    msg 0                   ; spn
    quad -3                 ; signal quota #sponsor_t
    drop 2                  ; signal
    eq E_MSG_LIM            ; signal==E_MSG_LIM
    if_not commit           ; --

    msg 0                   ; spn
    push 13                 ; spn 13
    sponsor events          ; spn
    actor self              ; spn SELF
    sponsor start           ; --

    state 1                 ; judge
    state -1                ; judge subject
    ref send_msg

; An infinite loop consumes cycles, but no memory or events.

loop_forever:
    dup 0 loop_forever

; Grow the stack until out of memory.

no_mem_test:                ; ( -- [E_NO_MEM] )
    push 0                  ; n=0
grow_stack:                 ; n
    dup 1                   ; n n
    push 1                  ; n n 1
    alu add                 ; n n+1
    ref grow_stack

; Send yourself two messages for each one received.

msg_bomb:                   ; _ <- _
    push #?                 ; #?
    actor self              ; #? SELF
    actor send              ; --
    push #?                 ; #?
    actor self              ; #? SELF
    actor send              ; --
    ref commit

; Create and activate two clones for each message received.

fork_bomb:                  ; _ <- _
    push #?                 ; #?
    push #?                 ; #? #?
    push fork_bomb          ; #? #? fork_bomb
    actor create            ; #? fork_bomb.#?
    actor send              ; --
    push #?                 ; #?
    push #?                 ; #? #?
    push fork_bomb          ; #? #? fork_bomb
    actor create            ; #? fork_bomb.#?
    actor send              ; --
    ref commit

; A simple data cell (write-only, last write wins).

cell_beh:                   ; value <- value'
    msg 0                   ; value'
    push cell_beh           ; value' cell_beh
    ref become

; Count up to a specified `limit` (forever, if `limit==#?`).

count_to:                   ; limit <- count
    state 0                 ; limit
    typeq #fixnum_t         ; typeof(limit)==#fixnum_t
    if_not count_next       ; --
    msg 0                   ; count
    state 0                 ; count limit
    cmp ge                  ; count>=limit
    if commit               ; --
count_next:
    msg 0                   ; count
    push 1                  ; count 1
    alu add                 ; count+1
    actor self              ; count+1 SELF
    ref send_msg

; Add `inc` to `cnt` forever, and report to `cust`.

count_beh:                  ; cnt <- inc | cust
    msg 0                   ; msg
    typeq #actor_t          ; is_cap(msg)
    if count_read           ; --
    state 0                 ; cnt
    msg 0                   ; cnt inc
    alu add                 ; cnt+inc
    push count_beh          ; cnt+inc count_beh
    actor become            ; --
    ref resend
count_read:                 ; --
    state 0                 ; cnt
    msg 0                   ; cnt cust
    ref send_msg

; Count nodes in a binary tree.

tree_cnt:                   ; cnt <- depth | cust
    msg 0                   ; msg
    typeq #fixnum_t         ; is_fix(msg)
    if tree_depth           ; --
    state 0                 ; cnt
    msg 0                   ; cnt cust
    ref send_msg
tree_depth:                 ; --
    state 0                 ; cnt
    push 1                  ; cnt 1
    alu add                 ; cnt+1
    push tree_cnt           ; cnt+1 tree_cnt
    actor become            ; --
    msg 0                   ; depth
    push 0                  ; depth 0
    cmp le                  ; depth<=0
    if commit               ; --
    msg 0                   ; depth
    push 1                  ; depth 1
    alu sub                 ; depth-1
    actor self              ; depth-1 SELF
    dup 2                   ; depth-1 SELF depth-1 SELF
    actor send              ; depth-1 SELF
    ref send_msg

; Add each `num` to `total`, and report to `cust`.

sum_beh:                    ; total <- num | cust
    msg 0                   ; msg
    typeq #actor_t          ; is_cap(msg)
    if sum_report           ; --
    state 0                 ; total
    msg 0                   ; total num
    alu add                 ; total+num
    push sum_beh            ; total+num sum_beh
    ref become
sum_report:                 ; --
    state 0                 ; total
    msg 0                   ; total cust
    ref send_msg

; AFTER <delay> SEND <message> TO <target>

timer_beh:                  ; quantum <- delay,target,message
    msg 1                   ; delay
    if timer_wait           ; --
    msg -1                  ; target,message
    part 1                  ; message target
    ref send_msg
timer_wait:                 ; --
    state 0                 ; quantum
timer_spin:                 ; quantum
    dup 1                   ; quantum quantum
    if_not timer_dec        ; quantum
    push 1                  ; quantum 1
    alu sub                 ; quantum-1
    ref timer_spin          ; quantum=quantum-1
timer_dec:                  ; quantum
    drop 1                  ; --
    msg 0                   ; delay,target,message
    part 1                  ; target,message delay
    push 1                  ; target,message delay 1
    alu sub                 ; target,message delay-1
    pair 1                  ; delay-1,target,message
    ref self_send

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
