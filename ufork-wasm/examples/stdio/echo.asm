.import
    dev: "../../lib/dev.asm"
    std: "../../lib/std.asm"

boot:                       ; () <- {caps}
    msg 0                   ; {caps}
    push dev.io_key         ; {caps} io_key
    dict get                ; io_dev
    push write_cb_beh       ; io_dev write_cb_beh
    new 1                   ; start=write_cb_beh.(io_dev)
    send 0                  ; --
    ref std.commit

fail:
    msg -1                  ; reason=error
    end abort               ; --

write_cb_beh:               ; (io_dev) <- () | (ok . error)
    msg -1                  ; error
    if fail                 ; --
    state 1                 ; io_dev
    push read_cb_beh        ; io_dev read_cb_beh
    new 1                   ; callback=read_cb_beh.(io_dev)
    push #?                 ; callback to_cancel=#?
    state 1                 ; callback to_cancel io_dev
    send 2                  ; --
    ref std.commit

read_cb_beh:                ; (io_dev) <- (char . error)
    msg -1                  ; error
    if fail                 ; --
    msg 1                   ; char
    state 1                 ; char io_dev
    push write_cb_beh       ; char io_dev write_cb_beh
    new 1                   ; char callback=write_cb_beh.(io_dev)
    push #?                 ; char callback to_cancel=#?
    state 1                 ; char callback to_cancel io_dev
    send 3                  ; --
    ref std.commit

.export
    boot
