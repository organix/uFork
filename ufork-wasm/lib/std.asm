; The uFork standard library

sink_beh:
commit:
    end commit

send_0:
    send 0
    ref commit

cust_send:
    msg 1
    ref send_0

rv_self:
    my self
    ref cust_send

rv_undef:
    push #?
    ref cust_send

rv_nil:
    push #nil
    ref cust_send

rv_false:
    push #f
    ref cust_send

rv_true:
    push #t
    ref cust_send

rv_unit:
    push #unit
    ref cust_send

rv_zero:
    push 0
    ref cust_send

rv_one:
    push 1
    ref cust_send

resend:
    msg 0
    my self
    ref send_0

release:
    end release

release_0:
    send 0
    ref release

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
