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
    dict get                ; debug

    dup 1                   ; debug debug
    msg 0                   ; debug debug {caps}
    push clock_key          ; debug debug {caps} clock_key
    dict get                ; debug debug clock
    actor send              ; debug

    push test               ; judge=debug test
    actor become            ; --
    ref resend

test:                       ; judge <- {caps}
    if_not commit
    ref event_abort

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
    test
