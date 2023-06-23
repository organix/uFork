; Device constants, and test suite.

.import
    std: "./std.asm"

debug_key:
    ref 2
clock_key:
    ref 3
io_key:
    ref 4
blob_key:
    ref 5
timer_key:
    ref 6
memo_key:
    ref 7
awp_key:
    ref 8

intro_tag:
    ref 0
listen_tag:
    ref 1

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push io_key         ; {caps} io_key
    dict get            ; io_dev
    msg 0               ; io_dev {caps}
    push blob_key       ; io_dev {caps} blob_key
    dict get            ; io_dev blob_dev

    dup 2               ; io_dev blob_dev io_dev blob_dev
    push 13             ; io_dev blob_dev io_dev blob_dev 13
    roll -3             ; io_dev blob_dev 13 io_dev blob_dev
    send 2              ; io_dev blob_dev

    push 3              ; io_dev blob_dev 3
    roll -3             ; 3 io_dev blob_dev
    send 2              ; --

    push 5              ; 5
    push count          ; 5 count
    new 0               ; 5 counter
    send -1             ; --

    push 42             ; msg=42
    msg 0               ; msg {caps}
    push debug_key      ; msg {caps} debug_key
    dict get            ; msg debug_dev
    push 0              ; msg debug_dev delay=0
    msg 0               ; msg debug_dev delay {caps}
    push timer_key      ; msg debug_dev delay {caps} timer_key
    dict get            ; msg debug_dev delay timer_dev
    send 3              ; --

    push #nil           ; ()
    push -3             ; () -3
    push -2             ; () -3 -2
    push -1             ; () -3 -2 -1
    pair 3              ; msg=(-1 -2 -3)
    msg 0               ; msg {caps}
    push debug_key      ; msg {caps} debug_key
    dict get            ; msg debug_dev
    send -1             ; --

    ; "Hello?" = [72, 101, 108, 108, 111, 63]
    push #nil           ; ()
    push #?             ; () to_cancel=#?
    push 62             ; '>'=62
    push std.sink_beh   ; '>' sink_beh
    new 0               ; '>' callback=sink.()
    push #?             ; '>' callback to_cancel=#?
    msg 0               ; '>' callback to_cancel {caps}
    push io_key         ; '>' callback to_cancel {caps} io_key
    dict get            ; '>' callback to_cancel io_dev
    send 3              ; --

    ref std.commit

count:
    msg 0               ; n
    dup 1               ; n n
    eq 0                ; n n==0
    if std.abort        ; n

    push 1              ; n 1
    alu sub             ; n-1
    my self             ; n-1 self

    ref std.send_msg

.export
    debug_key
    clock_key
    io_key
    blob_key
    timer_key
    memo_key
    awp_key
    intro_tag
    listen_tag
    boot
