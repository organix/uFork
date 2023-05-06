; The uFork standard library

sink_beh:
commit:
    end commit

send_msg:
    send -1 commit

cust_send:
    msg 1 send_msg

rv_self:
    my self cust_send

rv_undef:
    push #? cust_send

rv_nil:
    push #nil cust_send

rv_false:
    push #f cust_send

rv_true:
    push #t cust_send

rv_unit:
    push #unit cust_send

rv_zero:
    push 0 cust_send

rv_one:
    push 1 cust_send

resend:
    msg 0
    my self
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
