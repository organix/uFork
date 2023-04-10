; The uFork standard library

sink_beh:
commit:
    end commit

send_0:
    send 0 commit

cust_send:
    msg 1 send_0

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
    ref send_0

release:
    end release

release_0:
    send 0 release

stop:
    end stop

abort:
    push #?
    end abort

.export
    commit
    sink_beh
    send_0
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
    release
    release_0
    stop
    abort
