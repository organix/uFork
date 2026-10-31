;
; Test uFork/FPGA timer and BLOB devices
;

debug_key:                  ; from `dev.asm`
    ref 0
clock_key:
    ref 1
timer_key:
    ref 2
io_key:
    ref 3
blob_key:
    ref 4
random_key:
    ref 5

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push debug_key          ; {caps} debug_key
    dict get                ; debug_dev

    msg 0                   ; debug_dev {caps}
    push clock_key          ; debug_dev {caps} clock_key
    dict get                ; debug_dev clock_dev
    actor send              ; --

;    if_not commit           ; end demo
    if_not blob_demo        ; blob demo
;    if_not timer_demo       ; timer demo
    ref event_abort

blob_demo:                  ; _ <- {caps}
    ; allocate blob
    push 16#1000            ; size=4k
    actor self              ; size cust=SELF
    pair 1                  ; cust,size
    msg 0                   ; cust,size {caps}
    push blob_key           ; cust,size {caps} blob_key
    dict get                ; cust,size blob_dev
    actor send              ; --

    msg 0                   ; {caps}
    push blob_0             ; {caps} blob_0
    ref become

blob_0:                     ; {caps} <- blob
    ; 0 -> blob[0]
    push 0                  ; value=0
    push 0                  ; value offset=0
    actor self              ; value offset cust=SELF
    pair 2                  ; cust,offset,value
    msg 0                   ; cust,offset,value blob
    actor send              ; --

    ; remember blob for later...
    state 0                 ; {caps}
    msg 0                   ; {caps} blob
    pair 1                  ; blob,{caps}
    push blob_1             ; blob,{caps} blob_1
    ref become

blob_1:                     ; blob,{caps} <- ok
    ; 1 -> blob[1]
    push 1                  ; value=1
    push 1                  ; value offset=1
    actor self              ; value offset cust=SELF
    pair 2                  ; cust,offset,value
    state 1                 ; cust,offset,value blob
    actor send              ; --

    state 0                 ; blob,{caps}
    push 2                  ; blob,{caps} n=2
    pair 1                  ; n,blob,{caps}
    push blob_n             ; n,blob,{caps} blob_n
    ref become

blob_n:                     ; n,blob,{caps} <- ok
    ; fib[n-2] + fib[n-1] -> fib[n]
    state 1                 ; n
    push 1                  ; n 1
    alu sub                 ; offset=n-1
    actor self              ; offset cust=SELF
    pair 1                  ; cust,offset
    state 2                 ; cust,offset blob
    actor send              ; --

    state 1                 ; n
    push 2                  ; n 2
    alu sub                 ; offset=n-2
    actor self              ; offset cust=SELF
    pair 1                  ; cust,offset
    state 2                 ; cust,offset blob
    actor send              ; --

    state 0                 ; n,blob,{caps}
    push blob_n_1           ; n,blob,{caps} blob_n_1
    ref become

blob_n_1:                   ; n,blob,{caps} <- blob[n-1]
    state 0                 ; n,blob,{caps}
    msg 0                   ; n,blob,{caps} blob[n-1]
    pair 1                  ; blob[n-1],n,blob,{caps}
    push blob_n_2           ; blob[n-1],n,blob,{caps} blob_n_2
    ref become

blob_n_2:                   ; blob[n-1],n,blob,{caps} <- blob[n-2]
    ; blob[n-2] + blob[n-1] -> blob[n]
    msg 0                   ; blob[n-2]
    state 1                 ; blob[n-2] blob[n-1]
    alu add                 ; value=blob[n-2]+blob[n-1]
    state 2                 ; value offset=n
    actor self              ; value offset cust=SELF
    pair 2                  ; cust,offset,value
    state 3                 ; cust,offset,value blob
    actor send              ; --

    state 2                 ; n
    push 13                 ; n 13
    cmp ge                  ; n>=13
    if blob_done            ; -

    state -1                ; n,blob,{caps}
    part 1                  ; blob,{caps} n
    push 1                  ; blob,{caps} n 1
    alu add                 ; blob,{caps} n=n+1
    pair 1                  ; n,blob,{caps}
    push blob_n             ; n,blob,{caps} blob_n
    ref become

blob_done:                  ; -
    state -1                ; n,blob,{caps}
    push blob_read          ; n,blob,{caps} blob_read
    ref become

blob_read:                  ; n,blob,{caps} <- ok
    state 1                 ; offset=n
    state -2                ; offset {caps}
    push debug_key          ; offset {caps} debug_key
    dict get                ; offset cust=debug_dev
    pair 1                  ; cust,offset
    state 2                 ; cust,offset blob
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
    ref reason_abort
event_abort:                ; ...
    msg 0                   ; msg
    actor self              ; msg self
    pair 1                  ; event=self,msg
reason_abort:               ; reason
    end abort

stop:                       ; ...
    end stop

.export
    boot
