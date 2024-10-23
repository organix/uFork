.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

boot:                       ; () <- {caps}
    push #?                 ; value=#?
    push #t                 ; value ok=#t
    pair 1                  ; result=(ok . value)
    msg 0                   ; result {caps}
    push dev.io_key         ; result {caps} io_key
    dict get                ; result io_dev
    push write_cb_beh       ; result io_dev write_cb_beh
    new -1                  ; result start=write_cb_beh.io_dev
    send -1                 ; --
    ref std.commit

fail:
    msg -1                  ; reason=error
    end abort               ; --

write_cb_beh:               ; io_dev <- (ok . value/error)
    msg 1                   ; ok
    if_not fail             ; --
    push #?                 ; input=#?
    state 0                 ; input io_dev
    push read_cb_beh        ; input io_dev read_cb_beh
    new -1                  ; input callback=read_cb_beh.io_dev
    push #?                 ; input callback to_cancel=#?
    pair 2                  ; io_req=(to_cancel callback . input)
    state 0                 ; io_req io_dev
    send -1                 ; --
    ref std.commit

read_cb_beh:                ; io_dev <- (ok . char/error)
    msg 1                   ; ok
    if_not fail             ; --
    msg -1                  ; char
    state 0                 ; char io_dev
    push write_cb_beh       ; char io_dev write_cb_beh
    new -1                  ; char callback=write_cb_beh.io_dev
    push #?                 ; char callback to_cancel=#?
    pair 2                  ; io_req=(to_cancel callback . char)
    state 0                 ; io_req io_dev
    send -1                 ; --
    ref std.commit

.export
    boot
