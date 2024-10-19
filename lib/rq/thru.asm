; The "thru" requestor produces its input value.

.import
    std: "../std.asm"
    dev: "../dev.asm"
    unwrap_result: "./unwrap_result.asm"

beh:
thru_beh:                   ; () <- request=(to_cancel callback . value)
    msg -2                  ; value
    push #t                 ; value ok=#t
    pair 1                  ; result=(ok . value)
    msg 2                   ; result callback
    ref std.send_msg

; Test suite

boot:                       ; () <- {caps}
    push 42                 ; 42
    msg 0                   ; 42 {caps}
    push dev.debug_key      ; 42 {caps} debug_key
    dict get                ; 42 debug_dev
    ref suite

test:                       ; (verdict) <- {caps}
    push #t                 ; value=#t
    state 1                 ; value verdict
    push unwrap_result.beh  ; value verdict unwrap_result_beh
    new 1                   ; value callback=unwrap_result_beh.(verdict)
suite:
    push #?                 ; value callback to_cancel=#?
    pair 2                  ; request=(to_cancel callback . value)
    push thru_beh           ; request thru_beh
    new 0                   ; request thru=thru_beh.()
    ref std.send_msg

.export
    beh
    boot
    test
