; Device constants, and test suite.

.import
    std: "../../../lib/std.asm"
    dev: "../../../lib/dev.asm"

boot:                   ; () <- {caps}
    push '>'            ; '>'=62
    push std.sink_beh   ; '>' sink_beh
    new 0               ; '>' callback=sink.()
    push #?             ; '>' callback to_cancel=#?
    msg 0               ; '>' callback to_cancel {caps}
    push io_key         ; '>' callback to_cancel {caps} io_key
    dict get            ; '>' callback to_cancel io_dev
    send 3              ; --

    msg 0               ; {caps}
    push debug_key      ; {caps} debug_key
    dict get            ; callback=debug_dev
    push #?             ; callback to_cancel=#?
    msg 0               ; callback to_cancel {caps}
    push io_key         ; callback to_cancel {caps} io_key
    dict get            ; callback to_cancel io_dev
    send 2              ; --

    ref std.commit

.export
    boot
