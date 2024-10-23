; Device constants, and test suite.

.import
    std: "./std.asm"

; Core devices.

debug_key:
    ref 0
clock_key:
    ref 1
io_key:
    ref 2
blob_key:
    ref 3
timer_key:
    ref 4
memo_key:
    ref 5
host_key:
    ref 6
random_key:
    ref 7

; Dynamic devices. These are provided by the host device.

awp_key:
    ref 100
intro_tag:
    ref 0
listen_tag:
    ref 1
svg_key:
    ref 101

boot:                       ; () <- {caps}
    msg 0                   ; {caps}
    push io_key             ; {caps} io_key
    dict get                ; io_dev
    msg 0                   ; io_dev {caps}
    push blob_key           ; io_dev {caps} blob_key
    dict get                ; io_dev blob_dev

    push 13                 ; io_dev blob_dev size=13
    pick 3                  ; io_dev blob_dev size io_dev
    pair 1                  ; io_dev blob_dev alloc_req=(io_dev . size)
    pick 2                  ; io_dev blob_dev alloc_req blob_dev
    send -1                 ; io_dev blob_dev
    push 13                 ; io_dev blob_dev size=3
    pick 3                  ; io_dev blob_dev size io_dev
    pair 1                  ; io_dev blob_dev alloc_req=(io_dev . size)
    pick 2                  ; io_dev blob_dev alloc_req blob_dev
    send -1                 ; io_dev blob_dev
    drop 2                  ; --

    push 5                  ; 5
    push count              ; 5 count
    new 0                   ; 5 counter
    send -1                 ; --

    push 42                 ; msg=42
    msg 0                   ; msg {caps}
    push debug_key          ; msg {caps} debug_key
    dict get                ; msg debug_dev
    push 1000               ; msg debug_dev delay=1000
    pair 2                  ; timer_req=(delay debug_dev . msg)
    msg 0                   ; timer_req {caps}
    push timer_key          ; timer_req {caps} timer_key
    dict get                ; timer_req timer_dev
    send -1                 ; --

    push #nil               ; ()
    push -3                 ; () -3
    push -2                 ; () -3 -2
    push -1                 ; () -3 -2 -1
    pair 3                  ; msg=(-1 -2 -3)
    msg 0                   ; msg {caps}
    push debug_key          ; msg {caps} debug_key
    dict get                ; msg debug_dev
    send -1                 ; --

    ; "Hello?" = [72, 101, 108, 108, 111, 63]
    push '😀'               ; char
    push std.sink_beh       ; char sink_beh
    new 0                   ; char callback=sink.()
    push #?                 ; char callback to_cancel=#?
    pair 2                  ; io_req=(to_cancel callback . char)
    msg 0                   ; io_req {caps}
    push io_key             ; io_req {caps} io_key
    dict get                ; io_req io_dev
    send -1                 ; --

    push #?                 ; input=#?
    msg 0                   ; input {caps}
    push debug_key          ; input {caps} debug_key
    dict get                ; input callback=debug_dev
    push #?                 ; input callback to_cancel=#?
    pair 2                  ; io_req=(to_cancel callback . input)
    msg 0                   ; io_req {caps}
    push io_key             ; io_req {caps} io_key
    dict get                ; io_req io_dev
    send -1                 ; --

    push 40                 ; b=40
    push -40                ; b a=-40
    msg 0                   ; b a {caps}
    push debug_key          ; b a {caps} debug_key
    dict get                ; b a cust=debug_dev
    pair 2                  ; (cust a . b)
    msg 0                   ; (cust a . b) {caps}
    push random_key         ; (cust a . b) {caps} random_key
    dict get                ; (cust a . b) random_dev
    send -1                 ; --

    ref std.commit

count:                      ; () <- n
    msg 0                   ; n
    dup 1                   ; n n
    eq 0                    ; n n==0
    if std.abort            ; n

    push 1                  ; n 1
    alu sub                 ; n-1
    my self                 ; n-1 self

    ref std.send_msg

.export
    debug_key
    clock_key
    io_key
    blob_key
    timer_key
    memo_key
    host_key
    random_key
    awp_key
    intro_tag
    listen_tag
    svg_key
    boot
