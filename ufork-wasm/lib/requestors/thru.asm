; The "thru" requestor produces its input value.

.import
    std: "../std.asm"
    dev: "../dev.asm"
    lib: "../lib.asm"

beh:
thru_beh:                   ; () <- request=(to_cancel callback . value)
    msg -2                  ; value
    msg 2                   ; value callback
    send 1                  ; --
    ref std.commit

; Test suite

boot:                       ; () <- {caps}
    push 42                 ; 42
    msg 0                   ; 42 {caps}
    push dev.debug_key      ; 42 {caps} debug_key
    dict get                ; 42 debug_dev
    push #?                 ; 42 debug_dev to_cancel=#?
    pair 2                  ; request=(#? debug_dev . 42)
    push thru_beh           ; request thru_beh
    new 0                   ; request thru=thru_beh.()
    ref std.send_msg

test:                       ; (verdict) <- {caps}
    push #t                 ; value=#t
    state 1                 ; value verdict
    push lib.unwrap_beh     ; value verdict unwrap_beh
    new 1                   ; value callback=unwrap_beh.(verdict)
    push #?                 ; value callback to_cancel=#?
    pair 2                  ; request=(to_cancel callback . value)
    push thru_beh           ; request thru_beh
    new 0                   ; request thru=thru_beh.()
    ref std.send_msg

.export
    beh
    boot
    test
