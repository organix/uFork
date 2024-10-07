.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

boot:                       ; () <- {caps}
    push #t                 ; ok=#t
    msg 0                   ; ok {caps}
    push dev.io_key         ; ok {caps} io_key
    dict get                ; ok io_dev
    push write_cb_beh       ; ok io_dev write_cb_beh
    new 1                   ; ok start=write_cb_beh.(io_dev)
    send 1                  ; --
    ref std.commit

fail:
    msg -1                  ; reason=error
    end abort               ; --

write_cb_beh:               ; (io_dev) <- (ok . value/error)
    msg 1                   ; ok
    if_not fail             ; --
    state 1                 ; io_dev
    push read_cb_beh        ; io_dev read_cb_beh
    new 1                   ; callback=read_cb_beh.(io_dev)
    push #?                 ; callback to_cancel=#?
    state 1                 ; callback to_cancel io_dev
    send 2                  ; --
    ref std.commit

read_cb_beh:                ; (io_dev) <- (ok . char/error)
    msg 1                   ; ok
    if_not fail             ; --
    msg -1                  ; char
    state 1                 ; char io_dev
    push write_cb_beh       ; char io_dev write_cb_beh
    new 1                   ; char callback=write_cb_beh.(io_dev)
    push #?                 ; char callback to_cancel=#?
    state 1                 ; char callback to_cancel io_dev
    send 3                  ; --
    ref std.commit

.export
    boot
