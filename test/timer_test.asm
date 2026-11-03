;
; Test uFork/FPGA timer device
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

;    if_not commit           ; end demo early

timer_demo:                 ; _ <- {caps}
    ; get debug device
    msg 0                   ; {caps}
    push debug_key          ; {caps} debug_key
    dict get                ; debug_dev

    ; get hardware timer device
;    msg 0                   ; debug_dev {caps}
;    push timer_key          ; debug_dev {caps} timer_key
;    dict get                ; debug_dev timer_dev
    ; use simulated timer device
    msg 0                   ; debug_dev {caps}
    push clock_key          ; debug_dev {caps} clock_key
    dict get                ; debug_dev clock_dev
    push timer_svc          ; debug_dev clock_dev timer_svc
    actor create            ; debug_dev timer_dev=timer_svc.clock_dev

    ; start ticking
    push 10                 ; 10
    actor self              ; 10 SELF
    actor send              ; --
    pair 1                  ; timer_dev,debug_dev
    push tick_job           ; timer_dev,debug_dev tick_job
    ref become

tick_job:                   ; timer_dev,debug_dev <- count
    ; check countdown
    msg 0                   ; count
    push 0                  ; count 0
    cmp gt                  ; count>0
    if_not commit           ; --

    ; decrement counter
    msg 0                   ; count
    push 1                  ; count 1
    alu sub                 ; count-1

    ; print new counter
    dup 1                   ; count-1 count-1
    state -1                ; count-1 count-1 debug_dev
    actor send              ; count-1

    ; send countdown
    actor self              ; message=count-1 target=SELF
    push 1000               ; message target delay=1sec=1000ms
    pair 2                  ; delay,target,message
    state 1                 ; delay,target,message timer_dev
    ref send_msg

timer_svc:                  ; clock_dev <- delay,target,message
    msg 0                   ; delay,target,message
    part 1                  ; target,message delay
    state 0                 ; target,message delay clock_dev
    roll 2                  ; target,message clock_dev dt=delay
    pair 2                  ; dt,clock_dev,target,message
    push timer_job          ; dt,clock_dev,target,message timer_job
    actor create            ; cust=timer_job.dt,clock_dev,target,message
    state 0                 ; message=cust clock_dev
    ref send_msg

timer_job:                  ; dt,clock_dev,target,message <- t0
    actor self              ; cust=SELF
    state 2                 ; cust clock_dev
    actor send              ; --

    state 0                 ; dt,clock_dev,target,message
    part 1                  ; clock_dev,target,message dt
    msg 0                   ; clock_dev,target,message dt t0
    alu add                 ; clock_dev,target,message t0'=dt+t0
    pair 1                  ; t0',clock_dev,target,message
    push timer_poll         ; t0',clock_dev,target,message timer_poll
    ref become

timer_poll:                 ; t0,clock_dev,target,message <- t1
    state 1                 ; t0
    msg 0                   ; t0 t1
    alu sub                 ; t0-t1
    push 0                  ; t0-t1 0
    cmp le                  ; t0-t1<=0
    if timer_done           ; --

    actor self              ; cust=SELF
    state 2                 ; cust clock_dev
    ref send_msg

timer_done:                 ; --
    state 0                 ; t0,clock_dev,target,message
    part 3                  ; message target clock_dev t0
    drop 2                  ; message target
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
