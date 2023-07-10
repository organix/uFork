;
; peer chat demo
;

.import
    std: "/lib/std.asm"
    dev: "/lib/dev.asm"

echo:                   ; (io_dev debug_dev) <- result
    msg -1              ; error
    if_not echo_w       ; --
    ref std.commit
echo_w:
    msg 1               ; char
    my self             ; char callback=SELF
    push #?             ; char callback to_cancel=#?
    state 1             ; char callback to_cancel io_dev
    send 3              ; --
    state 0             ; (io_dev debug_dev)
    push echo_r         ; (io_dev debug_dev) echo_r
    beh -1              ; --
    ref std.commit

echo_r:                 ; (io_dev debug_dev) <- result
    my self             ; callback=SELF
    push #?             ; callback to_cancel=#?
    state 1             ; callback to_cancel io_dev
    send 2              ; --
    state 0             ; (io_dev debug_dev)
    push echo           ; (io_dev debug_dev) echo
    beh -1              ; --
    ref std.commit

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push dev.debug_key  ; {caps} debug_key
    dict get            ; debug_dev
    msg 0               ; debug_dev {caps}
    push dev.io_key     ; debug_dev {caps} io_key
    dict get            ; debug_dev io_dev
    push echo           ; debug_dev io_dev echo
    new 2               ; callback=echo.(io_dev debug_dev)
    push #?             ; callback to_cancel=#?
    msg 0               ; callback to_cancel {caps}
    push dev.io_key     ; callback to_cancel {caps} io_key
    dict get            ; callback to_cancel io_dev
    send 2              ; --
    ref std.commit

.export
    boot
