; The uFork standard library

cust_send:              ; msg
    msg 1               ; msg cust

send_msg:               ; msg cust
    send -1             ; --

sink_beh:               ; _ <- _
commit:
    end commit

rv_self:                ; _ <- (cust . _)
    my self cust_send   ; msg=SELF

rv_undef:               ; _ <- (cust . _)
    push #? cust_send   ; msg=#?

rv_nil:                 ; _ <- (cust . _)
    push #nil cust_send ; msg=()

rv_false:               ; _ <- (cust . _)
    push #f cust_send   ; msg=#f

rv_true:                ; _ <- (cust . _)
    push #t cust_send   ; msg=#t

rv_unit:                ; _ <- (cust . _)
    push #unit cust_send ; msg=#unit

rv_zero:                ; _ <- (cust . _)
    push 0 cust_send    ; msg=0

rv_one:                 ; _ <- (cust . _)
    push 1 cust_send    ; msg=1

resend:                 ; _ <- msg
    msg 0               ; msg
    my rv_self          ; msg cust=SELF
    ref send_msg

stop:
    end stop

abort:
    push #?
    end abort

.export
    commit
    sink_beh
    send_msg
    cust_send
    rv_self
    rv_undef
    rv_nil
    rv_false
    rv_true
    rv_unit
    rv_zero
    rv_one
    resend
    stop
    abort
